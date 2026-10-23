"use strict";

const assert = require("node:assert/strict");
const { CURRENT_SCHEMA_VERSION } = require("../miniprogram/lib/model");
const { legacySnapshot } = require("./migration.test");

const STORE_PATH = require.resolve("../miniprogram/lib/store");

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createWxBoundary(options) {
  const storage = options.storage;
  const cloudState = options.cloudState;
  const backupState = options.backupState || null;
  const callLog = options.callLog || [];
  const writeControl = options.writeControl || { fail: false };
  const bootstrapError = options.bootstrapError || null;
  let restoreCommitted = false;
  return {
    getStorageSync(key) {
      return clone(storage.get(key));
    },
    setStorageSync(key, value) {
      if (writeControl.fail) throw new Error("模拟本地存储失败");
      storage.set(key, clone(value));
    },
    cloud: {
      init() {},
      callFunction(request) {
        Promise.resolve().then(function () {
          const action = request.data && request.data.action;
          callLog.push(clone(request.data));
          if (options.responseOverrides && Object.prototype.hasOwnProperty.call(options.responseOverrides, action)) {
            const overridden = options.responseOverrides[action];
            if (overridden instanceof Error) request.fail(overridden);
            else request.success({ result: clone(overridden) });
            return;
          }
          if (action === "bootstrap") {
            if (bootstrapError) {
              request.fail(bootstrapError);
              return;
            }
            request.success({
              result: {
                ok: true,
                openId: "openid-family-member",
                joined: true,
                family: { familyId: "family-1", name: "测试家庭" },
              },
            });
            return;
          }
          if (action === "load") {
            if (restoreCommitted && options.failLoadAfterRestore) {
              request.fail(new Error("模拟恢复后的云端读取失败"));
              return;
            }
            request.success({
              result: {
                ok: true,
                openId: "openid-family-member",
                family: { familyId: "family-1", name: "测试家庭", owner: true, memberCount: 1, maxMembers: 6 },
                snapshot: {
                  version: cloudState.version,
                  data: clone(cloudState.data),
                  capacity: backupState && clone(backupState.capacity),
                },
              },
            });
            return;
          }
          if (action === "save") {
            cloudState.version += 1;
            cloudState.data = clone(request.data.data);
            request.success({ result: { ok: true, version: cloudState.version, capacity: backupState && clone(backupState.capacity) } });
            return;
          }
          if (action === "listBackups" && backupState) {
            request.success({ result: { ok: true, backups: clone(backupState.backups), retentionLimit: 30 } });
            return;
          }
          if (action === "exportFamily" && backupState) {
            request.success({ result: { ok: true, export: clone(backupState.export), capacity: clone(backupState.capacity) } });
            return;
          }
          if (action === "restoreBackup" && backupState) {
            cloudState.version += 1;
            cloudState.data = clone(backupState.restoreData);
            restoreCommitted = true;
            request.success({
              result: {
                ok: true,
                restored: true,
                version: cloudState.version,
                restoredFromVersion: backupState.restoredFromVersion,
                capacity: clone(backupState.capacity),
              },
            });
            return;
          }
          request.fail(new Error("Unexpected familyApi action: " + action));
        });
      },
    },
  };
}

function freshStore(wxBoundary) {
  delete require.cache[STORE_PATH];
  global.wx = wxBoundary;
  return require(STORE_PATH);
}

function baseData() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    baby: { name: "测试宝宝", avatarId: "" },
    memories: [], todos: [], feedings: [], sleeps: [], diapers: [], diaperChanges: [], poops: [], supplements: [],
    growthRecords: [], vaccines: [], abilities: [], checkups: [],
    trashEntries: [], recordHistory: [],
    _updatedSections: {}, _deletedRecords: [], updatedAt: "2026-08-10T00:00:00.000Z",
  };
}

async function removedRecordCanBeRestoredAfterRestart() {
  const storage = new Map();
  let store = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
  }));
  await store.init({ config: { useCloud: false, envId: "" } });
  await store.upsert("memories", { id: "memory-to-restore", title: "可恢复的回忆" });

  const removed = await store.remove("memories", "memory-to-restore", {
    now: "2026-08-10T10:00:00.000Z",
    actorId: "member-mother",
  });
  assert.equal(store.getData().memories.length, 0, "删除后活跃列表不再显示记录");
  assert.ok(removed.trashId, "删除必须返回可用于撤销的回收站 ID");
  assert.equal(store.getData().trashEntries.length, 1, "记录必须进入回收站而不是立即消失");

  store = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
  }));
  await store.init({ config: { useCloud: false, envId: "" } });
  await store.restoreFromTrash(removed.trashId, {
    now: "2026-08-10T10:00:04.000Z",
    actorId: "member-mother",
  });

  assert.equal(
    store.getData().memories.some(function (item) { return item.id === "memory-to-restore"; }),
    true,
    "重启后仍可用回收站 ID 恢复原记录",
  );
  assert.equal(store.getData().trashEntries.length, 0, "恢复后回收站条目应移除");
  assert.deepEqual(
    store.getData().recordHistory.map(function (entry) { return entry.action; }),
    ["create", "delete", "restore"],
    "创建、删除和恢复必须留下历史证据",
  );
}

