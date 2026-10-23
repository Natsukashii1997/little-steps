"use strict";

const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function matches(document, criteria) {
  return Object.entries(criteria || {}).every(function ([key, expected]) {
    const actual = document[key];
    if (expected && expected.__operator === "in") {
      return Array.isArray(actual) && actual.some(function (item) { return expected.values.includes(item); });
    }
    return actual === expected;
  });
}

function createMemoryDatabase() {
  const collections = new Map();
  let nextId = 1;
  function records(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  }
  function collection(name) {
    const table = records(name);
    return {
      doc(id) {
        return {
          async get() {
            if (!table.has(id)) throw new Error("DOCUMENT_NOT_FOUND");
            return { data: clone(table.get(id)) };
          },
          async set({ data }) {
            table.set(id, { _id: id, ...clone(data) });
            return { _id: id };
          },
          async update({ data }) {
            if (!table.has(id)) throw new Error("DOCUMENT_NOT_FOUND");
            table.set(id, { ...table.get(id), ...clone(data), _id: id });
            return { updated: 1 };
          },
          async remove() {
            const deleted = table.delete(id);
            return { removed: deleted ? 1 : 0 };
          },
        };
      },
      async add({ data }) {
        const id = `${name}-${nextId++}`;
        table.set(id, { _id: id, ...clone(data) });
        return { _id: id };
      },
      where(criteria) {
        let limitValue = Infinity;
        const query = {
          limit(value) { limitValue = value; return query; },
          skip() { return query; },
          orderBy() { return query; },
          async get() {
            return { data: clone([...table.values()].filter(function (document) {
              return matches(document, criteria);
            }).slice(0, limitValue)) };
          },
        };
        return query;
      },
    };
  }
  return {
    command: { in: (values) => ({ __operator: "in", values }) },
    serverDate: () => "2026-08-24T10:00:00.000Z",
    collection,
    runTransaction: async (callback) => callback({ collection }),
    seed(name, id, data) { records(name).set(id, { _id: id, ...clone(data) }); },
    read(name, id) { return clone(records(name).get(id)); },
    all(name) { return clone([...records(name).values()]); },
  };
}

function createFixture() {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "wx-server-sdk") {
      return { DYNAMIC_CURRENT_ENV: "test", init() {}, database() { return createMemoryDatabase(); }, getWXContext() { return { OPENID: "test" }; } };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  let factory;
  try {
    const modulePath = path.resolve(__dirname, "../cloudfunctions/familyApi/index.js");
    delete require.cache[modulePath];
    factory = require(modulePath).createFamilyApi;
  } finally {
    Module._load = originalLoad;
  }
  const database = createMemoryDatabase();
  let openId = "owner-openid";
  const main = factory({
    database,
    getWXContext: () => ({ OPENID: openId }),
    now: () => "2026-08-24T10:00:00.000Z",
    uniqueId: () => "fixed-request",
    logger: { error() {} },
  });
  return { database, main, asOpenId(value) { openId = value; } };
}

async function createFamily(fixture) {
  const result = await fixture.main({ action: "createFamily", nickname: "爸爸", relation: "父亲" });
  assert.equal(result.ok, true);
  return result.family.familyId;
}

async function duplicateOperationIsAppliedExactlyOnce() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const operation = {
    operationId: "op-feeding-1",
    partitionKey: "feedings/2026-08",
    collection: "feedings",
    recordId: "feeding-1",
    kind: "upsert",
    baseRecord: null,
    changes: { id: "feeding-1", amount: 120, milkType: "母乳" },
  };

  const first = await fixture.main({ action: "syncPartitions", familyId, operations: [operation] });
  const replay = await fixture.main({ action: "syncPartitions", familyId, operations: [operation] });

  assert.equal(first.ok, true);
  assert.equal(first.results[0].duplicate, false);
  assert.equal(replay.ok, true);
  assert.equal(replay.results[0].duplicate, true);
  assert.equal(replay.manifestRevision, first.manifestRevision, "重放不得再次推进服务端修订号");
  const loaded = await fixture.main({ action: "loadPartitions", familyId });
  assert.deepEqual(loaded.partitions[0].records, [{ id: "feeding-1", amount: 120, milkType: "母乳" }]);
}

