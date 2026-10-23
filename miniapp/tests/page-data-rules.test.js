"use strict";

const assert = require("assert");
const fs = require("node:fs");
const path = require("path");
const { createSeedData } = require("../miniprogram/lib/model");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

let toasts = [];
let modals = [];
let writtenFiles = [];
let sharedFiles = [];
global.wx = {
  showToast: function (options) { toasts.push(options || {}); },
  showModal: function (options) {
    modals.push(options || {});
    if (options && typeof options.success === "function") options.success({ confirm: true, cancel: false });
  },
  showLoading: function () {},
  hideLoading: function () {},
  env: { USER_DATA_PATH: "/virtual-user-data" },
  getFileSystemManager: function () {
    return {
      writeFile: function (options) {
        writtenFiles.push({ filePath: options.filePath, data: options.data, encoding: options.encoding });
        options.success({});
      },
    };
  },
  shareFileMessage: function (options) {
    sharedFiles.push({ filePath: options.filePath, fileName: options.fileName });
    options.success({});
  },
  reLaunch: function () {},
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

function loadPage(relativePage, store, mediaOverrides) {
  const pagePath = path.resolve(__dirname, "../miniprogram/pages", relativePage, "index.js");
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", { getHeaderLayout: function () { return { totalHeight: 88 }; } });
  const restoreMedia = replaceModule("../miniprogram/lib/media", Object.assign({
    commitChange: function (options) { return options.persist(); },
    discardDraft: function () { return Promise.resolve([]); },
    removeWithMedia: function (options) { return options.persist(); },
    mediaPath: function (result) { return result && (result.fileID || result.savedFilePath) || ""; },
  }, mediaOverrides || {}));
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

function storeStub(data, upsert) {
  return {
    getData: function () { return data; },
    upsert: upsert || function () { return Promise.resolve(); },
    remove: function () { return Promise.resolve(); },
    subscribe: function () { return function () {}; },
    getSyncStatus: function () { return { mode: "local" }; },
  };
}

test("首页测量来源逐项标注，不混用日期，睡眠无记录不展示实际零分钟", function () {
  const data = createSeedData("2026-10-13T10:00:00+08:00");
  const page = loadPage("home", storeStub(data));
  page.now = () => new Date("2026-10-13T10:00:00+08:00");
  page.refresh();
  assert.strictEqual(page.data.weightSource, "出生 · 08.04");
  assert.strictEqual(page.data.sleep.total, "暂无记录");
  data.growthRecords.push({id:"weight",date:"2026-10-10",weight:4.2});
  data.growthRecords.push({id:"height",date:"2026-10-12",height:56});
  page.refresh();
  assert.strictEqual(page.data.weightSource, "测量 · 10.10");
  assert.strictEqual(page.data.heightSource, "测量 · 10.12");
  assert.strictEqual(page.data.weight, "4.2"); assert.strictEqual(page.data.height, "56");
  data.sleeps = [{id:"old", start:"2026-10-12T12:00:00+08:00",end:"2026-10-12T13:00:00+08:00"}];
  page.refresh(); assert.strictEqual(page.data.sleep.total, "暂无记录");
  data.sleeps.push({id:"cross-midnight",start:"2026-10-12T23:30:00+08:00",end:"2026-10-13T00:30:00+08:00"});
  page.refresh(); assert.strictEqual(page.data.sleep.total, "30 分钟");
});

test("成长页保存等待 Store，失败时保留编辑状态并提示", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  let rejectSave;
  const pending = new Promise(function (_, reject) { rejectSave = reject; });
  const page = loadPage("growth", storeStub(data, function () { return pending; }));
  page.data.today = "2026-08-24";
  page.data.editor = { open: true, id: "", isBirth: false, date: "2026-08-20", height: "52", weight: "3.8", note: "测试" };
  toasts = [];
  const saving = page.saveRecord();
  assert.ok(saving && typeof saving.then === "function", "保存方法必须返回可等待的 Promise");
  assert.strictEqual(page.data.editor.open, true, "保存完成前不得关闭编辑框");
  rejectSave(new Error("云端保存失败"));
  await saving;
  assert.strictEqual(page.data.editor.open, true, "保存失败后必须保留编辑内容");
  assert.ok(toasts.some(function (item) { return /失败/.test(item.title); }));
});

test("健康页保存等待 Store，失败时保留编辑状态并提示", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  let rejectSave;
  const pending = new Promise(function (_, reject) { rejectSave = reject; });
  const page = loadPage("health", storeStub(data, function () { return pending; }));
  page.data.today = "2026-08-24";
  page.data.editor = { open: true, kind: "ability", id: "", date: "2026-08-20", name: "测试抬头", description: "测试", imageId: "" };
  toasts = [];
  const saving = page.saveEditor();
  assert.ok(saving && typeof saving.then === "function", "保存方法必须返回可等待的 Promise");
  assert.strictEqual(page.data.editor.open, true, "保存完成前不得关闭编辑框");
  rejectSave(new Error("云端保存失败"));
  await saving;
  assert.strictEqual(page.data.editor.open, true, "保存失败后必须保留编辑内容");
  assert.ok(toasts.some(function (item) { return /失败/.test(item.title); }));
});

