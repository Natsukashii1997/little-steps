"use strict";

// S1 的本地仓库：本地优先（ADR 0001），新存储键，和旧键 little-steps-miniapp-family-v1 完全分开。
// 写后回读：写进去的和读出来的不一样就报错，草稿由调用方保留（规范 5.11）。
// 同步、备份以后作为适配器接在这层后面。

const age = require("./age");

const STORAGE_KEY = "baby-workbench-v5";
const SCHEMA_VERSION = 5;

let injectedApi = null;
let cache = null;

function wxApi() {
  if (injectedApi) return injectedApi;
  return typeof wx !== "undefined" ? wx : null;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function emptyData() {
  return { schemaVersion: SCHEMA_VERSION, baby: null, records: [], updatedAt: "" };
}

// 只认得的形状进来，认不得的丢掉；永远返回合法结构。
function normalize(raw) {
  const data = emptyData();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return data;
  const baby = raw.baby;
  if (baby && typeof baby === "object" && baby.name && age.parseDate(baby.birthDate)) {
    data.baby = { name: String(baby.name), birthDate: String(baby.birthDate) };
  }
  data.records = (Array.isArray(raw.records) ? raw.records : []).filter(function (record) {
    return record && typeof record === "object" && typeof record.id === "string" && record.id;
  }).map(clone);
  data.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : "";
  return data;
}

function load() {
  const api = wxApi();
  let raw = null;
  try {
    raw = api && typeof api.getStorageSync === "function" ? api.getStorageSync(STORAGE_KEY) : null;
  } catch (error) {
    raw = null;
  }
  cache = normalize(raw);
  return clone(cache);
}

function getData() {
  if (!cache) load();
  return clone(cache);
}

function save(next, now) {
  const api = wxApi();
  const data = normalize(next);
  data.updatedAt = new Date(now || Date.now()).toISOString();
  if (!api || typeof api.setStorageSync !== "function") throw new Error("没存上，这里写不了本机存储。");
  api.setStorageSync(STORAGE_KEY, clone(data));
  const readBack = api.getStorageSync(STORAGE_KEY);
  if (JSON.stringify(readBack) !== JSON.stringify(data)) {
    throw new Error("没存上，写进去的和读出来的不一样。");
  }
  cache = clone(data);
  return clone(cache);
}

// ---- 记录 ----
// S1 只有观察一类：{ id, type: "observe", at: "YYYY-MM-DDTHH:mm", text, itemId?, seen: "seen"|"waiting" }
const TYPES = ["observe"];
const AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DRAFT_KEY = STORAGE_KEY + "-draft";
const TRASH_DAYS = 30;

function makeId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function iso(now) {
  return new Date(now || Date.now()).toISOString();
}

// 校验并整理一条记录的内容字段；不合法就抛错，错误文案直接给界面用。
function normalizeRecord(input) {
  const record = {};
  record.type = String((input && input.type) || "observe");
  if (TYPES.indexOf(record.type) < 0) throw new Error("这一类还不能记。");
  record.at = String((input && input.at) || "");
  if (!AT_PATTERN.test(record.at) || !age.parseDate(record.at.slice(0, 10))) throw new Error("时间不对，改一下时间。");
  record.text = String((input && input.text) || "").trim();
  if (record.text.length > 200) throw new Error("太长了，200 字以内。");
  record.itemId = String((input && input.itemId) || "");
  record.seen = (input && input.seen) === "waiting" ? "waiting" : "seen";
  if (record.seen === "waiting" && !record.itemId) throw new Error("在等的话，先挑一条。");
  if (record.seen === "seen" && !record.text && !record.itemId) throw new Error("想记什么，写一句。");
  return record;
}

function findIndex(data, id) {
  for (let i = 0; i < data.records.length; i += 1) {
    if (data.records[i].id === id && !data.records[i].deletedAt) return i;
  }
  return -1;
}

function addRecord(input, now) {
  const record = normalizeRecord(input);
  record.id = makeId("rec");
  record.createdAt = iso(now);
  record.updatedAt = record.createdAt;
  const data = getData();
  data.records.push(record);
  save(data, now);
  return clone(record);
}

function updateRecord(id, patch, now) {
  const data = getData();
  const index = findIndex(data, id);
  if (index < 0) throw new Error("这条记录找不到了。");
  const merged = Object.assign({}, data.records[index], patch || {});
  const record = normalizeRecord(merged);
  Object.assign(data.records[index], record, { updatedAt: iso(now) });
  save(data, now);
  return clone(data.records[index]);
}

// 软删除：留 30 天再清掉（沿用旧实现的回收天数），S1 不做回收站界面。
function deleteRecord(id, now) {
  const data = getData();
  const index = findIndex(data, id);
  if (index < 0) throw new Error("这条记录找不到了。");
  data.records[index].deletedAt = iso(now);
  data.records[index].updatedAt = data.records[index].deletedAt;
  save(data, now);
  return true;
}

function listRecords() {
  return getData().records.filter(function (record) { return !record.deletedAt; });
}

function purgeDeleted(now) {
  const data = getData();
  const cutoff = new Date(now || Date.now()).getTime() - TRASH_DAYS * 24 * 60 * 60 * 1000;
  const kept = data.records.filter(function (record) {
    if (!record.deletedAt) return true;
    const time = new Date(record.deletedAt).getTime();
    return !Number.isFinite(time) || time > cutoff;
  });
  if (kept.length === data.records.length) return 0;
  const removed = data.records.length - kept.length;
  data.records = kept;
  save(data, now);
  return removed;
}

// ---- 草稿：「先放着」或没存上时留在本机，下次打开记一笔时回填 ----
function saveDraft(draft) {
  const api = wxApi();
  if (!api || typeof api.setStorageSync !== "function") return;
  api.setStorageSync(DRAFT_KEY, clone(draft || {}));
}

function loadDraft() {
  const api = wxApi();
  try {
    const raw = api && typeof api.getStorageSync === "function" ? api.getStorageSync(DRAFT_KEY) : null;
    return raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length ? clone(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearDraft() {
  const api = wxApi();
  if (api && typeof api.removeStorageSync === "function") api.removeStorageSync(DRAFT_KEY);
}

function setBaby(baby, now) {
  const name = String((baby && baby.name) || "").trim();
  const birthDate = String((baby && baby.birthDate) || "").trim();
  if (!name) throw new Error("名字还没写。");
  if (name.length > 12) throw new Error("名字太长了，12 个字以内。");
  if (!age.parseDate(birthDate)) throw new Error("出生日期还没选。");
  if (birthDate > age.todayKey(now)) throw new Error("出生日期不能在今天之后。");
  const data = getData();
  data.baby = { name: name, birthDate: birthDate };
  return save(data, now);
}

module.exports = {
  STORAGE_KEY,
  DRAFT_KEY,
  SCHEMA_VERSION,
  TRASH_DAYS,
  emptyData,
  normalize,
  normalizeRecord,
  load,
  getData,
  save,
  setBaby,
  addRecord,
  updateRecord,
  deleteRecord,
  listRecords,
  purgeDeleted,
  saveDraft,
  loadDraft,
  clearDraft,
  // 测试用：注入假的 wx，并清空缓存
  __setApi(api) {
    injectedApi = api;
    cache = null;
  },
};