async function differentFieldsMergeAndSameFieldConflictKeepsEvidence() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const create = {
    operationId: "op-create",
    partitionKey: "todos/2026-08",
    collection: "todos",
    recordId: "todo-1",
    kind: "upsert",
    baseRecord: null,
    changes: { id: "todo-1", title: "洗澡", completed: false },
  };
  assert.equal((await fixture.main({ action: "syncPartitions", familyId, operations: [create] })).ok, true);

  const titleEdit = {
    operationId: "op-title",
    partitionKey: "todos/2026-08",
    collection: "todos",
    recordId: "todo-1",
    kind: "upsert",
    baseRecord: { id: "todo-1", title: "洗澡", completed: false },
    changes: { title: "晚间洗澡" },
  };
  const completionEdit = {
    operationId: "op-complete",
    partitionKey: "todos/2026-08",
    collection: "todos",
    recordId: "todo-1",
    kind: "upsert",
    baseRecord: { id: "todo-1", title: "洗澡", completed: false },
    changes: { completed: true },
  };
  await fixture.main({ action: "syncPartitions", familyId, operations: [titleEdit] });
  const merged = await fixture.main({ action: "syncPartitions", familyId, operations: [completionEdit] });
  assert.equal(merged.results[0].conflicts.length, 0, "不同字段的离线编辑应自动合并");

  const conflicting = await fixture.main({ action: "syncPartitions", familyId, operations: [{
    operationId: "op-title-conflict",
    partitionKey: "todos/2026-08",
    collection: "todos",
    recordId: "todo-1",
    kind: "upsert",
    baseRecord: { id: "todo-1", title: "洗澡", completed: false },
    changes: { title: "上午洗澡" },
  }] });
  assert.equal(conflicting.results[0].conflicts.length, 1, "同字段并发必须形成可解释冲突证据");
  assert.deepEqual(conflicting.results[0].conflicts[0], {
    field: "title",
    baseValue: "洗澡",
    losingValue: "晚间洗澡",
    winningValue: "上午洗澡",
  });

  const loaded = await fixture.main({ action: "loadPartitions", familyId });
  assert.deepEqual(loaded.partitions[0].records, [{ id: "todo-1", title: "上午洗澡", completed: true }]);
  assert.equal(loaded.conflicts.length, 1);
}

async function legacySnapshotCannotOverwriteNewerPartitions() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  await fixture.main({ action: "syncPartitions", familyId, operations: [{
    operationId: "op-newer",
    partitionKey: "memories/2026-08",
    collection: "memories",
    recordId: "memory-newer",
    kind: "upsert",
    baseRecord: null,
    changes: { id: "memory-newer", title: "新分区记录" },
  }] });

  const migration = await fixture.main({
    action: "migrateLegacySnapshot",
    familyId,
    legacyVersion: 99,
    data: { memories: [{ id: "legacy", title: "旧整包记录" }] },
  });
  assert.equal(migration.ok, true);
  assert.equal(migration.migrated, false);
  assert.equal(migration.reason, "partition-data-exists");
  const loaded = await fixture.main({ action: "loadPartitions", familyId });
  assert.equal(loaded.partitions[0].records[0].id, "memory-newer");
}