async function legacyLocalDataIsMigratedAndPersisted() {
  const storage = new Map();
  storage.set("little-steps-miniapp-family-v1", legacySnapshot());
  storage.set("little-steps-miniapp-family-context-v1", { dirty: false });
  const store = freshStore(createWxBoundary({ storage, cloudState: { version: 0, data: baseData() } }));
  await store.init({ config: { useCloud: false, envId: "" } });

  assert.equal(store.getData().feedings.length, 0, "旧本地快照首次读取时必须立即净化");
  assert.equal(store.getData().schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(storage.get("little-steps-miniapp-family-v1")._deletedRecords.length, 20, "净化结果和删除标记必须写回本机");
  assert.equal(storage.get("little-steps-miniapp-family-context-v1").dirty, true, "本地迁移后必须等待上传，不能误标为已同步");
}

async function legacyRemoteDataIsMigratedAndWrittenBack() {
  const storage = new Map();
  const cloudState = { version: 7, data: legacySnapshot() };
  const callLog = [];
  const store = freshStore(createWxBoundary({ storage, cloudState, callLog }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });

  assert.equal(store.getData().feedings.length, 0, "旧云端快照必须先净化再显示");
  assert.equal(cloudState.data.schemaVersion, CURRENT_SCHEMA_VERSION, "净化后的结构版本必须回写云端");
  assert.equal(cloudState.data._deletedRecords.length, 20, "回写云端时必须带齐删除标记");
  assert.equal(callLog.some(function (item) { return item.action === "save"; }), true, "远端净化必须触发一次保存，供其他设备同步");
}

async function legacyBackupRestoreIsMigratedAndWrittenBack() {
  const storage = new Map();
  const cloudState = { version: 4, data: baseData() };
  const backupState = {
    capacity: {}, backups: [], export: {}, restoreData: legacySnapshot(), restoredFromVersion: 2,
  };
  const callLog = [];
  const store = freshStore(createWxBoundary({ storage, cloudState, backupState, callLog }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await store.restoreBackup("legacy-backup");

  assert.equal(store.getData().memories.length, 0, "恢复旧备份也必须经过同一迁移");
  assert.equal(cloudState.data.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(cloudState.data._deletedRecords.length, 20, "旧备份净化后必须把删除标记重新写回云端");
  assert.equal(callLog.filter(function (item) { return item.action === "save"; }).length, 1, "恢复后的净化结果必须额外保存一次");
}

async function newFamilyMemberKeepsFirstOfflineEditAfterCloudRecovery() {
  const storage = new Map();
  const cloudState = { version: 1, data: baseData() };

  let store = freshStore(createWxBoundary({ storage, cloudState }));
  await store.init({ config: { useCloud: false, envId: "" } });
  await store.upsert("memories", { id: "offline-real", title: "断网时记录的第一次翻身" });
  assert.equal(store.getData().memories.some((item) => item.id === "offline-real"), true);

  store = freshStore(createWxBoundary({ storage, cloudState }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  assert.equal(
    store.getData().memories.some((item) => item.id === "offline-real"),
    true,
    "已有家庭成员在新设备首次离线新增的记录，恢复云端时不能被旧快照覆盖",
  );

  store = freshStore(createWxBoundary({ storage, cloudState }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  assert.equal(
    store.getData().memories.some((item) => item.id === "offline-real"),
    true,
    "首次云端恢复完成后再次重启，离线记录仍必须存在",
  );
}

async function failedUpsertDoesNotRemainInMemory() {
  const storage = new Map();
  const writeControl = { fail: false };
  const store = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
    writeControl,
  }));
  await store.init({ config: { useCloud: false, envId: "" } });

  writeControl.fail = true;
  await assert.rejects(
    store.upsert("memories", { id: "not-persisted", title: "不应假保存" }),
    /模拟本地存储失败/,
  );
  assert.equal(
    store.getData().memories.some((item) => item.id === "not-persisted"),
    false,
    "本地持久化失败后，upsert 不能留下只存在于内存的假记录",
  );

  writeControl.fail = false;
  const restarted = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
    writeControl,
  }));
  await restarted.init({ config: { useCloud: false, envId: "" } });
  assert.equal(
    restarted.getData().memories.some((item) => item.id === "not-persisted"),
    false,
    "写入失败后重启 Store，也不能重新出现失败的 upsert 记录",
  );
}

async function failedRemoveKeepsPersistedRecordInMemory() {
  const storage = new Map();
  const writeControl = { fail: false };
  const store = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
    writeControl,
  }));
  await store.init({ config: { useCloud: false, envId: "" } });
  await store.upsert("memories", { id: "must-remain", title: "已经保存的记录" });

  writeControl.fail = true;
  await assert.rejects(store.remove("memories", "must-remain"), /模拟本地存储失败/);
  assert.equal(
    store.getData().memories.some((item) => item.id === "must-remain"),
    true,
    "本地持久化失败后，remove 不能让已保存记录只从内存中消失",
  );


  writeControl.fail = false;
  const restarted = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
    writeControl,
  }));
  await restarted.init({ config: { useCloud: false, envId: "" } });
  assert.equal(
    restarted.getData().memories.some((item) => item.id === "must-remain"),
    true,
    "写入失败后重启 Store，原记录仍必须存在",
  );
}

