"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createSeedData } = require("../miniprogram/lib/model");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

let modalResponse = { confirm: true, cancel: false };
let modals = [];
let toasts = [];
global.wx = {
  showToast: function (options) { toasts.push(options || {}); },
  showModal: function (options) {
    modals.push(options || {});
    if (options && typeof options.success === "function") options.success(modalResponse);
  },
  showLoading: function () {},
  hideLoading: function () {},
  reLaunch: function () {},
  createSelectorQuery: function () {
    return {
      select: function () { return this; },
      fields: function () { return this; },
      exec: function (callback) { callback([]); },
    };
  },
};

function replaceModule(modulePath, exportsValue) {
  const resolved = require.resolve(modulePath);
  const previous = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsValue };
  return function restore() {
    if (previous) require.cache[resolved] = previous;
    else delete require.cache[resolved];
  };
}

function setAtPath(target, key, value) {
  const parts = key.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach(function (part) {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(relativePage, store) {
  const pagePath = path.resolve(__dirname, "../miniprogram/pages", relativePage, "index.js");
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", {
    getHeaderLayout: function () { return { totalHeight: 88 }; },
  });
  const restoreMedia = replaceModule("../miniprogram/lib/media", {
    commitChange: function (options) { return options.persist(); },
    discardDraft: function () { return Promise.resolve([]); },
    mediaPath: function (result) { return result && (result.fileID || result.savedFilePath) || ""; },
  });
  let definition;
  global.Page = function (value) { definition = value; };
  delete require.cache[pagePath];
  require(pagePath);
  delete require.cache[pagePath];
  restoreStore(); restoreLayout(); restoreMedia();

  const instance = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData: function (updates, callback) {
      Object.keys(updates || {}).forEach((key) => setAtPath(this.data, key, updates[key]));
      if (callback) callback.call(this);
    },
  };
  Object.keys(definition).forEach(function (key) {
    if (typeof definition[key] === "function") instance[key] = definition[key].bind(instance);
  });
  return instance;
}