async function legacySnapshotMigratesAtomicallyIntoCoreAndMonthlyPartitions() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const migration = await fixture.main({
    action: "migrateLegacySnapshot",
    familyId,
    legacyVersion: 7,
    data: {
      schemaVersion: 3,
      baby: { name: "虚构宝宝", birthDate: "2026-08-04" },
      memories: [{ id: "memory-legacy", date: "2026-08-24", title: "迁移记录" }],
      feedings: [],
    },
  });
  assert.equal(migration.ok, true);
  assert.equal(migration.migrated, true);

  const loaded = await fixture.main({ action: "loadPartitions", familyId });
  assert.equal(loaded.partitioned, true);
  const core = loaded.partitions.find((item) => item.partitionKey === "core");
  const baby = core.recordEntries.find((entry) => entry.recordId === "baby");
  assert.deepEqual(baby.value.value, { name: "虚构宝宝", birthDate: "2026-08-04" });
  const memories = loaded.partitions.find((item) => item.partitionKey === "memories/2026-08");
  assert.equal(memories.records[0].id, "memory-legacy");
  assert.ok(loaded.partitions.some((item) => item.partitionKey === "feedings/undated"), "空集合也要有权威空分区");

  const replay = await fixture.main({
    action: "migrateLegacySnapshot",
    familyId,
    legacyVersion: 8,
    data: { memories: [{ id: "stale", title: "不能覆盖" }] },
  });
  assert.equal(replay.migrated, false);
  assert.equal(replay.reason, "partition-data-exists");
}

async function manualBackupAndExportContainEveryAuthoritativePartition() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const migrated = await fixture.main({
    action: "migrateLegacySnapshot",
    familyId,
    legacyVersion: 3,
    data: {
      schemaVersion: 3,
      baby: { name: "虚构宝宝", birthDate: "2026-08-04" },
      feedings: [{ id: "feeding-aug", date: "2026-08-24", amount: 120 }],
      memories: [{ id: "memory-jul", date: "2026-07-31", title: "七月回忆" }],
    },
  });
  assert.equal(migrated.ok, true);

  const created = await fixture.main({ action: "createBackup", familyId });
  assert.equal(created.ok, true);
  assert.equal(created.backup.partitioned, true);
  assert.equal(created.backup.reason, "manual");

  const listed = await fixture.main({ action: "listBackups", familyId });
  assert.equal(listed.ok, true);
  assert.equal(listed.backups[0].backupId, created.backup.backupId);
  assert.equal(listed.backups[0].partitioned, true);

  const exported = await fixture.main({ action: "exportFamily", familyId });
  assert.equal(exported.ok, true);
  assert.equal(exported.export.partitionBackup.format, "partitioned-family-backup-v1");
  assert.match(exported.export.partitionBackup.checksumSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(exported.export.snapshot.data.baby, { name: "虚构宝宝", birthDate: "2026-08-04" });
  assert.equal(exported.export.snapshot.data.feedings[0].id, "feeding-aug");
  assert.equal(exported.export.snapshot.data.memories[0].id, "memory-jul");
  const partitionKeys = exported.export.partitionBackup.payload.partitions.map((item) => item.partitionKey);
  assert.ok(partitionKeys.includes("core"));
  assert.ok(partitionKeys.includes("feedings/2026-08"));
  assert.ok(partitionKeys.includes("memories/2026-07"));
}

