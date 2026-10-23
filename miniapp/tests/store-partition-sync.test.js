"use strict";

const assert = require("node:assert/strict");
const { CURRENT_SCHEMA_VERSION } = require("../miniprogram/lib/model");

const STORE_PATH = require.resolve("../miniprogram/lib/store");
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function baseData() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    baby: { name: "测试宝宝", avatarId: "" },
    memories: [], todos: [], feedings: [], sleeps: [], diapers: [], diaperChanges: [], poops: [], supplements: [],
    growthRecords: [], vaccines: [], abilities: [], checkups: [],
    trashEntries: [], recordHistory: [], _updatedSections: {}, _deletedRecords: [],
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
}

function createPartitionBoundary(options) {
  const storage = options.storage;
  const callLog = options.callLog || [];
  const remote = options.remote || { manifestRevision: 0, partitionRevisions: {}, partitions: [], conflicts: [] };
  return {
    getStorageSync(key) { return clone(storage.get(key)); },
    setStorageSync(key, value) { storage.set(key, clone(value)); },
    cloud: {
      init() {},
      callFunction(request) {
        Promise.resolve().then(function () {
          const event = clone(request.data || {});
          callLog.push(event);
          const family = {
            familyId: "family-1", owner: true, role: "owner", memberCount: 1, maxMembers: 6,
            members: [{ memberId: "owner-openid", nickname: "爸爸", relation: "父亲", role: "owner", status: "active" }],
          };
          if (event.action === "bootstrap") {
            request.success({ result: { ok: true, openId: "owner-openid", joined: true, family } });
            return;
          }
          if (event.action === "load") {
            request.success({ result: { ok: true, openId: "owner-openid", family, snapshot: { version: 0, data: baseData() } } });
            return;
          }
          if (event.action === "loadPartitions") {
            request.success({ result: {
              ok: true, openId: "owner-openid", family, partitioned: true,
              manifestRevision: remote.manifestRevision,
              partitionRevisions: clone(remote.partitionRevisions),
              partitions: clone(remote.partitions), conflicts: clone(remote.conflicts),
            } });
            return;
          }
          if (event.action === "syncPartitions") {
            const results = event.operations.map(function (operation) {
              remote.manifestRevision += 1;
              remote.partitionRevisions[operation.partitionKey] = (remote.partitionRevisions[operation.partitionKey] || 0) + 1;
              return {
                operationId: operation.operationId,
                duplicate: false,
                partitionKey: operation.partitionKey,
                partitionRevision: remote.partitionRevisions[operation.partitionKey],
                manifestRevision: remote.manifestRevision,
                conflicts: [],
              };
            });
            request.success({ result: {
              ok: true, synced: true, results,
              manifestRevision: remote.manifestRevision,
              partitionRevisions: clone(remote.partitionRevisions),
            } });
            return;
          }
          request.fail(new Error("Unexpected familyApi action: " + event.action));
        });
      },
    },
  };
}

function freshStore(boundary) {
  delete require.cache[STORE_PATH];
  global.wx = boundary;
  return require(STORE_PATH);
}

function createTailPullRaceBoundary(options) {
  const remote = options.remote;
  const callLog = options.callLog || [];
  const boundary = createPartitionBoundary({ storage: options.storage, callLog, remote });
  const callFunction = boundary.cloud.callFunction;
  let loadPartitionsCount = 0;
  let pendingTailPull = null;
  let resolveTailStarted;
  const tailStarted = new Promise(function (resolve) { resolveTailStarted = resolve; });

  function applyMemoryOperations(operations) {
    (operations || []).filter(function (operation) {
      return operation.collection === "memories";
    }).forEach(function (operation) {
      let partition = remote.partitions.find(function (item) {
        return item.partitionKey === operation.partitionKey;
      });
      if (!partition) {
        partition = {
          partitionKey: operation.partitionKey,
          collection: "memories",
          revision: 0,
          recordEntries: [],
        };
        remote.partitions.push(partition);
      }
      const entries = partition.recordEntries || [];
      const index = entries.findIndex(function (entry) { return entry.recordId === operation.recordId; });
      if (operation.kind === "delete") {
        partition.recordEntries = entries.filter(function (entry) { return entry.recordId !== operation.recordId; });
        return;
      }
      const current = index === -1 ? {} : entries[index].value;
      const next = { recordId: operation.recordId, value: Object.assign({}, current, clone(operation.changes)) };
      if (index === -1) entries.push(next);
      else entries[index] = next;
      partition.recordEntries = entries;
    });
  }

  boundary.cloud.callFunction = function (request) {
    const event = request.data || {};
    if (event.action === "syncPartitions") applyMemoryOperations(event.operations);
    if (event.action === "loadPartitions") {
      loadPartitionsCount += 1;
      if (loadPartitionsCount === 2) {
        pendingTailPull = request;
        resolveTailStarted();
        return;
      }
    }
    callFunction(request);
  };

  return {
    boundary,
    callLog,
    tailStarted,
    releaseTailPull() {
      const request = pendingTailPull;
      pendingTailPull = null;
      callFunction(request);
    },
  };
}

