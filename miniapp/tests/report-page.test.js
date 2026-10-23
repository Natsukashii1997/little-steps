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

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadReportPage(store) {
  const pagePath = path.resolve(__dirname, "../miniprogram/pages/report/index.js");
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", { getHeaderLayout: function () { return { totalHeight: 88 }; } });
  let definition;
  global.Page = function (value) { definition = value; };
  delete require.cache[pagePath];
  require(pagePath);
  delete require.cache[pagePath];
  restoreStore();
  restoreLayout();
  const page = {
    data: clone(definition.data),
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

function createCanvas() {
  const context = new Proxy({
    measureText: function (value) { return { width: String(value || "").length * 14 }; },
  }, {
    get: function (target, key) {
      if (key in target) return target[key];
      return function () {};
    },
    set: function (target, key, value) { target[key] = value; return true; },
  });
  return { width: 0, height: 0, getContext: function () { return context; } };
}

let exportFailure = false;
let exportCalls = 0;
let previewCalls = [];
let savedCalls = [];
let sharedCalls = [];
let toasts = [];
const canvas = createCanvas();

global.getApp = function () { return { globalData: { ready: Promise.resolve() } }; };
global.wx = {
  getSystemInfoSync: function () { return { pixelRatio: 2 }; },
  createSelectorQuery: function () {
    return {
      in: function () { return this; },
      select: function () { return this; },
      fields: function () { return this; },
      exec: function (callback) { callback([{ node: canvas, width: 345, height: 1200 }]); },
    };
  },
  canvasToTempFilePath: function (options) {
    exportCalls += 1;
    if (exportFailure) options.fail({ errMsg: "canvas export failed" });
    else options.success({ tempFilePath: "/tmp/硕之成长摘要.png" });
  },
  previewImage: function (options) {
    previewCalls.push({ current: options.current, urls: options.urls });
    options.success();
  },
  saveImageToPhotosAlbum: function (options) {
    savedCalls.push(options.filePath);
    options.success();
  },
  showShareImageMenu: function (options) {
    sharedCalls.push(options.path);
    options.success();
  },
  showLoading: function () {},
  hideLoading: function () {},
  showToast: function (options) { toasts.push(options || {}); },
  navigateBack: function () {},
};

function fixtureData() {
  const data = createSeedData("2026-08-24T12:00:00+08:00");
  data.feedings = [{ id: "f1", time: "2026-08-24T08:00", amount: 120, milkType: "配方奶" }];
  data.sleeps = [{ id: "s1", start: "2026-08-24T09:00", end: "2026-08-24T10:30" }];
  data.diaperChanges = [{ id: "d1", time: "2026-08-24T10:40", condition: "湿尿布" }];
  data.poops = [{ id: "p1", time: "2026-08-24T11:00", status: "正常软便" }];
  data.supplements = [{ id: "v1", name: "维生素 D", date: "2026-08-24", completed: true }];
  data.growthRecords.push({ id: "g1", date: "2026-08-24", height: 50, weight: 3.1, note: "测试" });
  data.memories = [{ id: "m1", date: "2026-08-23", title: "测试回忆", description: "只用于验收" }];
  data.todos = [{ id: "t1", title: "测试待办", completed: true }];
  return data;
}

async function run() {
  const data = fixtureData();
  const store = {
    init: async function () {},
    getData: function () { return data; },
  };

  exportFailure = false;
  exportCalls = 0;
  previewCalls = [];
  savedCalls = [];
  sharedCalls = [];
  toasts = [];
  const page = loadReportPage(store);
  await page.onLoad();
  assert.deepEqual(page.data.selectedModules, ["care", "growth", "health"], "成长摘要页应默认勾选已确认视觉稿中的前三类核心摘要");
  assert.deepEqual(page.data.moduleOptions.map(function (item) { return item.selected; }), [true, true, true, false, false], "默认勾选状态必须与可见复选框一致");
  page.handleStartDate({ detail: { value: "2026-08-20" } });
  page.handleEndDate({ detail: { value: "2026-08-24" } });
  page.handleModuleChange({ detail: { value: ["care", "growth"] } });
  await page.generateReport();

  assert.deepEqual(page.data.reportSections.map(function (section) { return section.key; }), ["care", "growth"], "长图只能包含使用者显式勾选的摘要模块");
  assert.deepEqual(page.data.reportSections[0].lines, [
    "喂养 1 次 · 共 120 ml",
    "睡眠 1 小时 30 分钟",
    "换尿布 1 次 · 便便 1 次",
    "Vitamin D 已确认 1 天",
  ], "照护摘要必须来自所选日期范围内的真实记录");
  assert.match(page.data.reportSections[1].lines.join(""), /3\.1 kg.*50 cm/, "成长摘要必须使用真实成长记录");
  assert.equal(exportCalls, 1, "必须经由真实 canvas 导出临时图片");
  assert.deepEqual(previewCalls, [{ current: "/tmp/硕之成长摘要.png", urls: ["/tmp/硕之成长摘要.png"] }], "生成后必须调用微信真实图片预览");
  assert.equal(page.data.generatedImagePath, "/tmp/硕之成长摘要.png");
  assert.equal(JSON.stringify(page.data.reportSections).includes("测试回忆"), false, "未勾选的回忆不得泄露到长图摘要");

  await page.saveGeneratedReport();
  assert.deepEqual(savedCalls, ["/tmp/硕之成长摘要.png"], "生成的长图应能使用微信保存到相册");
  await page.shareGeneratedReport();
  assert.deepEqual(sharedCalls, ["/tmp/硕之成长摘要.png"], "生成的长图应能进入微信真实图片分享菜单");

  const noSelectionPage = loadReportPage(store);
  await noSelectionPage.onLoad();
  noSelectionPage.handleModuleChange({ detail: { value: [] } });
  const beforeValidation = exportCalls;
  await noSelectionPage.generateReport();
  assert.equal(exportCalls, beforeValidation, "未选择摘要模块时不得导出空图");
  assert.match(noSelectionPage.data.reportError, /至少选择/);

  exportFailure = true;
  const failedPage = loadReportPage(store);
  await failedPage.onLoad();
  failedPage.handleModuleChange({ detail: { value: ["memory"] } });
  const previewCountBeforeFailure = previewCalls.length;
  await failedPage.generateReport();
  assert.equal(previewCalls.length, previewCountBeforeFailure, "导出失败不得打开预览或假装成功");
  assert.match(failedPage.data.reportError, /生成失败/);
  assert.equal(toasts.some(function (item) { return item.icon === "success" && /已生成/.test(item.title || ""); }), true, "前一次真实成功应有成功反馈");
  assert.equal(toasts.slice(-1)[0].icon, "none", "失败时必须是错误反馈，不得显示成功");

  const template = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/report/index.wxml"), "utf8");
  assert.ok(template.includes('<app-header page-title="成长摘要"'), "报告页必须复用统一顶部组件");
  assert.ok(template.includes('<app-tabbar active-page="home"'), "报告页必须复用统一底部导航组件");
  assert.ok(template.includes("headerHeight + 12"), "报告正文必须使用统一顶部安全间距，避免标题重叠");
  assert.ok(template.includes("把成长，轻轻装进一张图"), "报告页首屏必须保留已确认视觉稿的信息层级");
  assert.ok(template.includes("选择日期") && template.includes("选择想分享的内容"), "报告页必须保留紧凑的两步选择结构");
  assert.ok(template.includes('checkbox-group bindchange="handleModuleChange"'), "报告页必须由使用者显式选择摘要模块");
  assert.ok(template.includes('type="2d"') && template.includes('id="reportCanvas"'), "报告页必须使用原生 2D Canvas");
  assert.ok(template.includes('bindtap="saveGeneratedReport"'), "生成后必须提供真实保存入口");
  assert.ok(template.includes('bindtap="shareGeneratedReport"'), "生成后必须提供真实分享入口");

  const appConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../miniprogram/app.json"), "utf8"));
  assert.ok(appConfig.pages.includes("pages/report/index"), "分享长图必须有可到达的小程序页面");
  const homeTemplate = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/home/index.wxml"), "utf8");
  const homeSource = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/home/index.js"), "utf8");
  assert.ok(homeTemplate.includes('bindtap="openReport"'), "首页必须提供清晰的成长摘要入口");
  assert.match(homeSource, /openReport\(\)\s*\{\s*wx\.navigateTo\(\{\s*url:\s*"\/pages\/report\/index"/, "首页入口必须打开真实报告页面");
  console.log("Report page tests: 3/3 passed");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