function storeStub(data) {
  const listeners = [];
  return {
    getData: function () { return data; },
    subscribe: function (listener) {
      listeners.push(listener);
      return function () {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    upsert: function (collection, record) {
      const list = data[collection] || (data[collection] = []);
      const index = list.findIndex(function (item) { return item.id === record.id; });
      if (index >= 0) list[index] = Object.assign({}, list[index], record);
      else list.push(Object.assign({}, record));
      listeners.slice().forEach(function (listener) { listener(); });
      return Promise.resolve(record);
    },
    remove: function () { return Promise.resolve({ trashId: "trash-vaccine" }); },
    restoreFromTrash: function () { return Promise.resolve(); },
  };
}

test("成长页的出生信息只来自 BabyProfile，折线点只来自真实成长记录", function () {
  const data = createSeedData("2026-08-26T10:00:00+08:00");
  data.growthRecords = [
    { id: "stale-birth", date: "2026-08-04", height: 50, weight: 3.25, note: "旧页面残留值" },
    { id: "growth-real", date: "2026-08-20", height: 52, weight: 3.8, note: "真实测量" },
  ];
  const page = loadPage("growth", storeStub(data));
  page.now = function () { return new Date("2026-08-26T10:00:00+08:00"); };

  page.refresh();

  assert.deepStrictEqual(page.data.babyProfile, {
    name: "硕之",
    birthDate: "2026-08-04",
    birthDateText: "2026年8月4日",
    birthWeight: 2.4,
    birthHeight: 48,
  });
  const birth = page.data.chartPoints[0];
  assert.deepStrictEqual(
    { date: birth.date, weight: birth.weight, height: birth.height, isBirth: birth.isBirth },
    { date: "2026-08-04", weight: 2.4, height: 48, isBirth: true },
  );
  assert.strictEqual(page.data.chartPoints[1].id, "growth-real");
  assert.strictEqual(page.data.records.find(function (item) { return item.isBirth; }).displayDate, "2026.8.4");
  assert.strictEqual(page.data.records.find(function (item) { return item.id === "growth-real"; }).displayDate, "2026.8.20");
});

test("Growth A 将两个量纲分开，单点不连线，缺项不补零", function () {
  const { buildCharts } = require("../miniprogram/lib/growth-view");
  const birth = { id:"birth", date:"2026-08-04", height:48, weight:2.4 };
  const single = buildCharts([birth]);
  assert.deepStrictEqual(single.map(chart => chart.unit), ["cm", "kg"]);
  single.forEach(chart => { assert.strictEqual(chart.points.length, 1); assert.strictEqual(chart.segments.length, 0); });
  const charts = buildCharts([birth,
    {id:"weight-only", date:"2026-08-05", weight:2.5, height:null},
    {id:"height-only", date:"2026-08-14", height:50, weight:""}
  ]);
  assert.deepStrictEqual(charts[0].points.map(point => point.value), [48,50]);
  assert.deepStrictEqual(charts[1].points.map(point => point.value), [2.4,2.5]);
  assert.deepStrictEqual(charts[0].dates, charts[1].dates);
  assert.strictEqual(charts[0].firstDate, charts[1].firstDate);
  assert.strictEqual(charts[0].lastDate, charts[1].lastDate);
  const heightSpan = charts[0].points[1].x - charts[0].points[0].x;
  const weightSpan = charts[1].points[1].x - charts[1].points[0].x;
  assert.ok(Math.abs(heightSpan / weightSpan - 10) < 1e-8, "十天间隔应为一天间隔的十倍");
});

test("最近摘要只来自同一条记录，缺失项显示未记录，完整备注不截断", function () {
  const data = createSeedData("2026-10-13T10:00:00+08:00");
  data.growthRecords.push({id:"weight-only", date:"2026-10-12", weight:4.2, note:"第一行\n第二行"});
  const page = loadPage("growth", storeStub(data)); page.refresh();
  assert.strictEqual(page.data.latest.id, "weight-only");
  assert.strictEqual(page.data.latest.heightText, "未记录");
  assert.strictEqual(page.data.latest.weightText, "4.2");
  assert.strictEqual(page.data.latest.note, "第一行\n第二行");
  assert.strictEqual(page.data.charts[0].segments.length, 0);
  assert.strictEqual(page.data.charts[1].segments.length, 1);
});

test("密集和跨年数据保留全部点，只有轴标签被抽样", function () {
  const { buildCharts } = require("../miniprogram/lib/growth-view");
  const records = Array.from({length:200}, (_, index) => ({
    id:String(index), date:new Date(Date.UTC(2026, 11, 1 + index)).toISOString().slice(0,10),
    height:48 + index / 100, weight:2.4 + index / 200
  }));
  const charts = buildCharts(records);
  charts.forEach(chart => {
    assert.strictEqual(chart.points.length, 200); assert.strictEqual(chart.segments.length, 199);
    assert.ok(chart.dates.length <= 5);
    assert.strictEqual(chart.dates[0].date, records[0].date);
    assert.strictEqual(chart.dates[chart.dates.length - 1].date, records[199].date);
    assert.ok(chart.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
  });
});

test("新增和编辑成长记录后，成长页重新读取时折线点立即变化", async function () {
  const data = createSeedData("2026-08-26T10:00:00+08:00");
  const page = loadPage("growth", storeStub(data));
  page.now = function () { return new Date("2026-08-26T10:00:00+08:00"); };
  page.onLoad();
  page.data.editor = { open: true, id: "", isBirth: false, date: "2026-08-20", height: "52", weight: "3.8", note: "第一次测量" };

  await page.saveRecord();
  const created = page.data.chartPoints.find(function (item) { return item.date === "2026-08-20"; });
  assert.ok(created, "新增记录必须形成真实图表点");
  assert.strictEqual(created.weight, 3.8);
  assert.strictEqual(page.data.latest.id, created.id);
  assert.strictEqual(page.data.charts[0].points.length, 2);

  page.data.editor = { open: true, id: created.id, isBirth: false, date: "2026-08-20", height: "53", weight: "4.1", note: "修正后" };
  await page.saveRecord();
  const updated = page.data.chartPoints.find(function (item) { return item.id === created.id; });
  assert.strictEqual(updated.height, 53);
  assert.strictEqual(updated.weight, 4.1);
  assert.strictEqual(page.data.charts[1].points[1].value, 4.1);
  assert.strictEqual(page.data.chartPoints.filter(function (item) { return item.date === "2026-08-20"; }).length, 1);
  page.onUnload();
});

test("健康页完整呈现 43 针和 16 个年龄组", function () {
  const data = createSeedData("2026-08-26T10:00:00+08:00");
  const page = loadPage("health", storeStub(data));
  page.refresh();
  assert.strictEqual(page.data.vaccineGroups.length, 16);
  assert.strictEqual(page.data.vaccineGroups.reduce(function (sum, group) { return sum + group.items.length; }, 0), 43);
});

test("当前年龄提示按计划月龄匹配周岁分组，出生24小时不扩展为整月", function () {
  const data = createSeedData("2026-08-04T10:00:00+08:00");
  const page = loadPage("health", storeStub(data));
  const activeAt = date => {
    page.now = () => new Date(date + "T12:00:00+08:00"); page.refresh();
    return page.data.vaccineGroups.filter(group => group.isCurrent).map(group => group.label);
  };
  assert.deepStrictEqual(activeAt("2026-08-04"), ["24小时内"]);
  assert.deepStrictEqual(activeAt("2026-08-20"), []);
  assert.deepStrictEqual(activeAt("2026-10-13"), ["2月龄"]);
  assert.deepStrictEqual(activeAt("2028-08-04"), ["2周岁"]);
  assert.deepStrictEqual(activeAt("2032-08-04"), ["6周岁"]);
});

test("健康编辑器的日期下限来自同一份宝宝出生档案", function () {
  const data = createSeedData("2026-08-26T10:00:00+08:00");
  const page = loadPage("health", storeStub(data));
  page.refresh();
  assert.strictEqual(page.data.birthDate, "2026-08-04");
});

test("健康页可从入口精确打开疫苗、发育或儿保子页", function () {
  const expected = {
    vaccine: "疫苗接种",
    ability: "发育里程碑",
    checkup: "儿保记录",
  };
  Object.keys(expected).forEach(function (tab) {
    const data = createSeedData("2026-08-26T10:00:00+08:00");
    const page = loadPage("health", storeStub(data));
    page.onLoad({ tab });
    assert.strictEqual(page.data.tab, tab);
    assert.strictEqual(page.data.hero.title, expected[tab]);
    page.onUnload();
  });
});

test("发育和儿保记录按内容稳定复用原定插画，排序变化不会串图或裁切", function () {
  const data = createSeedData("2026-08-26T10:00:00+08:00");
  data.abilities = [
    { id: "demo-ability-limb-movement", date: "2026-08-05", name: "四肢活动", description: "手脚更有力量" },
    { id: "demo-ability-head-lift", date: "2026-08-06", name: "短暂抬头", description: "趴卧时短暂抬头" },
    { id: "demo-ability-face-focus", date: "2026-08-08", name: "注视人脸", description: "会看向照护者" },
    { id: "custom-photo", date: "2026-08-09", name: "家庭记录", imageId: "wxfile://family-photo.jpg" },
  ];
  data.checkups = [
    { id: "demo-checkup-four-month", date: "2026-08-08", name: "4月龄儿保", tips: "记录发育" },
    { id: "demo-checkup-newborn", date: "2026-08-09", name: "新生儿访视", tips: "观察喂养" },
    { id: "demo-checkup-one-month", date: "2026-09-04", name: "满月儿保", tips: "记录身高体重" },
  ];
  const page = loadPage("health", storeStub(data));

  page.refresh();

  const abilityById = Object.fromEntries(page.data.abilities.map(function (item) { return [item.id, item]; }));
  assert.strictEqual(abilityById["demo-ability-head-lift"].artSrc, "../../assets/health/development-tummy-time.png");
  assert.strictEqual(abilityById["demo-ability-face-focus"].artSrc, "../../assets/health/development-rollover.png");
  assert.strictEqual(abilityById["demo-ability-limb-movement"].artSrc, "../../assets/health/development-sitting.png");
  assert.strictEqual(abilityById["custom-photo"].artSrc, "wxfile://family-photo.jpg");
  assert.ok(page.data.abilities.every(function (item) { return item.artMode === "aspectFit"; }), "发育插画和用户照片都不得裁切");

  const checkupById = Object.fromEntries(page.data.checkups.map(function (item) { return [item.id, item]; }));
  assert.strictEqual(checkupById["demo-checkup-newborn"].artSrc, "../../assets/health/checkup-newborn.png");
  assert.strictEqual(checkupById["demo-checkup-one-month"].artSrc, "../../assets/health/checkup-one-month.png");
  assert.strictEqual(checkupById["demo-checkup-four-month"].artSrc, "../../assets/health/checkup-four-month.png");
  assert.ok(page.data.checkups.every(function (item) { return item.artMode === "aspectFit"; }), "儿保插画必须完整显示");
});

test("勾选已接种自动使用当天日期，且可在保存前修改", async function () {
  const data = createSeedData("2026-08-26T10:00:00+08:00");
  const writes = [];
  const store = storeStub(data);
  store.upsert = function (collection, record) { writes.push({ collection, record }); return Promise.resolve(record); };
  const page = loadPage("health", store);
  page.data.today = "2026-08-26";
  const record = data.vaccines.find(function (item) { return item.scheduleKey === "1m-hepb-2"; });
  page.openVaccineEditor(record);
  page.data.editor.completedDate = "2026-08-20";

  await page.toggleCompleted();
  assert.strictEqual(page.data.editor.completed, true);
  assert.strictEqual(page.data.editor.completedDate, "2026-08-26");
  page.changeCompletedDate({ detail: { value: "2026-08-25" } });
  await page.saveEditor();
  assert.strictEqual(writes.length, 1);
  assert.strictEqual(writes[0].collection, "vaccines");
  assert.strictEqual(writes[0].record.completedDate, "2026-08-25");
});

test("取消已接种必须确认，并把原接种事实放入回收站以便恢复", async function () {
  const data = createSeedData("2026-08-26T10:00:00+08:00");
  const vaccine = data.vaccines.find(function (item) { return item.scheduleKey === "birth-hepb-1"; });
  vaccine.completedDate = "2026-08-04";
  const removals = [];
  const restores = [];
  const store = storeStub(data);
  store.remove = function (collection, id) {
    removals.push({ collection, id });
    return Promise.resolve({ trashId: "trash-" + id });
  };
  store.restoreFromTrash = function (trashId) {
    restores.push(trashId);
    return Promise.resolve();
  };
  const page = loadPage("health", store);
  page.data.today = "2026-08-26";
  page.openVaccineEditor(vaccine);
  modals = [];
  modalResponse = { confirm: true, cancel: false };

  await page.toggleCompleted();
  assert.strictEqual(modals.length, 1);
  assert.strictEqual(modals[0].title, "取消已接种？");
  assert.ok(/30\s*天内可恢复/.test(modals[0].content));
  assert.strictEqual(page.data.editor.completed, false);
  await page.saveEditor();
  assert.deepStrictEqual(removals, [{ collection: "vaccines", id: vaccine.id }]);
  assert.strictEqual(page.data.undoVisible, true);
  assert.strictEqual(page.data.undoTrashId, "trash-" + vaccine.id);
  await page.undoLastDelete();
  assert.deepStrictEqual(restores, ["trash-" + vaccine.id]);
  assert.strictEqual(page.data.undoVisible, false);
});

async function withLocalStore(run) {
  const storePath = require.resolve("../miniprogram/lib/store");
  const priorModule = require.cache[storePath];
  const priorWx = global.wx;
  const storage = new Map();
  const writes = { fail: false };
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  global.wx = Object.assign({}, priorWx, {
    getStorageSync: (key) => clone(storage.get(key)),
    setStorageSync: (key, value) => {
      if (writes.fail) throw new Error("模拟本地保存失败");
      storage.set(key, clone(value));
    },
  });
  async function reload() {
    delete require.cache[storePath];
    const store = require(storePath);
    await store.init({ config: { useCloud: false, envId: "" } });
    return store;
  }
  try { await run(await reload(), reload, writes, storage); }
  finally {
    global.wx = priorWx;
    if (priorModule) require.cache[storePath] = priorModule;
    else delete require.cache[storePath];
  }
}

test("Growth 清空已有身高后保存与重载仍为空，其他记录及体重保持不变", async function () {
  await withLocalStore(async function (store, reload, writes, storage) {
    await store.upsert("growthRecords", { id:"clear-height", date:"2026-10-12", height:56, weight:4.6, note:"保留备注", source:"手动测量" });
    await store.upsert("growthRecords", { id:"untouched-height", date:"2026-10-10", height:54, weight:4.3, note:"其他记录" });
    await store.upsert("todos", { id:"untouched-todo", title:"不变的待办", completed:false });
    const before = store.getData();
    const page = loadPage("growth", store);
    page.now = () => new Date("2026-10-13T12:00:00+08:00");
    page.onLoad();
    const weightChart = page.data.charts[1];
    page.openEdit({ currentTarget:{ dataset:{ id:"clear-height" } } });
    page.changeHeight({ detail:{ value:"" } });
    await page.saveRecord();
    const after = store.getData();
    const saved = after.growthRecords.find(row => row.id === "clear-height");
    assert.strictEqual(saved.height, "", "明确清空必须覆盖合并中的旧身高");
    const pending = storage.get("little-steps-miniapp-family-context-v1").outbox;
    assert.ok(pending.some(operation => operation.recordId === "clear-height" && operation.changes && operation.changes.height === ""), "待同步变更必须显式包含清空，避免旧值被云端合并保留");
    assert.strictEqual(saved.weight, 4.6);
    assert.strictEqual(saved.date, "2026-10-12");
    assert.strictEqual(saved.note, "保留备注");
    assert.strictEqual(saved.source, "手动测量");
    assert.deepStrictEqual(after.growthRecords.filter(row => row.id !== "clear-height"), before.growthRecords.filter(row => row.id !== "clear-height"));
    for (const key of ["baby","todos","feedings","sleeps","memories","vaccines","abilities","checkups"]) assert.deepStrictEqual(after[key], before[key], key);
    assert.strictEqual(page.data.latest.heightText, "未记录");
    assert.strictEqual(page.data.records.find(row => row.id === "clear-height").heightText, "未记录");
    assert.ok(!page.data.charts[0].points.some(point => point.id === "clear-height"));
    assert.deepStrictEqual(page.data.charts[1], weightChart);
    page.openEdit({ currentTarget:{ dataset:{ id:"clear-height" } } });
    assert.strictEqual(page.data.editor.height, "");
    await page.saveRecord();
    page.onUnload();

    store = await reload();
    assert.strictEqual(store.getData().growthRecords.find(row => row.id === "clear-height").height, "", "重载不能恢复旧值");
    const home = loadPage("home", store);
    home.now = () => new Date("2026-10-13T12:00:00+08:00");
    home.refresh();
    assert.strictEqual(home.data.height, "54");
    assert.strictEqual(home.data.heightSource, "测量 · 10.10");
    assert.strictEqual(home.data.weight, "4.6");
    home.openEditor("growth", store.getData().growthRecords.find(row => row.id === "clear-height"), false);
    assert.strictEqual(home.data.draft.height, "");
    await home.saveEditor();
    assert.strictEqual(home.data.editorOpen, false);
    assert.strictEqual(store.getData().growthRecords.find(row => row.id === "clear-height").height, "");
  });
});

test("Home 清空已有身高可重载，取消或保存失败均不改记录", async function () {
  await withLocalStore(async function (store, reload, writes) {
    await store.upsert("growthRecords", { id:"home-clear", date:"2026-10-12", height:56, weight:4.6, note:"原备注" });
    const home = loadPage("home", store);
    home.now = () => new Date("2026-10-13T12:00:00+08:00");
    const original = store.getData();
    home.openEditor("growth", original.growthRecords.find(row => row.id === "home-clear"), false);
    home.handleDraftInput({ currentTarget:{ dataset:{ field:"height" } }, detail:{ value:"" } });
    home.closeEditor();
    assert.deepStrictEqual(store.getData(), original, "取消编辑不能清空记录");
    home.openEditor("growth", original.growthRecords.find(row => row.id === "home-clear"), false);
    home.handleDraftInput({ currentTarget:{ dataset:{ field:"height" } }, detail:{ value:"" } });
    writes.fail = true;
    await home.saveEditor();
    assert.strictEqual(home.data.editorOpen, true);
    assert.strictEqual(home.data.draft.height, "");
    assert.deepStrictEqual(store.getData(), original, "保存失败不得修改内存记录");
    writes.fail = false;
    await home.saveEditor();
    assert.strictEqual(home.data.editorOpen, false);
    store = await reload();
    const saved = store.getData().growthRecords.find(row => row.id === "home-clear");
    assert.strictEqual(saved.height, "");
    assert.strictEqual(saved.weight, 4.6);
    assert.strictEqual(saved.note, "原备注");
    const growth = loadPage("growth", store);
    growth.refresh();
    growth.openEdit({ currentTarget:{ dataset:{ id:saved.id } } });
    assert.strictEqual(growth.data.editor.height, "");
    assert.strictEqual(growth.data.editor.weight, "4.6");
  });
});

test("两个入口清空身高与体重仍被拒绝，已存数据不变", async function () {
  await withLocalStore(async function (store) {
    await store.upsert("growthRecords", { id:"both-empty", date:"2026-10-12", height:56, weight:4.6, note:"不可变为空记录" });
    const original = store.getData();
    const growth = loadPage("growth", store);
    growth.refresh();
    growth.openEdit({ currentTarget:{ dataset:{ id:"both-empty" } } });
    growth.changeHeight({ detail:{ value:"" } });
    growth.changeWeight({ detail:{ value:"" } });
    await growth.saveRecord();
    assert.strictEqual(growth.data.editor.open, true);
    assert.strictEqual(toasts[toasts.length - 1].title, "身高和体重请至少填写一项");
    assert.deepStrictEqual(store.getData(), original);
    const home = loadPage("home", store);
    home.openEditor("growth", original.growthRecords.find(row => row.id === "both-empty"), false);
    for (const field of ["height", "weight"]) home.handleDraftInput({ currentTarget:{ dataset:{ field } }, detail:{ value:"" } });
    await home.saveEditor();
    assert.strictEqual(home.data.editorOpen, true);
    assert.strictEqual(toasts[toasts.length - 1].title, "身高和体重请至少填写一项");
    assert.deepStrictEqual(store.getData(), original);
  });
});

(async function run() {
  for (const item of tests) {
    try {
      await item.fn();
      process.stdout.write("✓ " + item.name + "\n");
    } catch (error) {
      process.stderr.write("✗ " + item.name + "\n" + error.stack + "\n");
      process.exitCode = 1;
    }
  }
  if (process.exitCode) process.exit(process.exitCode);
}());
