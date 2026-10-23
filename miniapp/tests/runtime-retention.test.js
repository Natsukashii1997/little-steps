"use strict";

const assert = require("node:assert/strict");

const APP_PATH = require.resolve("../miniprogram/app");
const STORE_PATH = require.resolve("../miniprogram/lib/store");
const MEDIA_PATH = require.resolve("../miniprogram/lib/media");

async function run() {
  const calls = [];
  const currentData = { memories: [{ id: "still-live" }], trashEntries: [], recordHistory: [] };
  const removedTrashEntries = [{ record: { photoIds: ["cloud://test/expired-photo"] } }];
  const removedHistoryEntries = [{ before: { audioId: "cloud://test/expired-audio" } }];

  const store = {
    async init() { calls.push("store.init"); return currentData; },
    getData() { return currentData; },
    async pruneExpiredRecoveryData() {
      calls.push("store.pruneExpiredRecoveryData");
      return { changed: true, data: currentData, removedTrashEntries, removedHistoryEntries };
    },
    getSyncStatus() {
      return { mode: "cloud", familyId: "family-1" };
    },
    async getProtectedMediaReferences() {
      calls.push("store.getProtectedMediaReferences");
      return ["cloud://test/expired-photo"];
    },
    async mutate() { throw new Error("无媒体迁移时不应写入 Store"); },
  };
  const media = {
    configure() { calls.push("media.configure"); },
    mediaReferences(value) {
      calls.push("media.mediaReferences");
      assert.deepEqual(value, { trashEntries: removedTrashEntries, recordHistory: removedHistoryEntries });
      return ["cloud://test/expired-photo", "cloud://test/expired-audio"];
    },
    async removeWithMedia(options) {
      calls.push("media.removeWithMedia");
      assert.deepEqual(options.refs, ["cloud://test/expired-photo", "cloud://test/expired-audio"]);
      assert.deepEqual(options.protectedRefs, ["cloud://test/expired-photo"]);
      assert.equal(await options.persist(), currentData, "物理删除前必须用最新快照复查引用");
      return currentData;
    },
    async flushCleanupQueue(snapshot, options) {
      calls.push("media.flushCleanupQueue");
      assert.equal(snapshot, currentData);
      assert.deepEqual(options.protectedRefs, ["cloud://test/expired-photo"]);
    },
    async migrateSnapshotMedia(snapshot) {
      calls.push("media.migrateSnapshotMedia");
      assert.equal(snapshot, currentData);
      return { changed: false, data: snapshot, originalRefs: [], currentRefs: [] };
    },
    async commitChange() { throw new Error("无媒体迁移时不应提交变更"); },
  };

  const oldStore = require.cache[STORE_PATH];
  const oldMedia = require.cache[MEDIA_PATH];
  const oldApp = global.App;
  const oldWx = global.wx;
  let definition;

  require.cache[STORE_PATH] = { id: STORE_PATH, filename: STORE_PATH, loaded: true, exports: store };
  require.cache[MEDIA_PATH] = { id: MEDIA_PATH, filename: MEDIA_PATH, loaded: true, exports: media };
  global.wx = { showToast() {} };
  global.App = function (value) { definition = value; };

  try {
    delete require.cache[APP_PATH];
    require(APP_PATH);
    assert.ok(definition, "app.js 必须注册小程序");
    definition.onLaunch.call(definition);
    await definition.globalData.ready;
  } finally {
    delete require.cache[APP_PATH];
    if (oldStore) require.cache[STORE_PATH] = oldStore;
    else delete require.cache[STORE_PATH];
    if (oldMedia) require.cache[MEDIA_PATH] = oldMedia;
    else delete require.cache[MEDIA_PATH];
    global.App = oldApp;
    global.wx = oldWx;
  }

  assert.deepEqual(calls, [
    "media.configure",
    "store.init",
    "store.pruneExpiredRecoveryData",
    "media.mediaReferences",
    "store.getProtectedMediaReferences",
    "media.removeWithMedia",
    "media.flushCleanupQueue",
    "media.migrateSnapshotMedia",
  ]);
  await runOfflineProtection();
  console.log("Runtime retention orchestration tests: 2/2 passed");
}

async function runOfflineProtection() {
  const expiredRef = "cloud://test/expired-photo";
  const queuedRef = "cloud://test/queued-audio";
  const currentData = { memories: [], trashEntries: [], recordHistory: [] };
  const store = {
    async init() { return currentData; },
    getData() { return currentData; },
    async pruneExpiredRecoveryData() {
      return {
        changed: true,
        data: currentData,
        removedTrashEntries: [{ record: { photoId: expiredRef } }],
        removedHistoryEntries: [],
      };
    },
    getSyncStatus() { return { mode: "local", familyId: "family-offline" }; },
    async getProtectedMediaReferences() { throw new Error("模拟云端离线"); },
    async mutate() { throw new Error("无媒体迁移时不应写入 Store"); },
  };
  const media = {
    configure() {},
    mediaReferences() { return [expiredRef]; },
    getCleanupQueue() { return [queuedRef]; },
    async removeWithMedia(options) {
      assert.deepEqual(options.protectedRefs, [expiredRef, queuedRef], "云端核对失败时不得删除过期或排队媒体");
      return options.persist();
    },
    async flushCleanupQueue(snapshot, options) {
      assert.equal(snapshot, currentData);
      assert.deepEqual(options.protectedRefs, [expiredRef, queuedRef], "离线时清理队列也必须整体延后");
    },
    async migrateSnapshotMedia(snapshot) {
      return { changed: false, data: snapshot, originalRefs: [], currentRefs: [] };
    },
    async commitChange() { throw new Error("无媒体迁移时不应提交变更"); },
  };

  const oldStore = require.cache[STORE_PATH];
  const oldMedia = require.cache[MEDIA_PATH];
  const oldApp = global.App;
  const oldWx = global.wx;
  const oldWarn = console.warn;
  let definition;
  require.cache[STORE_PATH] = { id: STORE_PATH, filename: STORE_PATH, loaded: true, exports: store };
  require.cache[MEDIA_PATH] = { id: MEDIA_PATH, filename: MEDIA_PATH, loaded: true, exports: media };
  global.wx = { showToast() {} };
  global.App = function (value) { definition = value; };
  console.warn = function () {};

  try {
    delete require.cache[APP_PATH];
    require(APP_PATH);
    definition.onLaunch.call(definition);
    await definition.globalData.ready;
  } finally {
    delete require.cache[APP_PATH];
    if (oldStore) require.cache[STORE_PATH] = oldStore;
    else delete require.cache[STORE_PATH];
    if (oldMedia) require.cache[MEDIA_PATH] = oldMedia;
    else delete require.cache[MEDIA_PATH];
    global.App = oldApp;
    global.wx = oldWx;
    console.warn = oldWarn;
  }
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
