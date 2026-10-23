"use strict";

const assert = require("node:assert/strict");
const retention = require("../miniprogram/lib/retention");

function snapshot() {
  return {
    trashEntries: [
      {
        id: "trash-expired",
        expiresAt: "2026-08-25T00:00:00.000Z",
        record: { id: "memory-old", photoIds: ["cloud://test/expired-photo"] },
      },
      {
        id: "trash-active",
        expiresAt: "2026-09-25T00:00:00.000Z",
        record: { id: "memory-active", photoIds: ["cloud://test/active-photo"] },
      },
      {
        id: "trash-unknown-expiry",
        record: { id: "unknown", title: "缺少到期时间时宁可保留" },
      },
    ],
    recordHistory: [
      {
        id: "history-expired",
        changedAt: "2026-05-27T00:00:00.000Z",
        before: { id: "memory-old", audioId: "cloud://test/expired-audio" },
      },
      {
        id: "history-boundary",
        changedAt: "2026-05-28T00:00:00.000Z",
        before: { id: "memory-boundary", title: "正好 90 天也应到期" },
      },
      {
        id: "history-active",
        changedAt: "2026-05-28T00:00:00.001Z",
        after: { id: "memory-current", title: "仍在 90 天内" },
      },
      {
        id: "history-unknown-time",
        after: { id: "unknown-history", title: "缺少时间时宁可保留" },
      },
    ],
    _deletedRecords: [{ collection: "memories", id: "memory-old", deletedAt: "2026-07-26T00:00:00.000Z" }],
    memories: [{ id: "live", title: "当前数据不能改变" }],
  };
}

function run() {
  const original = snapshot();
  const result = retention.planRetention(original, "2026-08-26T00:00:00.000Z");

  assert.equal(result.changed, true);
  assert.deepEqual(result.data.trashEntries.map((item) => item.id), ["trash-active", "trash-unknown-expiry"]);
  assert.deepEqual(result.data.recordHistory.map((item) => item.id), ["history-active", "history-unknown-time"]);
  assert.deepEqual(result.removedTrashEntries.map((item) => item.id), ["trash-expired"]);
  assert.deepEqual(result.removedHistoryEntries.map((item) => item.id), ["history-expired", "history-boundary"]);
  assert.deepEqual(result.data._deletedRecords, original._deletedRecords, "删除墓碑不能随回收站一起裁剪，否则旧离线设备可能复活数据");
  assert.deepEqual(result.data.memories, original.memories);
  assert.equal(original.trashEntries.length, 3, "保留期计算不得原地修改 Store 快照");
  assert.equal(original.recordHistory.length, 4);

  const stable = retention.planRetention(result.data, "2026-08-26T00:00:00.000Z");
  assert.equal(stable.changed, false, "重复执行保留期裁剪必须幂等");
  assert.deepEqual(stable.removedTrashEntries, []);
  assert.deepEqual(stable.removedHistoryEntries, []);

  assert.throws(function () {
    retention.planRetention(original, "not-a-date");
  }, /清理时间无效/);

  console.log("Retention policy tests: 1/1 passed");
}

run();
