"use strict";

const assert = require("node:assert/strict");

// HANDOFF 2026-10-23：S1 启动只加载自己的存储并清理本地软删除记录。
// 旧家庭同步与媒体清理由各自模块测试保留覆盖，当前 app 不触发它们。
const APP_PATH = require.resolve("../miniprogram/app");
const REPO_PATH = require.resolve("../miniprogram/lib/v5/repo");
const FONT_PATH = require.resolve("../miniprogram/lib/v5/font");
const STORE_PATH = require.resolve("../miniprogram/lib/store");
const MEDIA_PATH = require.resolve("../miniprogram/lib/media");

async function checkLaunch(failureAt, expectedCalls) {
  const calls = [];
  const repo = {
    load() {
      calls.push("repo.load");
      if (failureAt === "load") throw new Error("synthetic-read-failure");
    },
    purgeDeleted() {
      calls.push("repo.purgeDeleted");
      if (failureAt === "purge") throw new Error("synthetic-cleanup-failure");
    },
  };
  const font = {
    loadFonts() { calls.push("font.loadFonts"); return Promise.resolve(true); },
  };
  const legacy = new Proxy({}, {
    get() { throw new Error("S1 不得调用旧存储与媒体模块"); },
  });
  const replacements = [[REPO_PATH, repo], [FONT_PATH, font], [STORE_PATH, legacy], [MEDIA_PATH, legacy]];
  const savedModules = new Map([APP_PATH, ...replacements.map(([file]) => file)].map(file => [file, require.cache[file]]));
  const oldApp = global.App;
  const oldWx = global.wx;
  const oldWarn = console.warn;
  let definition;
  for (const [file, exports] of replacements) require.cache[file] = { id: file, filename: file, loaded: true, exports };
  global.App = value => { definition = value; };
  global.wx = { cloud: { init() { throw new Error("S1 不得初始化云环境"); } } };
  console.warn = () => { calls.push("read-warning"); };
  try {
    delete require.cache[APP_PATH];
    require(APP_PATH);
    assert.ok(definition, "app.js 必须注册小程序");
    definition.onLaunch.call(definition);
    await Promise.resolve();
    assert.equal(definition.globalData.fontReady, true, "读取或清理故障也不妨碍字体与页面恢复");
    assert.deepEqual(calls, expectedCalls);
  } finally {
    for (const [file, original] of savedModules) {
      if (original) require.cache[file] = original;
      else delete require.cache[file];
    }
    global.App = oldApp;
    global.wx = oldWx;
    console.warn = oldWarn;
  }
}

async function run() {
  await checkLaunch(null, ["repo.load", "repo.purgeDeleted", "font.loadFonts"]);
  await checkLaunch("load", ["repo.load", "read-warning", "font.loadFonts"]);
  await checkLaunch("purge", ["repo.load", "repo.purgeDeleted", "read-warning", "font.loadFonts"]);
  console.log("S1 runtime retention orchestration tests: 3/3 passed");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