function createControlledExportBoundary(options) {
  const callLog = [];
  const remote = { manifestRevision: 0, partitionRevisions: {}, partitions: [], conflicts: [] };
  const boundary = createPartitionBoundary({ storage: options.storage, callLog, remote });
  const callFunction = boundary.cloud.callFunction;
  let pendingSync = null;
  let resolveSyncStarted;
  const syncStarted = new Promise(function (resolve) { resolveSyncStarted = resolve; });

  boundary.cloud.callFunction = function (request) {
    const event = clone(request.data || {});
    if (event.action === "syncPartitions" && !pendingSync) {
      pendingSync = request;
      resolveSyncStarted();
      return;
    }
    if (event.action === "exportFamily") {
      callLog.push(event);
      Promise.resolve().then(function () {
        request.success({ result: { ok: true, export: {
          format: "baby-care-family-export-v1",
          snapshot: { version: remote.manifestRevision, data: baseData() },
        } } });
      });
      return;
    }
    callFunction(request);
  };

  return {
    boundary,
    callLog,
    syncStarted,
    releaseSyncSuccess() {
      const request = pendingSync;
      pendingSync = null;
      callFunction(request);
    },
    releaseSyncFailure() {
      const request = pendingSync;
      pendingSync = null;
      callLog.push(clone(request.data || {}));
      Promise.resolve().then(function () { request.fail(new Error("模拟增量同步失败")); });
    },
  };
}

async function offlineRecordUsesDurableOutboxAndIncrementalSyncAfterRestart() {
  const storage = new Map();
  let store = freshStore(createPartitionBoundary({ storage }));
  await store.init({ config: { useCloud: false, envId: "" } });
  await store.upsert("memories", {
    id: "memory-offline",
    title: "离线保存的笑脸",
    date: "2026-08-24",
    description: "虚构测试记录",
  }, { now: "2026-08-24T09:00:00.000Z", actorId: "owner-openid" });

  assert.equal(store.getData().memories[0].title, "离线保存的笑脸", "断网时本机写入必须先成功");
  assert.equal(store.getSyncStatus().outboxCount > 0, true, "离线操作必须进入持久待同步队列");
  const durableContext = storage.get("little-steps-miniapp-family-context-v1");
  const operationIds = durableContext.outbox.map(function (item) { return item.operationId; });
  assert.equal(operationIds.length > 0, true);

  const callLog = [];
  store = freshStore(createPartitionBoundary({ storage, callLog }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });

  assert.equal(store.getData().memories.some(function (item) { return item.id === "memory-offline"; }), true);
  assert.equal(store.getSyncStatus().outboxCount, 0, "服务端确认后才可清空待同步队列");
  assert.equal(callLog.some(function (item) { return item.action === "save"; }), false, "日常单条记录不得上传完整家庭快照");
  const incremental = callLog.find(function (item) { return item.action === "syncPartitions"; });
  assert.ok(incremental, "网络恢复后应自动增量同步");
  assert.equal(incremental.operations.some(function (item) {
    return item.collection === "memories" && item.recordId === "memory-offline" && item.partitionKey === "memories/2026-08";
  }), true);
  assert.deepEqual(
    incremental.operations.map(function (item) { return item.operationId; }).sort(),
    operationIds.sort(),
    "重启后必须重放原 operationId，而不是生成可能重复的新操作",
  );
}

async function localEditDuringTailPullIsPreservedAndContinuesSyncing() {
  const storage = new Map();
  const remote = {
    manifestRevision: 1,
    partitionRevisions: { "memories/2026-08": 1 },
    partitions: [{
      partitionKey: "memories/2026-08",
      collection: "memories",
      revision: 1,
      recordEntries: [{ recordId: "memory-race", value: {
        id: "memory-race",
        title: "云端旧内容",
        date: "2026-08-24",
        description: "竞态测试",
        _updatedAt: "2026-08-24T08:00:00.000Z",
      } }],
    }],
    conflicts: [],
  };
  const harness = createTailPullRaceBoundary({ storage, remote });
  const store = freshStore(harness.boundary);
  await store.init({ config: { useCloud: true, envId: "test-env" } });

  await store.upsert("memories", {
    id: "memory-race",
    title: "已上传版本",
    date: "2026-08-24",
    description: "竞态测试",
  }, { now: "2026-08-24T09:00:00.000Z", actorId: "owner-openid" });
  await harness.tailStarted;

  await store.upsert("memories", {
    id: "memory-race",
    title: "拉取期间的新编辑",
    date: "2026-08-24",
    description: "竞态测试",
  }, { now: "2026-08-24T10:00:00.000Z", actorId: "owner-openid" });
  harness.releaseTailPull();
  await store.syncNow();

  assert.equal(store.getData().memories.find(function (item) {
    return item.id === "memory-race";
  }).title, "拉取期间的新编辑", "尾部拉取不得用旧云端内容覆盖拉取期间的本地编辑");
  assert.equal(store.getSyncStatus().outboxCount, 0, "拉取期间新增的操作必须在同一轮同步中继续上传");
  assert.equal(storage.get("little-steps-miniapp-family-context-v1").dirty, false, "只有 outbox 真正清空后才能标记已同步");
  const syncCalls = harness.callLog.filter(function (item) { return item.action === "syncPartitions"; });
  assert.equal(syncCalls.length, 2, "拉取窗口中出现新操作时必须自动继续一轮增量同步");
  assert.equal(syncCalls[1].operations.some(function (operation) {
    return operation.recordId === "memory-race" && operation.changes.title === "拉取期间的新编辑";
  }), true);
}

