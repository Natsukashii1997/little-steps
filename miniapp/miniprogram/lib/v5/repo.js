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
  SCHEMA_VERSION,
  emptyData,
  normalize,
  load,
  getData,
  save,
  setBaby,
  // 测试用：注入假的 wx，并清空缓存
  __setApi(api) {
    injectedApi = api;
    cache = null;
  },
};