test("首页成长编辑使用共享范围校验", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  let writes = 0;
  const page = loadPage("home", storeStub(data, function () { writes += 1; return Promise.resolve(); }));
  page.data.editorOpen = true;
  page.data.editorKind = "growth";
  page.data.editorId = "";
  page.data.draft = { date: "2026-08-20", height: "250", weight: "3.8", note: "测试" };
  await page.saveEditor();
  assert.strictEqual(writes, 0);
  assert.strictEqual(page.data.editorOpen, true);
});

test("回忆日期不能早于出生或晚于今天", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  let writes = 0;
  const page = loadPage("memory", storeStub(data, function () { writes += 1; return Promise.resolve(); }));
  page.data.today = "2026-08-24";
  page.data.editorOpen = true;
  page.data.draft = { type: "moment", title: "测试回忆", date: "2026-08-25", description: "虚构测试内容", assetId: "" };
  await page.saveRecord();
  assert.strictEqual(writes, 0);
  assert.strictEqual(page.data.editorOpen, true);
});

test("健康页只显示已选择的疫苗替代路径", function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.vaccines.find(function (item) { return item.scheduleKey === "2m-pentavalent-1"; }).completedDate = "2026-10-04";
  const page = loadPage("health", storeStub(data));
  page.refresh();
  const group = page.data.vaccineGroups.find(function (item) { return item.label === "2月龄"; });
  assert.ok(group);
  assert.strictEqual(group.items.some(function (item) { return item.scheduleKey === "2m-pentavalent-1"; }), true);
  assert.strictEqual(group.items.some(function (item) { return item.scheduleKey === "2m-polio-1"; }), false);
});

test("首页备份刷新失败会清空旧列表并禁用旧恢复入口", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  const store = storeStub(data);
  store.getSyncStatus = function () { return { mode: "cloud", family: { familyId: "family-1", owner: true } }; };
  store.listBackups = function () { return Promise.reject(new Error("模拟列表读取失败")); };
  const page = loadPage("home", store);
  page.data.syncInfo = store.getSyncStatus();
  page.data.backups = [{ backupId: "stale-backup", version: 2 }];
  await page.loadBackups();
  assert.deepStrictEqual(page.data.backups, [], "刷新失败后旧备份不能继续显示为可恢复");
  assert.ok(/失败/.test(page.data.backupError));
});

test("首页导出使用个人版固定文件名并明确为离线存档", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  const store = storeStub(data);
  store.exportFamily = function () {
    return Promise.resolve({ format: "baby-care-family-export-v1", snapshot: { version: 1, data: {} } });
  };
  writtenFiles = [];
  sharedFiles = [];
  toasts = [];
  const page = loadPage("home", store);
  await page.exportFamilyData();
  assert.strictEqual(writtenFiles.length, 1);
  assert.strictEqual(writtenFiles[0].filePath, "/virtual-user-data/Little-Steps-个人数据存档.json");
  assert.deepStrictEqual(sharedFiles[0], {
    filePath: "/virtual-user-data/Little-Steps-个人数据存档.json",
    fileName: "Little-Steps-个人数据存档.json",
  });
  assert.ok(toasts.some(function (item) { return /存档/.test(item.title); }));

  const template = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/home/index.wxml"), "utf8");
  assert.ok(template.includes("导出存档仅供离线保存，当前不能直接导入恢复。"));
});