async function exportWaitsForPendingPartitionSync() {
  const storage = new Map();
  const harness = createControlledExportBoundary({ storage });
  const store = freshStore(harness.boundary);
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await store.upsert("memories", {
    id: "memory-before-export",
    title: "导出前必须上传",
    date: "2026-08-24",
  }, { now: "2026-08-24T11:00:00.000Z", actorId: "owner-openid" });
  await harness.syncStarted;

  const exporting = store.exportFamily();
  harness.releaseSyncSuccess();
  const exported = await exporting;

  assert.equal(exported.format, "baby-care-family-export-v1");
  const actions = harness.callLog.map(function (item) { return item.action; });
  assert.equal(actions.indexOf("syncPartitions") < actions.indexOf("exportFamily"), true,
    "存在待同步操作时必须先完成上传，再向云端请求导出");
}

async function exportRejectsWhenPendingPartitionSyncFails() {
  const storage = new Map();
  const harness = createControlledExportBoundary({ storage });
  const store = freshStore(harness.boundary);
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await store.upsert("memories", {
    id: "memory-export-failure",
    title: "同步失败时不得导出",
    date: "2026-08-24",
  }, { now: "2026-08-24T12:00:00.000Z", actorId: "owner-openid" });
  await harness.syncStarted;

  const exporting = store.exportFamily();
  harness.releaseSyncFailure();
  await assert.rejects(exporting, function (error) {
    return error && error.code === "EXPORT_SYNC_FAILED"
      && /同步失败/.test(error.message)
      && /未导出/.test(error.message)
      && /检查网络/.test(error.message);
  }, "导出前同步失败时必须给出可理解、可操作的拒绝原因");
  assert.equal(harness.callLog.some(function (item) { return item.action === "exportFamily"; }), false,
    "待同步数据上传失败时不得请求云端导出旧数据");
}

async function familyManagementWrappersPassIdentityAndRefreshContext() {
  const storage = new Map();
  const callLog = [];
  const boundary = createPartitionBoundary({ storage, callLog });
  const original = boundary.cloud.callFunction;
  boundary.cloud.callFunction = function (request) {
    const action = request.data.action;
    if (["createFamily", "join", "updateMember", "setBackupAdmin"].includes(action)) {
      callLog.push(clone(request.data));
      const members = [{ memberId: "owner-openid", nickname: "爸爸", relation: "父亲", role: "owner", status: "active" }];
      Promise.resolve().then(function () {
        request.success({ result: { ok: true, openId: "owner-openid", family: {
          familyId: "family-1", owner: true, role: "owner", memberCount: 1, maxMembers: 6, members,
        } } });
      });
      return;
    }
    original(request);
  };
  const store = freshStore(boundary);
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await store.createFamily({ nickname: "爸爸", relation: "父亲" });
  await store.joinFamily("ABC234", { nickname: "外婆", relation: "外婆" });
  await store.updateFamilyMember("member-2", { nickname: "硕之外婆", relation: "外婆" });
  await store.setBackupAdmin("member-2");

  assert.deepEqual(callLog.find((item) => item.action === "createFamily"), {
    action: "createFamily", nickname: "爸爸", relation: "父亲",
  });
  assert.deepEqual(callLog.find((item) => item.action === "join"), {
    action: "join", inviteCode: "ABC234", nickname: "外婆", relation: "外婆",
  });
  assert.deepEqual(callLog.find((item) => item.action === "updateMember"), {
    action: "updateMember", familyId: "family-1", memberId: "member-2", nickname: "硕之外婆", relation: "外婆",
  });
  assert.deepEqual(callLog.find((item) => item.action === "setBackupAdmin"), {
    action: "setBackupAdmin", familyId: "family-1", memberId: "member-2",
  });
}