async function partitionRestoreIsAtomicAndKeepsAPreRestoreProtectionBackup() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  await fixture.main({
    action: "migrateLegacySnapshot",
    familyId,
    legacyVersion: 3,
    data: {
      schemaVersion: 3,
      baby: { name: "虚构宝宝", birthDate: "2026-08-04" },
      feedings: [{ id: "feeding-1", date: "2026-08-24", amount: 120 }],
    },
  });
  const backup = await fixture.main({ action: "createBackup", familyId });
  assert.equal(backup.ok, true);

  const beforeRestore = await fixture.main({ action: "loadPartitions", familyId });
  const originalFeeding = beforeRestore.partitions.find((item) => item.partitionKey === "feedings/2026-08").records[0];
  await fixture.main({ action: "syncPartitions", familyId, operations: [{
    operationId: "op-change-after-backup",
    partitionKey: "feedings/2026-08",
    collection: "feedings",
    recordId: "feeding-1",
    kind: "upsert",
    baseRecord: originalFeeding,
    changes: { amount: 180 },
  }, {
    operationId: "op-new-memory-after-backup",
    partitionKey: "memories/2026-08",
    collection: "memories",
    recordId: "memory-new",
    kind: "upsert",
    baseRecord: null,
    changes: { id: "memory-new", date: "2026-08-25", title: "备份后新增" },
  }] });
  const changed = await fixture.main({ action: "loadPartitions", familyId });

  const restored = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: backup.backup.backupId,
    expectedVersion: changed.manifestRevision,
  });
  assert.equal(restored.ok, true);
  assert.equal(restored.restored, true);
  assert.equal(restored.partitioned, true);

  const after = await fixture.main({ action: "loadPartitions", familyId });
  assert.equal(after.partitions.find((item) => item.partitionKey === "feedings/2026-08").records[0].amount, 120);
  assert.equal(after.partitions.some((item) => item.partitionKey === "memories/2026-08"), false);
  assert.ok(after.manifestRevision > changed.manifestRevision, "恢复必须推进权威修订号，避免旧设备覆盖恢复结果");

  const protection = fixture.database.all("family_backups").find((item) => item.reason === "pre_restore");
  assert.ok(protection, "恢复前必须在同一事务内保留保护快照");
  assert.equal(protection.partitioned, true);
  const protectedFeeding = protection.payload.partitions
    .find((item) => item.partitionKey === "feedings/2026-08").records["feeding-1"];
  assert.equal(protectedFeeding.amount, 180);
  assert.ok(protection.payload.partitions.some((item) => item.partitionKey === "memories/2026-08"));
}

async function corruptedPartitionBackupCannotChangeCurrentFamilyData() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  await fixture.main({
    action: "migrateLegacySnapshot",
    familyId,
    legacyVersion: 3,
    data: { feedings: [{ id: "feeding-1", date: "2026-08-24", amount: 120 }] },
  });
  const created = await fixture.main({ action: "createBackup", familyId });
  const stored = fixture.database.read("family_backups", created.backup.backupId);
  stored.payload.partitions.find((item) => item.partitionKey === "feedings/2026-08")
    .records["feeding-1"].amount = 999;
  fixture.database.seed("family_backups", created.backup.backupId, stored);

  const before = await fixture.main({ action: "loadPartitions", familyId });
  const backupsBefore = fixture.database.all("family_backups").length;
  const result = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: created.backup.backupId,
    expectedVersion: before.manifestRevision,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "BACKUP_INTEGRITY_FAILED");

  const after = await fixture.main({ action: "loadPartitions", familyId });
  assert.deepEqual(after.partitions, before.partitions, "校验失败时当前权威分区必须完全不变");
  assert.equal(after.manifestRevision, before.manifestRevision);
  assert.equal(fixture.database.all("family_backups").length, backupsBefore, "校验失败不得留下伪保护快照");
}

async function onlyOwnerCreatesBackupAndBackupAdminMayRestoreIt() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  await fixture.main({
    action: "migrateLegacySnapshot",
    familyId,
    legacyVersion: 1,
    data: { todos: [{ id: "todo-1", date: "2026-08-24", title: "原始事项" }] },
  });
  const ownerBackup = await fixture.main({ action: "createBackup", familyId });
  assert.equal(ownerBackup.ok, true);

  const inviteCode = fixture.database.read("families", familyId).inviteCode;
  fixture.asOpenId("grandma-openid");
  assert.equal((await fixture.main({ action: "join", inviteCode, nickname: "外婆", relation: "外婆" })).ok, true);
  const forbiddenCreate = await fixture.main({ action: "createBackup", familyId });
  assert.equal(forbiddenCreate.ok, false);
  assert.equal(forbiddenCreate.error.code, "OWNER_REQUIRED");
  const before = await fixture.main({ action: "loadPartitions", familyId });
  const forbiddenRestore = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: ownerBackup.backup.backupId,
    expectedVersion: before.manifestRevision,
  });
  assert.equal(forbiddenRestore.ok, false);
  assert.equal(forbiddenRestore.error.code, "OWNER_REQUIRED");

  fixture.asOpenId("owner-openid");
  assert.equal((await fixture.main({ action: "setBackupAdmin", familyId, memberId: "grandma-openid" })).ok, true);
  fixture.asOpenId("grandma-openid");
  const restored = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: ownerBackup.backup.backupId,
    expectedVersion: before.manifestRevision,
  });
  assert.equal(restored.ok, true);
  assert.equal(restored.partitioned, true);
}

