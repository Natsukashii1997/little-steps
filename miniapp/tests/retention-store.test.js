"use strict";

const assert = require("node:assert/strict");
const { CURRENT_SCHEMA_VERSION } = require("../miniprogram/lib/model");

const STORE_PATH = require.resolve("../miniprogram/lib/store");
const DATA_KEY = "little-steps-miniapp-family-v1";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function baseData() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    baby: { name: "测试宝宝", avatarId: "" },
    memories: [], todos: [], feedings: [], sleeps: [], diapers: [], diaperChanges: [], poops: [], supplements: [],
    growthRecords: [], vaccines: [], abilities: [], checkups: [],
    trashEntries: [{
      id: "trash-expired",
      collection: "memories",
      recordId: "memory-expired",
      expiresAt: "2026-08-25T00:00:00.000Z",
      record: { id: "memory-expired", photoIds: ["cloud://test/expired-photo"] },
    }],
    recordHistory: [{
      id: "history-expired",
      collection: "memories",
      recordId: "memory-expired",
      changedAt: "2026-05-27T00:00:00.000Z",
      before: { id: "memory-expired", audioId: "cloud://test/expired-audio" },
    }],
    _updatedSections: {},
    _deletedRecords: [{ collection: "memories", id: "memory-expired", deletedAt: "2026-08-01T00:00:00.000Z" }],
    updatedAt: "2026-08-25T00:00:00.000Z",
  };
}

function freshStore(storage) {
  delete require.cache[STORE_PATH];
  global.wx = {
    getStorageSync(key) { return clone(storage.get(key)); },
    setStorageSync(key, value) { storage.set(key, clone(value)); },
  };
  return require(STORE_PATH);
}

async function run() {
  const storage = new Map();
  storage.set(DATA_KEY, baseData());
  const store = freshStore(storage);
  await store.init({ config: { useCloud: false, envId: "" } });

  assert.equal(typeof store.pruneExpiredRecoveryData, "function", "Store 必须公开自动过期清理入口");
  const result = await store.pruneExpiredRecoveryData({ now: "2026-08-26T00:00:00.000Z" });

  assert.equal(result.changed, true);
  assert.deepEqual(result.removedTrashEntries.map((item) => item.id), ["trash-expired"]);
  assert.deepEqual(result.removedHistoryEntries.map((item) => item.id), ["history-expired"]);
  assert.equal(store.getData().trashEntries.length, 0);
  assert.equal(store.getData().recordHistory.length, 0);
  assert.equal(store.getData()._deletedRecords.length, 1, "跨设备防复活墓碑必须保留");
  assert.equal(storage.get(DATA_KEY).trashEntries.length, 0, "裁剪结果必须持久化，重启不能回来");

  const stable = await store.pruneExpiredRecoveryData({ now: "2026-08-26T00:00:00.000Z" });
  assert.equal(stable.changed, false, "应用每次启动都能安全重复执行");

  delete global.wx;
  console.log("Store retention integration tests: 1/1 passed");
}

run().catch(function (error) {
  delete global.wx;
  console.error(error);
  process.exitCode = 1;
});