test("个人版导出失败不暴露底层协作协议文案", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  const store = storeStub(data);
  store.exportFamily = function () { return Promise.reject(new Error("请先加入家庭")); };
  toasts = [];
  const page = loadPage("home", store);
  await page.exportFamilyData();
  assert.ok(toasts.some(function (item) { return item.title === "导出失败，请重试"; }));
});

test("云端恢复已提交但本机重载失败时给出明确恢复提示", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  const store = storeStub(data);
  store.restoreBackup = function () {
    const error = new Error("云端备份已恢复，本机数据尚未重新载入；请重新进入小程序");
    error.code = "RESTORE_REFRESH_REQUIRED";
    error.restoreCommitted = true;
    return Promise.reject(error);
  };
  modals = [];
  toasts = [];
  const page = loadPage("home", store);
  page.data.backups = [{ backupId: "backup-v3", dateLabel: "2026.08.23 10:00" }];
  await page.restoreFamilyBackup({ currentTarget: { dataset: { id: "backup-v3" } } });
  assert.strictEqual(modals.length, 2, "第一次确认恢复，第二次说明云端已恢复但本机需重载");
  assert.strictEqual(modals[0].title, "恢复这份个人备份？");
  assert.strictEqual(modals[1].title, "云端已恢复");
  assert.ok(/重新进入小程序/.test(modals[1].content));
  assert.ok(/不会上传旧数据/.test(modals[1].content));
  assert.strictEqual(toasts.length, 0, "不能再显示‘当前内容未变更’这类错误提示");
});

test("首页删除记录后提供五秒撤销并通过 Store 恢复", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.todos = [{ id: "todo-undo", title: "测试待办", completed: false }];
  let restoredTrashId = "";
  const store = storeStub(data);
  store.remove = function () { return Promise.resolve({ trashId: "trash-todo-undo" }); };
  store.restoreFromTrash = function (trashId) {
    restoredTrashId = trashId;
    return Promise.resolve();
  };
  const page = loadPage("home", store);

  await page.deleteTodo({ currentTarget: { dataset: { id: "todo-undo" } } });
  assert.strictEqual(page.data.undoVisible, true, "删除成功后必须显示撤销条");
  assert.strictEqual(page.data.undoTrashId, "trash-todo-undo");

  await page.undoLastDelete();
  assert.strictEqual(restoredTrashId, "trash-todo-undo", "撤销必须恢复刚删除的回收站记录");
  assert.strictEqual(page.data.undoVisible, false);
});

test("首页换尿布与便便分别统计各自的真实记录", function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.diaperChanges = [
    { id: "diaper-1", time: "2026-08-24T08:00", condition: "湿尿布" },
    { id: "diaper-2", time: "2026-08-24T12:00", condition: "未标注" },
  ];
  data.poops = [{ id: "poop-1", time: "2026-08-24T09:30", status: "偏稀" }];
  data.diapers = [{ id: "legacy-poop", time: "2026-08-24T18:00", status: "旧字段不得继续读取" }];
  const page = loadPage("home", storeStub(data));
  page.now = function () { return new Date("2026-08-24T20:00:00+08:00"); };

  page.refresh();

  assert.deepStrictEqual(page.data.diaper, { latest: "12:00", count: 2 });
  assert.deepStrictEqual(page.data.poop, { latest: "09:30", count: 1 });
});

test("首页快捷记录分别保存换尿布与便便事实", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  const writes = [];
  const page = loadPage("home", storeStub(data, function (collection, record) {
    writes.push({ collection, record });
    return Promise.resolve();
  }));
  page.now = function () { return new Date("2026-08-24T20:15:00+08:00"); };

  await page.quickDiaper();
  await page.quickPoop();

  assert.strictEqual(writes.length, 2);
  assert.deepStrictEqual(writes.map(function (item) { return item.collection; }), ["diaperChanges", "poops"]);
  assert.strictEqual(writes[0].record.time, "2026-08-24T20:15");
  assert.strictEqual(writes[0].record.condition, "未标注");
  assert.strictEqual(writes[1].record.time, "2026-08-24T20:15");
  assert.strictEqual(writes[1].record.status, "未标注");
});

