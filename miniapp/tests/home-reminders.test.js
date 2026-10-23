"use strict";

const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const { createSeedData } = require("../miniprogram/lib/model");

let launched = [];
global.wx = {
  reLaunch: function (options) { launched.push(options.url); },
  showToast: function () {},
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

function loadHome(store) {
  const pagePath = path.resolve(__dirname, "../miniprogram/pages/home/index.js");
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", { getHeaderLayout: function () { return { totalHeight: 88 }; } });
  const restoreMedia = replaceModule("../miniprogram/lib/media", {});
  let definition;
  global.Page = function (value) { definition = value; };
  delete require.cache[pagePath];
  require(pagePath);
  delete require.cache[pagePath];
  restoreStore(); restoreLayout(); restoreMedia();
  const page = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData: function (updates, callback) {
      Object.keys(updates || {}).forEach((key) => setAtPath(this.data, key, updates[key]));
      if (callback) callback.call(this);
    },
  };
  Object.keys(definition).forEach(function (key) {
    if (typeof definition[key] === "function") page[key] = definition[key].bind(page);
  });
  return page;
}

function run() {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.vaccines = [
    { id: "v-overdue", name: "乙肝疫苗", dose: "第1/3针", dueDate: "2026-08-20", completedDate: "" },
    { id: "v-overdue", name: "乙肝疫苗", dose: "第1/3针", dueDate: "2026-08-20", completedDate: "" },
    { id: "v-upcoming", name: "乙肝疫苗", dose: "第2/3针", dueDate: "2026-09-04", completedDate: "" },
    { id: "v-later", name: "脊灰疫苗", dose: "第1/4针", dueDate: "2026-10-04", completedDate: "" },
    { id: "v-done", name: "卡介苗", dose: "第1/1针", dueDate: "2026-08-04", completedDate: "2026-08-04" },
  ];
  data.checkups = [
    { id: "checkup-soon", name: "满月儿保", date: "2026-08-26", completedDate: "" },
  ];
  data.todos = [
    { id: "todo-open", title: "准备宝宝手册", completed: false },
    { id: "todo-done", title: "已经完成", completed: true },
  ];
  const store = {
    getData: function () { return data; },
    getSyncStatus: function () { return { mode: "local", family: null }; },
  };
  const page = loadHome(store);
  page.now = function () { return new Date("2026-08-24T12:00:00+08:00"); };

  page.refresh();
  assert.deepStrictEqual(
    page.data.reminders.map(function (item) { return item.key; }),
    ["vaccine:v-overdue", "checkup:checkup-soon", "vaccine:v-upcoming", "todo:todo-open"],
    "提醒必须按唯一记录去重，只显示未完成且已到期或未来 14 天内的事项",
  );

  page.openNotices();
  assert.strictEqual(page.data.noticeOpen, true);
  page.openReminder({ currentTarget: { dataset: { type: "todo", id: "todo-open" } } });
  assert.strictEqual(page.data.noticeOpen, false);
  assert.strictEqual(page.data.editorKind, "todo");
  assert.strictEqual(page.data.editorId, "todo-open");

  launched = [];
  page.openReminder({ currentTarget: { dataset: { type: "checkup", id: "checkup-soon" } } });
  assert.deepStrictEqual(launched, ["/pages/health/index?tab=checkup"], "健康提醒必须直接打开准确标签页");

  const homeTemplate = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/home/index.wxml"), "utf8");
  const headerTemplate = fs.readFileSync(path.resolve(__dirname, "../miniprogram/components/app-header/index.wxml"), "utf8");
  assert.ok(homeTemplate.includes('bind:notice="openNotices"'));
  assert.ok(homeTemplate.includes('bindtap="openReminder"'));
  assert.ok(headerTemplate.includes('wx:if="{{noticeUnread}}"'), "没有真实提醒时不能显示假红点");
  console.log("Home reminder tests: 1/1 passed");
}

run();
