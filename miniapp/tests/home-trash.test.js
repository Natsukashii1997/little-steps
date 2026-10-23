"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSeedData } = require("../miniprogram/lib/model");

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

function loadHome(store) {
  const pagePath = path.resolve(__dirname, "../miniprogram/pages/home/index.js");
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", {
    getHeaderLayout: function () { return { totalHeight: 88 }; },
  });
  const restoreMedia = replaceModule("../miniprogram/lib/media", {});
  let definition;
  global.Page = function (value) { definition = value; };
  delete require.cache[pagePath];
  require(pagePath);
  delete require.cache[pagePath];
  restoreStore(); restoreLayout(); restoreMedia();
  const page = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData: function (updates) {
      Object.keys(updates || {}).forEach((key) => setAtPath(this.data, key, updates[key]));
    },
  };
  Object.keys(definition).forEach(function (key) {
    if (typeof definition[key] === "function") page[key] = definition[key].bind(page);
  });
  return page;
}

const toasts = [];
global.wx = {
  showToast: function (options) { toasts.push(options || {}); },
};

async function run() {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.trashEntries = [
    {
      id: "trash-active",
      collection: "todos",
      recordId: "todo-1",
      record: { id: "todo-1", title: "虚构测试待办" },
      deletedAt: "2026-08-23T10:00:00+08:00",
      expiresAt: "2026-09-22T10:00:00+08:00",
    },
    {
      id: "trash-expired",
      collection: "memories",
      recordId: "memory-old",
      record: { id: "memory-old", title: "已过期记录" },
      deletedAt: "2026-07-01T10:00:00+08:00",
      expiresAt: "2026-07-31T10:00:00+08:00",
    },
  ];
  const restored = [];
  const store = {
    getData: function () { return data; },
    getSyncStatus: function () { return { mode: "local", family: null }; },
    restoreFromTrash: function (trashId) {
      restored.push(trashId);
      data.trashEntries = data.trashEntries.filter(function (entry) { return entry.id !== trashId; });
      return Promise.resolve();
    },
  };
  const page = loadHome(store);
  page.now = function () { return new Date("2026-08-24T12:00:00+08:00"); };

  page.openSync();
  assert.equal(page.data.trashEntries.length, 1, "回收站只能显示仍在 30 天恢复期内的记录");
  assert.equal(page.data.trashEntries[0].id, "trash-active");
  assert.equal(page.data.trashEntries[0].typeLabel, "待办");
  assert.equal(page.data.trashEntries[0].title, "虚构测试待办");
  assert.match(page.data.trashEntries[0].expiryLabel, /29天/);

  await page.restoreTrashEntry({ currentTarget: { dataset: { id: "trash-active" } } });
  assert.deepEqual(restored, ["trash-active"], "恢复按钮必须调用 Store 的公开恢复接口");
  assert.equal(page.data.trashEntries.length, 0, "恢复后条目必须立即从回收站列表消失");
  assert.ok(toasts.some(function (item) { return item.title === "已恢复到原位置"; }));

  const template = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/home/index.wxml"), "utf8");
  assert.ok(template.includes("最近删除"), "家庭/数据面板必须提供普通用户可找到的回收站入口");
  assert.ok(template.includes('bindtap="restoreTrashEntry"'), "每条未过期记录必须有真实恢复按钮");
  console.log("Home trash recovery tests: 1/1 passed");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