async function syncReportsWhenCloudIsDisabled() {
  const storage = new Map();
  const store = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
  }));
  await store.init({ config: { useCloud: false, envId: "" } });

  const result = await store.syncNow();
  assert.deepEqual(result, {
    ok: false,
    synced: false,
    reason: "cloud-unavailable",
  }, "云端未启用时，syncNow 必须明确返回未同步状态");
}

async function syncReportsOnlyAfterCloudSaveSucceeds() {
  const storage = new Map();
  const cloudState = { version: 2, data: baseData() };
  const store = freshStore(createWxBoundary({ storage, cloudState }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });

  const result = await store.syncNow();
  assert.deepEqual(result, {
    ok: true,
    synced: true,
    reason: "synced",
  }, "只有云端保存真实完成后，syncNow 才能返回已同步");
}

async function syncReportsWhenCloudStartupFails() {
  const storage = new Map();
  const store = freshStore(createWxBoundary({
    storage,
    cloudState: { version: 0, data: baseData() },
    bootstrapError: new Error("模拟云端不可用"),
  }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  assert.equal(store.getSyncStatus().mode, "local", "云端启动失败后必须明确降级为本地模式");

  const result = await store.syncNow();
  assert.deepEqual(result, {
    ok: false,
    synced: false,
    reason: "cloud-unavailable",
  }, "云端启动失败后，手动同步不能伪装成成功");
}

async function familyBackupToolsAreUsableFromTheClientStore() {
  const storage = new Map();
  const current = baseData();
  current.memories = [{ id: "current", title: "当前记录" }];
  const restored = baseData();
  restored.memories = [{ id: "restored", title: "已恢复记录" }];
  const cloudState = { version: 4, data: current };
  const callLog = [];
  const backupState = {
    capacity: {
      storageFormat: "legacy-snapshot-v1",
      snapshotBytes: 2048,
      snapshotLimitBytes: 850000,
      usageRatio: 0.0024,
      warning: false,
      partitionMigrationAvailable: false,
    },
    backups: [{ backupId: "backup-v3", version: 3, reason: "save", createdAt: "2026-08-23T10:00:00.000Z" }],
    export: { format: "baby-care-family-export-v1", snapshot: { version: 4, data: current } },
    restoreData: restored,
    restoredFromVersion: 3,
  };
  const store = freshStore(createWxBoundary({ storage, cloudState, backupState, callLog }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });

  const listed = await store.listBackups(10);
  assert.equal(listed.backups[0].backupId, "backup-v3", "客户端应能获取家庭备份列表");
  assert.equal(listed.retentionLimit, 30);

  const exported = await store.exportFamily();
  assert.equal(exported.format, "baby-care-family-export-v1", "客户端应能导出完整家庭数据");
  assert.equal(store.getSyncStatus().capacity.snapshotBytes, 2048, "load 响应中的嵌套容量状态应在客户端可见");

  await store.restoreBackup("backup-v3");
  assert.deepEqual(store.getData().memories, restored.memories, "恢复后必须用备份内容替换当前快照");
  assert.equal(store.getSyncStatus().revision, 5, "恢复后应使用云端新版本号");
  const restoreCall = callLog.find((item) => item.action === "restoreBackup");
  assert.deepEqual(
    restoreCall,
    { action: "restoreBackup", familyId: "family-1", expectedVersion: 4, backupId: "backup-v3" },
    "恢复必须携带当前版本号，防止覆盖家人刚保存的数据",
  );
}

async function cloudBackupMediaReferencesAreValidated() {
  let store = freshStore(createWxBoundary({
    storage: new Map(),
    cloudState: { version: 4, data: baseData() },
    responseOverrides: {
      getProtectedMediaReferences: {
        ok: true,
        references: [
          "cloud://test-env/family-media/backup-photo.jpg",
          "cloud://test-env/family-media/backup-photo.jpg",
          "cloud://test-env/family-media/backup-audio.mp3",
        ],
      },
    },
  }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  assert.deepEqual(await store.getProtectedMediaReferences(), [
    "cloud://test-env/family-media/backup-photo.jpg",
    "cloud://test-env/family-media/backup-audio.mp3",
  ], "客户端必须取得并去重云端现行数据与备份共同引用的媒体");

  store = freshStore(createWxBoundary({
    storage: new Map(),
    cloudState: { version: 4, data: baseData() },
    responseOverrides: {
      getProtectedMediaReferences: { ok: true, references: ["wxfile://unsafe-local-file"] },
    },
  }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await assert.rejects(store.getProtectedMediaReferences(), function (error) {
    return error && error.code === "INVALID_FAMILY_API_RESPONSE";
  }, "云端返回非 cloud:// 媒体时必须拒绝，不能误当成已验证保护清单");
}

async function committedRestoreBlocksStaleLocalWritesUntilReloadSucceeds() {
  const storage = new Map();
  const current = baseData();
  current.memories = [{ id: "current", title: "恢复前的本机记录" }];
  const restored = baseData();
  restored.memories = [{ id: "restored", title: "云端备份记录" }];
  const cloudState = { version: 4, data: current };
  const backupState = {
    capacity: {
      storageFormat: "legacy-snapshot-v1",
      snapshotBytes: 2048,
      snapshotLimitBytes: 850000,
      usageRatio: 0.0024,
      warning: false,
      partitionMigrationAvailable: false,
    },
    backups: [{ backupId: "backup-v3", version: 3, reason: "save" }],
    export: { format: "baby-care-family-export-v1", snapshot: { version: 4, data: current } },
    restoreData: restored,
    restoredFromVersion: 3,
  };
  let store = freshStore(createWxBoundary({
    storage,
    cloudState,
    backupState,
    failLoadAfterRestore: true,
  }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });

  await assert.rejects(
    store.restoreBackup("backup-v3"),
    function (error) {
      return error && error.code === "RESTORE_REFRESH_REQUIRED" && error.restoreCommitted === true;
    },
    "云端恢复已经提交但本机刷新失败时，必须返回可恢复的明确状态",
  );
  assert.equal(store.getSyncStatus().restoreRefreshRequired, true);
  assert.deepEqual(cloudState.data.memories, restored.memories, "云端已经完成恢复");
  assert.deepEqual(store.getData().memories, current.memories, "本机仍是恢复前数据，不能伪装成已刷新");
  await assert.rejects(store.upsert("memories", { id: "unsafe", title: "不应写回" }), /重新载入/);
  await assert.rejects(store.syncNow(), /重新载入/);
  assert.deepEqual(cloudState.data.memories, restored.memories, "旧本机数据不得覆盖刚恢复的云端数据");

  const staleCloudState = { version: 4, data: current };
  store = freshStore(createWxBoundary({ storage, cloudState: staleCloudState, backupState }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  assert.equal(store.getSyncStatus().restoreRefreshRequired, true, "云端仍返回恢复前版本时必须继续保持保护锁");
  assert.deepEqual(store.getData().memories, current.memories, "低于已提交恢复版本的快照不得覆盖本机状态");
  await assert.rejects(
    store.upsert("memories", { id: "still-unsafe", title: "仍不应写回" }),
    /重新载入/,
    "只有读到恢复提交版本或更新版本后才能重新编辑",
  );

  store = freshStore(createWxBoundary({ storage, cloudState, backupState }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  assert.equal(store.getSyncStatus().restoreRefreshRequired, false, "重新进入并强制拉取成功后应解除保护锁");
  assert.deepEqual(store.getData().memories, restored.memories, "重新进入后必须载入已恢复的云端内容");
}

async function familyApiResponsesMustBeExplicitAndWellFormed() {
  const backupState = {
    capacity: {
      storageFormat: "legacy-snapshot-v1",
      snapshotBytes: 2048,
      snapshotLimitBytes: 850000,
      usageRatio: 0.0024,
      warning: false,
      partitionMigrationAvailable: false,
    },
    backups: [{ backupId: "backup-v3", version: 3 }],
    export: { format: "baby-care-family-export-v1", snapshot: { version: 4, data: baseData() } },
    restoreData: baseData(),
    restoredFromVersion: 3,
  };

  let responses = { listBackups: { backups: [], retentionLimit: 30 } };
  let store = freshStore(createWxBoundary({
    storage: new Map(),
    cloudState: { version: 4, data: baseData() },
    backupState,
    responseOverrides: responses,
  }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await assert.rejects(store.listBackups(10), function (error) {
    return error && error.code === "INVALID_FAMILY_API_RESPONSE";
  }, "familyApi 只有明确 ok===true 才能被当作成功");

  responses.listBackups = { ok: true, backups: "not-an-array", retentionLimit: 30 };
  await assert.rejects(store.listBackups(10), function (error) {
    return error && error.code === "INVALID_FAMILY_API_RESPONSE";
  }, "备份列表结构不合法时必须拒绝，不能退化为空列表");

  responses = { exportFamily: { ok: true, export: { format: "unknown", snapshot: {} } } };
  store = freshStore(createWxBoundary({
    storage: new Map(),
    cloudState: { version: 4, data: baseData() },
    backupState,
    responseOverrides: responses,
  }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await assert.rejects(store.exportFamily(), function (error) {
    return error && error.code === "INVALID_FAMILY_API_RESPONSE";
  }, "导出结构不合法时不能生成看似成功的存档");

  responses = { restoreBackup: { ok: true, restored: true, version: "5", restoredFromVersion: 3 } };
  store = freshStore(createWxBoundary({
    storage: new Map(),
    cloudState: { version: 4, data: baseData() },
    backupState,
    responseOverrides: responses,
  }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  await assert.rejects(store.restoreBackup("backup-v3"), function (error) {
    return error && error.code === "RESTORE_REFRESH_REQUIRED" && error.restoreCommitted === false;
  }, "恢复版本结构不合法时必须进入安全重载状态，不能继续写入旧数据");
}

async function restoreAcceptsAnIntentionallyEmptySnapshot() {
  const current = baseData();
  current.memories = [{ id: "must-disappear", title: "恢复前记录" }];
  const cloudState = { version: 4, data: current };
  const backupState = {
    capacity: {},
    backups: [{ backupId: "empty-backup", version: 1 }],
    export: { format: "baby-care-family-export-v1", snapshot: { version: 4, data: current } },
    restoreData: {},
    restoredFromVersion: 1,
  };
  const store = freshStore(createWxBoundary({ storage: new Map(), cloudState, backupState }));
  await store.init({ config: { useCloud: true, envId: "test-env" } });
  const result = await store.restoreBackup("empty-backup");
  assert.strictEqual(result.restored, true);
  assert.strictEqual(
    (store.getData().memories || []).some(function (item) { return item.id === "must-disappear"; }),
    false,
    "合法空快照必须替换旧本机内容，不能因 Object.keys 为空而误判为读取失败",
  );
}

async function runStorePublicTests() {
  await removedRecordCanBeRestoredAfterRestart();
  await legacyLocalDataIsMigratedAndPersisted();
  await legacyRemoteDataIsMigratedAndWrittenBack();
  await legacyBackupRestoreIsMigratedAndWrittenBack();
  await newFamilyMemberKeepsFirstOfflineEditAfterCloudRecovery();
  await failedUpsertDoesNotRemainInMemory();
  await failedRemoveKeepsPersistedRecordInMemory();
  await syncReportsWhenCloudIsDisabled();
  await syncReportsOnlyAfterCloudSaveSucceeds();
  await syncReportsWhenCloudStartupFails();
  await familyBackupToolsAreUsableFromTheClientStore();
  await cloudBackupMediaReferencesAreValidated();
  await committedRestoreBlocksStaleLocalWritesUntilReloadSucceeds();
  await familyApiResponsesMustBeExplicitAndWellFormed();
  await restoreAcceptsAnIntentionallyEmptySnapshot();
  console.log("Store public behavior tests: 15/15 passed");
}

if (require.main === module) {
  runStorePublicTests().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { runStorePublicTests };