async function inactiveMemberCannotLoadOrSyncAuthoritativePartitions() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const inviteCode = fixture.database.read("families", familyId).inviteCode;

  fixture.asOpenId("grandma-openid");
  assert.equal((await fixture.main({
    action: "join",
    inviteCode,
    nickname: "外婆",
    relation: "外婆",
  })).ok, true);

  fixture.asOpenId("owner-openid");
  assert.equal((await fixture.main({
    action: "updateMember",
    familyId,
    memberId: "grandma-openid",
    status: "inactive",
  })).ok, true);

  fixture.asOpenId("grandma-openid");
  const loadDenied = await fixture.main({ action: "loadPartitions", familyId });
  assert.equal(loadDenied.ok, false);
  assert.equal(loadDenied.error.code, "FORBIDDEN");

  const syncDenied = await fixture.main({
    action: "syncPartitions",
    familyId,
    operations: [{
      operationId: "inactive-write",
      partitionKey: "todos/2026-08",
      collection: "todos",
      recordId: "todo-inactive",
      kind: "upsert",
      baseRecord: null,
      changes: { id: "todo-inactive", title: "不应写入" },
    }],
  });
  assert.equal(syncDenied.ok, false);
  assert.equal(syncDenied.error.code, "FORBIDDEN");
  assert.equal(fixture.database.all("family_operations").length, 0, "拒绝后不得留下操作日志或半完成数据");
}

async function backupOnlyMediaReferencesRemainProtected() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const protectedRef = "cloud://test-env/family-media/owner-openid/images/backup-only.jpg";
  fixture.database.seed("family_backups", "backup-media-only", {
    familyId,
    version: 1,
    partitioned: true,
    format: "partitioned-family-backup-v1",
    payload: {
      format: "partitioned-family-backup-v1",
      manifest: { revision: 1, partitionRevisions: { "memories/2026-08": 1 }, legacySnapshotVersion: 0 },
      partitions: [{
        partitionKey: "memories/2026-08",
        collection: "memories",
        revision: 1,
        records: { "memory-backup-only": { id: "memory-backup-only", type: "photo", assetId: protectedRef } },
        tombstones: {},
      }],
    },
  });

  const protectedMedia = await fixture.main({ action: "getProtectedMediaReferences", familyId });
  assert.equal(protectedMedia.ok, true);
  assert.deepEqual(protectedMedia.references, [protectedRef], "当前记录已无引用时，旧备份中的 fileID 仍必须返回给清理保护层");
}

async function run() {
  const tests = [
    duplicateOperationIsAppliedExactlyOnce,
    differentFieldsMergeAndSameFieldConflictKeepsEvidence,
    legacySnapshotMigratesAtomicallyIntoCoreAndMonthlyPartitions,
    legacySnapshotCannotOverwriteNewerPartitions,
    manualBackupAndExportContainEveryAuthoritativePartition,
    partitionRestoreIsAtomicAndKeepsAPreRestoreProtectionBackup,
    corruptedPartitionBackupCannotChangeCurrentFamilyData,
    onlyOwnerCreatesBackupAndBackupAdminMayRestoreIt,
    inactiveMemberCannotLoadOrSyncAuthoritativePartitions,
    backupOnlyMediaReferencesRemainProtected,
  ];
  for (const test of tests) {
    await test();
    console.log(`✓ ${test.name}`);
  }
  console.log(`Family partition API tests: ${tests.length}/${tests.length} passed`);
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