async function completeBackupWrappersUsePartitionRevisionAndRefreshRestoredData() {
  const storage = new Map();
  const callLog = [];
  const remote = {
    manifestRevision: 5,
    partitionRevisions: { core: 1, "memories/2026-08": 2 },
    partitions: [{
      partitionKey: "core", collection: "__core__", revision: 1,
      recordEntries: [{ recordId: "core", value: { baby: { name: "测试宝宝", avatarId: "" } } }],
    }, {
      partitionKey: "memories/2026-08", collection: "memories", revision: 2,
      recordEntries: [{ recordId: "memory-current", value: {
        id: "memory-current", title: "恢复前", date: "2026-08-24", description: "当前内容",
      } }],
    }],
    conflicts: [],
  };
  const boundary = createPartitionBoundary({ storage, callLog, remote });
  const original = boundary.cloud.callFunction;
  boundary.cloud.callFunction = function (request) {
    const event = clone(request.data || {});
    if (event.action === "createBackup") {
      callLog.push(event);
      Promise.resolve().then(function () {
        request.success({ result: { ok: true, backup: {
          backupId: "backup-partition-1", version: 5, reason: "manual",
          partitioned: true, format: "partitioned-family-backup-v1",
        } } });
      });
      return;
    }
    if (event.action === "listBackups") {
      callLog.push(event);
      Promise.resolve().then(function () {
        request.success({ result: { ok: true, backups: [{
          backupId: "backup-partition-1", version: 5, reason: "manual",
          partitioned: true, format: "partitioned-family-backup-v1",
        }], retentionLimit: 12 } });
      });
      return;
    }
    if (event.action === "exportFamily") {
      callLog.push(event);
      Promise.resolve().then(function () {
        request.success({ result: { ok: true, export: {
          format: "baby-care-family-export-v1",
          snapshot: { version: 5, data: baseData() },
          partitionBackup: {
            format: "partitioned-family-backup-v1", checksum: "checksum-1",
            payload: { manifest: { revision: 5 }, partitions: clone(remote.partitions) },
          },
        } } });
      });
      return;
    }
    if (event.action === "restoreBackup") {
      callLog.push(event);
      remote.manifestRevision = 6;
      remote.partitionRevisions["memories/2026-08"] = 3;
      remote.partitions[1] = {
        partitionKey: "memories/2026-08", collection: "memories", revision: 3,
        recordEntries: [{ recordId: "memory-restored", value: {
          id: "memory-restored", title: "已恢复", date: "2026-08-08", description: "备份内容",
        } }],
      };
      Promise.resolve().then(function () {
        request.success({ result: {
          ok: true, restored: true, partitioned: true,
          version: 6, restoredFromVersion: 5,
        } });
      });
      return;
    }
    original(request);
  };

  const store = freshStore(boundary);
  await store.init({ config: { useCloud: true, envId: "test-env" } });

  assert.equal(typeof store.createBackup, "function", "Store 必须公开手动完整备份入口");
  const created = await store.createBackup();
  assert.equal(created.backup.backupId, "backup-partition-1");
  assert.equal(created.backup.partitioned, true);

  const listed = await store.listBackups();
  assert.equal(listed.backups[0].format, "partitioned-family-backup-v1");
  const exported = await store.exportFamily();
  assert.equal(exported.partitionBackup.checksum, "checksum-1");

  const restored = await store.restoreBackup("backup-partition-1");
  assert.equal(restored.version, 6);
  assert.equal(store.getData().memories[0].title, "已恢复", "恢复提交后必须从分区云数据重新载入本机");
  assert.equal(store.getSyncStatus().manifestRevision, 6);
  assert.equal(store.getSyncStatus().restoreRefreshRequired, false);
  const restoreCall = callLog.find(function (item) { return item.action === "restoreBackup"; });
  assert.equal(restoreCall.expectedVersion, 5, "分区恢复必须使用 manifest revision，而不是旧快照版本");
  const loadPartitionCalls = callLog.filter(function (item) { return item.action === "loadPartitions"; });
  assert.equal(loadPartitionCalls.length >= 2, true, "恢复后必须再次拉取权威分区");
}

async function run() {
  const tests = [
    offlineRecordUsesDurableOutboxAndIncrementalSyncAfterRestart,
    localEditDuringTailPullIsPreservedAndContinuesSyncing,
    exportWaitsForPendingPartitionSync,
    exportRejectsWhenPendingPartitionSyncFails,
    familyManagementWrappersPassIdentityAndRefreshContext,
    completeBackupWrappersUsePartitionRevisionAndRefreshRestoredData,
  ];
  for (const test of tests) {
    await test();
    console.log(`✓ ${test.name}`);
  }
  console.log(`Store partition sync tests: ${tests.length}/${tests.length} passed`);
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
