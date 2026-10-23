"use strict";

const assert = require("assert");
const fs = require("node:fs");
const path = require("node:path");
const { createSeedData } = require("../miniprogram/lib/model");

const pages = [
  {
    name: "growth",
    collection: "growthRecords",
    id: "growth-undo",
    prepare: function (page) {
      page.setData({ editor: { open: true, id: "growth-undo", isBirth: false } });
    },
    remove: function (page) { return page.deleteRecord(); },
  },
  {
    name: "memory",
    collection: "memories",
    id: "memory-undo",
    prepare: function (page) {
      page.setData({ editorId: "memory-undo", draft: { assetId: "cloud://memory.jpg", originalAssetId: "cloud://memory.jpg" } });
    },
    remove: function (page) { return page.deleteRecord(); },
  },
  {
    name: "health",
    collection: "abilities",
    id: "ability-undo",
    prepare: function (page) {
      page.setData({ editor: { open: true, kind: "ability", id: "ability-undo", imageId: "cloud://ability.jpg", originalImageId: "cloud://ability.jpg" } });
    },
    remove: function (page) { return page.deleteEditor(); },
  },
];

global.wx = {
  showModal: function (options) {
    if (options && typeof options.success === "function") options.success({ confirm: true, cancel: false });
  },
  showToast: function () {},
  showLoading: function () {},
  hideLoading: function () {},
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

function loadPage(name, store) {
  const pagePath = path.resolve(__dirname, "../miniprogram/pages", name, "index.js");
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", { getHeaderLayout: function () { return { totalHeight: 88 }; } });
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
  restoreStore();
  restoreLayout();
  restoreMedia();

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

function makeStore(data, calls) {
  return {
    getData: function () { return data; },
    subscribe: function () { return function () {}; },
    getSyncStatus: function () { return { mode: "local" }; },
    remove: function (collection, id) {
      calls.removed.push({ collection, id });
      return Promise.resolve({ trashId: "trash-" + id });
    },
    restoreFromTrash: function (trashId) {
      calls.restored.push(trashId);
      return Promise.resolve();
    },
  };
}

async function testDeleteAndUndo(fixture) {
  const calls = { removed: [], restored: [] };
  const page = loadPage(fixture.name, makeStore(createSeedData("2026-08-24T10:00:00+08:00"), calls));
  fixture.prepare(page);

  await fixture.remove(page);

  assert.deepStrictEqual(calls.removed, [{ collection: fixture.collection, id: fixture.id }], fixture.name + " 必须删除正确集合中的记录");
  assert.strictEqual(page.data.undoVisible, true, fixture.name + " 删除后必须显示撤销条");
  assert.strictEqual(page.data.undoTrashId, "trash-" + fixture.id, fixture.name + " 必须保留 Store 返回的回收站 ID");
  assert.ok(page.data.undoToken, fixture.name + " 必须更新撤销组件计时令牌");

  await page.undoLastDelete();

  assert.deepStrictEqual(calls.restored, ["trash-" + fixture.id], fixture.name + " 撤销必须恢复刚删除的回收站记录");
  assert.strictEqual(page.data.undoVisible, false, fixture.name + " 恢复成功后必须隐藏撤销条");
}

async function testLatestDeleteWins(fixture) {
  const calls = { removed: [], restored: [] };
  const page = loadPage(fixture.name, makeStore(createSeedData("2026-08-24T10:00:00+08:00"), calls));
  page.showUndo({ trashId: "trash-first" }, "第一条已删除");
  const firstToken = page.data.undoToken;
  page.showUndo({ trashId: "trash-second" }, "第二条已删除");

  assert.strictEqual(page.data.undoTrashId, "trash-second", fixture.name + " 连续删除时只撤销最后一条");
  assert.notStrictEqual(page.data.undoToken, firstToken, fixture.name + " 新删除必须重置五秒期限");
  await page.undoLastDelete();
  assert.deepStrictEqual(calls.restored, ["trash-second"], fixture.name + " 之前的删除继续留在 30 天回收站");
}

(async function run() {
  for (const fixture of pages) {
    await testDeleteAndUndo(fixture);
    await testLatestDeleteWins(fixture);

    const pageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages", fixture.name, "index.json"), "utf8"));
    const template = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages", fixture.name, "index.wxml"), "utf8");
    assert.ok(pageJson.usingComponents && pageJson.usingComponents["undo-bar"], fixture.name + " 必须注册共享 undo-bar 组件");
    assert.ok(/<undo-bar[\s\S]*bind:undo="undoLastDelete"[\s\S]*bind:expired="onUndoExpired"/.test(template), fixture.name + " 必须接入共享撤销组件的行为事件");
    process.stdout.write("✓ " + fixture.name + " 删除后五秒内可撤销，连续删除时最后一条优先\n");
  }
}()).catch(function (error) {
  process.stderr.write(error.stack + "\n");
  process.exit(1);
});