test("首页记录管理器分别列出换尿布与便便", function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.diaperChanges = [{ id: "diaper-manager", time: "2026-08-24T08:20", condition: "湿尿布", note: "更换衣物" }];
  data.poops = [{ id: "poop-manager", time: "2026-08-24T09:40", status: "偏稀", note: "观察饮食" }];
  data.diapers = [{ id: "legacy-manager", time: "2026-08-24T11:00", status: "旧字段" }];
  const page = loadPage("home", storeStub(data));

  page.openManagerKind("diaper");
  assert.strictEqual(page.data.managerTitle, "换尿布记录");
  assert.deepStrictEqual(page.data.managerRecords.map(function (item) { return item.id; }), ["diaper-manager"]);
  assert.strictEqual(page.data.managerRecords[0].detail, "湿尿布");

  page.openManagerKind("poop");
  assert.strictEqual(page.data.managerTitle, "便便记录");
  assert.deepStrictEqual(page.data.managerRecords.map(function (item) { return item.id; }), ["poop-manager"]);
  assert.strictEqual(page.data.managerRecords[0].detail, "偏稀");
});

test("首页换尿布编辑器保存可修改的发生时间与状态", async function () {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  const writes = [];
  const page = loadPage("home", storeStub(data, function (collection, record) {
    writes.push({ collection, record });
    return Promise.resolve();
  }));
  page.now = function () { return new Date("2026-08-24T20:15:00+08:00"); };

  page.openEditor("diaper", null, false);
  assert.strictEqual(page.data.editorTitle, "新增换尿布");
  page.data.draft = { date: "2026-08-24", time: "19:45", condition: "湿尿布", note: "睡前更换" };
  await page.saveEditor();

  assert.strictEqual(writes.length, 1);
  assert.strictEqual(writes[0].collection, "diaperChanges");
  assert.deepStrictEqual(Object.assign({}, writes[0].record, { id: "ignored" }), {
    id: "ignored",
    time: "2026-08-24T19:45",
    condition: "湿尿布",
    note: "睡前更换",
  });
});

test("首页照护区按两列记录与整行健康卡呈现", function () {
  const template = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/home/index.wxml"), "utf8");
  assert.ok(template.includes('data-kind="diaper"'), "换尿布必须是可打开独立记录管理器的卡片");
  assert.ok(template.includes("{{diaper.latest}}"));
  assert.ok(template.includes("{{diaper.count}}"));
  assert.ok(template.includes('catchtap="quickDiaper"'));
  assert.ok(template.includes('data-kind="poop"'));
  assert.ok(template.includes('class="care-card health-wide paper-card"'), "健康卡必须占满整行");
  assert.ok(template.includes("editorKind === 'diaper'"), "换尿布必须使用原生可编辑表单");
  assert.ok(template.includes('range="{{diaperConditions}}"'));
});

test("含媒体的页面删除记录只进入回收站且保留媒体引用", async function () {
  const fixtures = [
    {
      page: "memory",
      collection: "memories",
      id: "memory-soft-delete",
      editor: { editorId: "memory-soft-delete", draft: { assetId: "cloud://memory.jpg", originalAssetId: "cloud://memory.jpg" } },
      remove: function (page) { return page.deleteRecord(); },
    },
    {
      page: "health",
      collection: "abilities",
      id: "ability-soft-delete",
      editor: { editor: { open: true, kind: "ability", id: "ability-soft-delete", imageId: "cloud://ability.jpg", originalImageId: "cloud://ability.jpg" } },
      remove: function (page) { return page.deleteEditor(); },
    },
  ];

  for (const fixture of fixtures) {
    const data = createSeedData("2026-08-24T10:00:00+08:00");
    const removed = [];
    let physicalMediaDeletes = 0;
    const store = storeStub(data);
    store.remove = function (collection, id) {
      removed.push({ collection, id });
      return Promise.resolve({ trashId: "trash-" + id });
    };
    const page = loadPage(fixture.page, store, {
      removeWithMedia: function (options) {
        physicalMediaDeletes += 1;
        return options.persist();
      },
    });
    page.setData(fixture.editor);
    modals = [];

    await fixture.remove(page);

    assert.deepStrictEqual(removed, [{ collection: fixture.collection, id: fixture.id }], fixture.page + " 删除必须直接写入回收站");
    assert.strictEqual(physicalMediaDeletes, 0, fixture.page + " 删除时不得物理清理媒体");
    assert.ok(modals.some(function (item) { return /30\s*天内可恢复/.test(item.content || ""); }), fixture.page + " 必须告知 30 天恢复期");
  }
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
