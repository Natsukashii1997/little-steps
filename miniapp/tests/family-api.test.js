"use strict";

const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function matches(document, criteria) {
  return Object.entries(criteria || {}).every(([key, expected]) => {
    const actual = document[key];
    if (expected && expected.__operator === "in") {
      return Array.isArray(actual) && actual.some((item) => expected.values.includes(item));
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
        const id = `${name}-${nextId}`;
        nextId += 1;
        table.set(id, { _id: id, ...clone(data) });
        return { _id: id };
      },
      where(criteria) {
        let limitValue = Infinity;
        let skipValue = 0;
        let order = null;
        const query = {
          limit(value) {
            limitValue = value;
            return query;
          },
          skip(value) {
            skipValue = value;
            return query;
          },
          orderBy(field, direction) {
            order = { field, direction };
            return query;
          },
          async get() {
            let data = [...table.values()].filter((document) => matches(document, criteria));
            if (order) {
              const multiplier = order.direction === "desc" ? -1 : 1;
              data.sort((left, right) => multiplier * ((left[order.field] || 0) - (right[order.field] || 0)));
            }
            return { data: clone(data.slice(skipValue, skipValue + limitValue)) };
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
    seed(name, id, data) {
      records(name).set(id, { _id: id, ...clone(data) });
    },
    read(name, id) {
      return clone(records(name).get(id));
    },
    all(name) {
      return clone([...records(name).values()]);
    },
  };
}

function loadFactory() {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "wx-server-sdk") {
      return {
        DYNAMIC_CURRENT_ENV: "test",
        init() {},
        database() {
          return createMemoryDatabase();
        },
        getWXContext() {
          return { OPENID: "production-wrapper-test" };
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const modulePath = path.resolve(__dirname, "../cloudfunctions/familyApi/index.js");
    delete require.cache[modulePath];
    return require(modulePath).createFamilyApi;
  } finally {
    Module._load = originalLoad;
  }
}

function createFixture() {
  const createFamilyApi = loadFactory();
  assert.equal(typeof createFamilyApi, "function", "familyApi must expose an offline-testable handler factory");
  const database = createMemoryDatabase();
  let openId = "owner-openid";
  let unique = 0;
  const main = createFamilyApi({
    database,
    getWXContext: () => ({ OPENID: openId }),
    now: () => "2026-08-24T10:00:00.000Z",
    uniqueId: () => `request-${++unique}`,
    logger: { error() {} },
  });
  return {
    database,
    main,
    asOpenId(value) {
      openId = value;
    },
  };
}

async function createFamily(fixture) {
  const created = await fixture.main({ action: "createFamily" });
  assert.equal(created.ok, true);
  assert.equal(created.created, true);
  return created.family.familyId;
}

async function save(fixture, familyId, expectedVersion, data) {
  return fixture.main({ action: "save", familyId, expectedVersion, data });
}

async function preservesExistingFamilyActions() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);

  const bootstrap = await fixture.main({ action: "bootstrap" });
  assert.equal(bootstrap.ok, true);
  assert.equal(bootstrap.joined, true);
  assert.equal(bootstrap.family.familyId, familyId);

  const firstSave = await save(fixture, familyId, 0, { profile: { name: "虚构宝宝" } });
  assert.deepEqual(
    { ok: firstSave.ok, saved: firstSave.saved, version: firstSave.version },
    { ok: true, saved: true, version: 1 },
  );

  const loaded = await fixture.main({ action: "load", familyId });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.snapshot.version, 1);
  assert.equal(loaded.snapshot.data.profile.name, "虚构宝宝");

  const status = await fixture.main({ action: "getStatus", familyId });
  assert.equal(status.ok, true);
  assert.equal(status.joined, true);
  assert.equal(status.family.memberCount, 1);
}

async function savesAreRecoverableAndExportable() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  assert.equal((await save(fixture, familyId, 0, { note: "第一版" })).ok, true);
  assert.equal((await save(fixture, familyId, 1, { note: "第二版" })).ok, true);

  const backups = await fixture.main({ action: "listBackups", familyId });
  assert.equal(backups.ok, true);
  assert.deepEqual(backups.backups.map((item) => item.version), [2, 1]);
  assert.equal(backups.backups[0].reason, "save");
  assert.equal(backups.backups[0].byteLength > 0, true);

  const exported = await fixture.main({ action: "exportFamily", familyId });
  assert.equal(exported.ok, true);
  assert.equal(exported.export.format, "baby-care-family-export-v1");
  assert.equal(exported.export.snapshot.version, 2);
  assert.equal(exported.export.snapshot.data.note, "第二版");
  assert.match(exported.export.snapshot.checksumSha256, /^[a-f0-9]{64}$/);
  assert.equal("inviteCode" in exported.export.family, false);
  assert.equal(exported.capacity.snapshotLimitBytes, 850000);
}

async function ownerCanRestoreAndCurrentVersionIsProtectedFirst() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  await save(fixture, familyId, 0, { note: "恢复目标" });
  await save(fixture, familyId, 1, { note: "恢复前的当前值" });
  const listed = await fixture.main({ action: "listBackups", familyId });
  const target = listed.backups.find((item) => item.version === 1);

  const restored = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: target.backupId,
    expectedVersion: 2,
  });
  assert.deepEqual(
    { ok: restored.ok, restored: restored.restored, version: restored.version, restoredFromVersion: restored.restoredFromVersion },
    { ok: true, restored: true, version: 3, restoredFromVersion: 1 },
  );

  const loaded = await fixture.main({ action: "load", familyId });
  assert.equal(loaded.snapshot.version, 3);
  assert.equal(loaded.snapshot.data.note, "恢复目标");

  const afterRestore = await fixture.main({ action: "listBackups", familyId });
  assert.equal(afterRestore.backups.some((item) => item.version === 2 && item.reason === "pre_restore"), true);
  assert.equal(afterRestore.backups.some((item) => item.version === 3 && item.reason === "restore"), true);
}

async function restoreRejectsStaleVersionAndUnauthorizedCaller() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  await save(fixture, familyId, 0, { note: "不应被改变" });
  const listed = await fixture.main({ action: "listBackups", familyId });
  const backupId = listed.backups[0].backupId;

  const stale = await fixture.main({ action: "restoreBackup", familyId, backupId, expectedVersion: 0 });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "VERSION_CONFLICT");

  fixture.asOpenId("other-openid");
  const forbiddenList = await fixture.main({ action: "listBackups", familyId });
  assert.equal(forbiddenList.error.code, "FORBIDDEN");
  const forbiddenExport = await fixture.main({ action: "exportFamily", familyId });
  assert.equal(forbiddenExport.error.code, "FORBIDDEN");
  const forbiddenRestore = await fixture.main({ action: "restoreBackup", familyId, backupId, expectedVersion: 1 });
  assert.equal(forbiddenRestore.error.code, "FORBIDDEN");

  fixture.asOpenId("owner-openid");
  const loaded = await fixture.main({ action: "load", familyId });
  assert.equal(loaded.snapshot.version, 1);
  assert.equal(loaded.snapshot.data.note, "不应被改变");
}

async function nonOwnerMemberCanReadBackupsButCannotRestore() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const created = await save(fixture, familyId, 0, { note: "家庭数据" });
  assert.equal(created.ok, true);
  const ownerStatus = await fixture.main({ action: "getStatus", familyId });

  fixture.asOpenId("member-openid");
  const joined = await fixture.main({ action: "join", inviteCode: ownerStatus.family.inviteCode });
  assert.equal(joined.ok, true);
  const backups = await fixture.main({ action: "listBackups", familyId });
  assert.equal(backups.ok, true);
  const exported = await fixture.main({ action: "exportFamily", familyId });
  assert.equal(exported.ok, true);
  const restore = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: backups.backups[0].backupId,
    expectedVersion: 1,
  });
  assert.equal(restore.ok, false);
  assert.equal(restore.error.code, "OWNER_REQUIRED");
}

async function memberIdentityPersistsAcrossCreateJoinAndReload() {
  const fixture = createFixture();
  const created = await fixture.main({
    action: "createFamily",
    nickname: "爸爸",
    relation: "父亲",
  });
  assert.equal(created.ok, true);
  assert.deepEqual(created.family.members, [{
    memberId: "owner-openid",
    nickname: "爸爸",
    relation: "父亲",
    role: "owner",
    status: "active",
  }]);

  fixture.asOpenId("grandma-openid");
  const joined = await fixture.main({
    action: "join",
    inviteCode: created.family.inviteCode,
    nickname: "外婆",
    relation: "外婆",
  });
  assert.equal(joined.ok, true);
  assert.deepEqual(joined.family.me, {
    memberId: "grandma-openid",
    nickname: "外婆",
    relation: "外婆",
    role: "member",
    status: "active",
  });

  fixture.asOpenId("owner-openid");
  const reloaded = await fixture.main({ action: "getStatus", familyId: created.family.familyId });
  assert.equal(reloaded.ok, true);
  assert.deepEqual(
    reloaded.family.members.map(({ nickname, relation, role, status }) => ({ nickname, relation, role, status })),
    [
      { nickname: "爸爸", relation: "父亲", role: "owner", status: "active" },
      { nickname: "外婆", relation: "外婆", role: "member", status: "active" },
    ],
  );

  const storedFamily = fixture.database.read("families", created.family.familyId);
  assert.equal(storedFamily.members.length, 2);
  assert.equal(storedFamily.members[1].nickname, "外婆");
  assert.equal(storedFamily.members[1].relation, "外婆");
  assert.equal(storedFamily.members[1].role, "member");
  assert.equal(storedFamily.members[1].status, "active");
}

async function legacyFamilyGetsSafeMemberMetadataUpgradeOnFirstRead() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const stored = fixture.database.read("families", familyId);
  const { members: _discardedMembers, backupAdminOpenId: _discardedAdmin, ...legacyFamily } = stored;
  fixture.database.seed("families", familyId, { ...legacyFamily, maxMembers: 5 });

  const status = await fixture.main({ action: "getStatus", familyId });
  assert.equal(status.ok, true);
  assert.equal(status.family.maxMembers, 6);
  assert.deepEqual(status.family.members, [{
    memberId: "owner-openid",
    nickname: "家庭所有者",
    relation: "",
    role: "owner",
    status: "active",
  }]);

  const upgraded = fixture.database.read("families", familyId);
  assert.equal(upgraded.maxMembers, 6);
  assert.deepEqual(upgraded.members, [{
    openId: "owner-openid",
    nickname: "家庭所有者",
    relation: "",
    role: "owner",
    status: "active",
  }]);
  assert.equal(upgraded.backupAdminOpenId, null);
}

async function ownerCanAssignBackupAdminWhoCanRestoreButOrdinaryMemberCannot() {
  const fixture = createFixture();
  const created = await fixture.main({ action: "createFamily", nickname: "爸爸", relation: "父亲" });
  const familyId = created.family.familyId;
  await save(fixture, familyId, 0, { note: "可恢复版本" });

  fixture.asOpenId("mother-openid");
  const mother = await fixture.main({
    action: "join",
    inviteCode: created.family.inviteCode,
    nickname: "妈妈",
    relation: "母亲",
  });
  assert.equal(mother.ok, true);

  fixture.asOpenId("grandpa-openid");
  const grandpa = await fixture.main({
    action: "join",
    inviteCode: created.family.inviteCode,
    nickname: "外公",
    relation: "外公",
  });
  assert.equal(grandpa.ok, true);

  fixture.asOpenId("owner-openid");
  const assigned = await fixture.main({
    action: "setBackupAdmin",
    familyId,
    memberId: "mother-openid",
  });
  assert.equal(assigned.ok, true);
  assert.equal(assigned.family.members.find((item) => item.memberId === "mother-openid").role, "backup-admin");

  fixture.asOpenId("grandpa-openid");
  const ordinaryRestore = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: fixture.database.all("family_backups")[0]._id,
    expectedVersion: 1,
  });
  assert.equal(ordinaryRestore.ok, false);
  assert.equal(ordinaryRestore.error.code, "OWNER_REQUIRED");

  fixture.asOpenId("mother-openid");
  const backupAdminStatus = await fixture.main({ action: "getStatus", familyId });
  assert.equal(backupAdminStatus.family.role, "backup-admin");
  const adminRestore = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: fixture.database.all("family_backups")[0]._id,
    expectedVersion: 1,
  });
  assert.equal(adminRestore.ok, true);
  assert.equal(adminRestore.restored, true);
  assert.equal(adminRestore.version, 2);
}

async function revokedBackupAdminIsDeniedOnTheVeryNextSensitiveRequest() {
  const fixture = createFixture();
  const created = await fixture.main({ action: "createFamily" });
  const familyId = created.family.familyId;
  await save(fixture, familyId, 0, { note: "权限复核" });

  fixture.asOpenId("member-openid");
  await fixture.main({
    action: "join",
    inviteCode: created.family.inviteCode,
    nickname: "妈妈",
    relation: "母亲",
  });
  fixture.asOpenId("owner-openid");
  assert.equal((await fixture.main({
    action: "setBackupAdmin",
    familyId,
    memberId: "member-openid",
  })).ok, true);

  const revoked = await fixture.main({ action: "setBackupAdmin", familyId, memberId: null });
  assert.equal(revoked.ok, true);
  assert.equal(revoked.family.members.find((item) => item.memberId === "member-openid").role, "member");

  fixture.asOpenId("member-openid");
  const denied = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: fixture.database.all("family_backups")[0]._id,
    expectedVersion: 1,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "OWNER_REQUIRED");
}

async function backupAdminCanMaintainMemberIdentityButOrdinaryMemberCannot() {
  const fixture = createFixture();
  const created = await fixture.main({ action: "createFamily" });
  const familyId = created.family.familyId;

  fixture.asOpenId("mother-openid");
  await fixture.main({ action: "join", inviteCode: created.family.inviteCode, nickname: "妈妈", relation: "母亲" });
  fixture.asOpenId("grandpa-openid");
  await fixture.main({ action: "join", inviteCode: created.family.inviteCode, nickname: "外公", relation: "外公" });
  fixture.asOpenId("owner-openid");
  await fixture.main({ action: "setBackupAdmin", familyId, memberId: "mother-openid" });

  fixture.asOpenId("mother-openid");
  const updated = await fixture.main({
    action: "updateMember",
    familyId,
    memberId: "grandpa-openid",
    nickname: "硕之外公",
    relation: "外公",
  });
  assert.equal(updated.ok, true);
  assert.deepEqual(
    updated.family.members.find((item) => item.memberId === "grandpa-openid"),
    {
      memberId: "grandpa-openid",
      nickname: "硕之外公",
      relation: "外公",
      role: "member",
      status: "active",
    },
  );

  const statusDenied = await fixture.main({
    action: "updateMember",
    familyId,
    memberId: "grandpa-openid",
    status: "inactive",
  });
  assert.equal(statusDenied.ok, false, "备用管理员不得绕过界面停用成员");
  assert.equal(statusDenied.error.code, "OWNER_REQUIRED");
  assert.equal(
    fixture.database.read("families", familyId).members.find((item) => item.openId === "grandpa-openid").status,
    "active",
    "越权停用失败后不得改变成员状态",
  );

  fixture.asOpenId("grandpa-openid");
  const denied = await fixture.main({
    action: "updateMember",
    familyId,
    memberId: "mother-openid",
    nickname: "不应保存",
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, "MANAGER_REQUIRED");
  assert.equal(fixture.database.read("families", familyId).members.find((item) => item.openId === "mother-openid").nickname, "妈妈");
}

async function inactiveMemberCannotReadOrWriteFamilyDataUntilReactivated() {
  const fixture = createFixture();
  const created = await fixture.main({ action: "createFamily", nickname: "爸爸", relation: "父亲" });
  const familyId = created.family.familyId;

  fixture.asOpenId("grandpa-openid");
  assert.equal((await fixture.main({
    action: "join",
    inviteCode: created.family.inviteCode,
    nickname: "外公",
    relation: "外公",
  })).ok, true);

  fixture.asOpenId("owner-openid");
  assert.equal((await fixture.main({
    action: "updateMember",
    familyId,
    memberId: "grandpa-openid",
    status: "inactive",
  })).ok, true);

  fixture.asOpenId("grandpa-openid");
  const bootstrap = await fixture.main({ action: "bootstrap" });
  assert.equal(bootstrap.ok, true);
  assert.equal(bootstrap.joined, true, "停用成员仍应看到自己属于哪个家庭，避免误建第二个家庭");
  assert.equal(bootstrap.family.me.status, "inactive");
  const status = await fixture.main({ action: "getStatus", familyId });
  assert.equal(status.joined, true, "按家庭刷新身份时也必须保留停用状态说明");
  assert.equal(status.family.me.status, "inactive");

  const duplicateFamily = await fixture.main({ action: "createFamily" });
  assert.equal(duplicateFamily.ok, true);
  assert.equal(duplicateFamily.created, false, "停用成员不得绕过家庭限制创建第二个家庭");

  for (const request of [
    { action: "load", familyId },
    { action: "save", familyId, expectedVersion: 0, data: { note: "不应保存" } },
    { action: "listBackups", familyId },
    { action: "exportFamily", familyId },
  ]) {
    const denied = await fixture.main(request);
    assert.equal(denied.ok, false, `${request.action} 必须拒绝已停用成员`);
    assert.equal(denied.error.code, "FORBIDDEN");
  }

  fixture.asOpenId("owner-openid");
  assert.equal((await fixture.main({
    action: "updateMember",
    familyId,
    memberId: "grandpa-openid",
    status: "active",
  })).ok, true);

  fixture.asOpenId("grandpa-openid");
  const activeAgain = await fixture.main({ action: "load", familyId });
  assert.equal(activeAgain.ok, true, "重新启用后应立即恢复家庭数据访问");
}

async function onlyCurrentOwnerCanTransferOwnershipOrDissolveFamily() {
  const fixture = createFixture();
  const created = await fixture.main({ action: "createFamily" });
  const familyId = created.family.familyId;
  fixture.asOpenId("mother-openid");
  await fixture.main({ action: "join", inviteCode: created.family.inviteCode, nickname: "妈妈", relation: "母亲" });

  const deniedTransfer = await fixture.main({
    action: "transferOwnership",
    familyId,
    memberId: "mother-openid",
  });
  assert.equal(deniedTransfer.error.code, "OWNER_REQUIRED");
  const deniedDissolve = await fixture.main({ action: "dissolveFamily", familyId });
  assert.equal(deniedDissolve.error.code, "OWNER_REQUIRED");

  fixture.asOpenId("owner-openid");
  const transferred = await fixture.main({
    action: "transferOwnership",
    familyId,
    memberId: "mother-openid",
  });
  assert.equal(transferred.ok, true);
  assert.equal(transferred.family.members.find((item) => item.memberId === "mother-openid").role, "owner");
  assert.equal(transferred.family.members.find((item) => item.memberId === "owner-openid").role, "backup-admin");

  const staleOwnerDenied = await fixture.main({ action: "dissolveFamily", familyId });
  assert.equal(staleOwnerDenied.error.code, "OWNER_REQUIRED");
  fixture.asOpenId("mother-openid");
  const dissolved = await fixture.main({ action: "dissolveFamily", familyId });
  assert.equal(dissolved.ok, true);
  assert.equal(dissolved.dissolved, true);
  assert.equal(fixture.database.read("families", familyId).status, "dissolved");

  const afterDissolve = await fixture.main({ action: "getStatus", familyId });
  assert.equal(afterDissolve.joined, false);
}

async function sixthMemberCanJoinAndSeventhIsRejectedWithoutMutation() {
  const fixture = createFixture();
  const created = await fixture.main({ action: "createFamily" });
  assert.equal(created.ok, true);
  assert.equal(created.family.memberCount, 1);
  assert.equal(created.family.maxMembers, 6);

  const legacyFamily = fixture.database.read("families", created.family.familyId);
  fixture.database.seed("families", created.family.familyId, { ...legacyFamily, maxMembers: 5 });

  for (let memberNumber = 2; memberNumber <= 6; memberNumber += 1) {
    fixture.asOpenId(`member-openid-${memberNumber}`);
    const joined = await fixture.main({ action: "join", inviteCode: created.family.inviteCode });
    assert.equal(joined.ok, true, `第 ${memberNumber} 位家庭成员应可以加入`);
    assert.equal(joined.family.memberCount, memberNumber);
    assert.equal(joined.family.maxMembers, 6);
  }

  fixture.asOpenId("member-openid-7");
  const rejected = await fixture.main({ action: "join", inviteCode: created.family.inviteCode });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "FAMILY_FULL");

  const storedFamily = fixture.database.read("families", created.family.familyId);
  assert.equal(storedFamily.memberOpenIds.length, 6, "第 7 人被拒绝后不得改动家庭成员");
  assert.equal(storedFamily.memberOpenIds.includes("member-openid-7"), false);
}

async function rollingRetentionKeepsOnlyThirtyRecoverableVersions() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  for (let version = 0; version < 35; version += 1) {
    const result = await save(fixture, familyId, version, { version: version + 1 });
    assert.equal(result.ok, true);
  }

  const listed = await fixture.main({ action: "listBackups", familyId, limit: 100 });
  assert.equal(listed.backups.length, 30);
  assert.deepEqual(listed.backups.map((item) => item.version), Array.from({ length: 30 }, (_, index) => 35 - index));
  assert.equal(fixture.database.all("family_backups").length, 30);
}

async function oversizedOrCorruptBackupCannotBeRestored() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  await save(fixture, familyId, 0, { note: "稳定数据" });

  fixture.database.seed("family_backups", "bad-version", {
    familyId,
    version: -1,
    data: { note: "坏备份" },
    byteLength: 10,
    reason: "save",
  });
  const invalidVersion = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: "bad-version",
    expectedVersion: 1,
  });
  assert.equal(invalidVersion.error.code, "INVALID_BACKUP");

  fixture.database.seed("family_backups", "too-large", {
    familyId,
    version: 1,
    data: { text: "x".repeat(850000) },
    byteLength: 850011,
    reason: "save",
  });
  const tooLarge = await fixture.main({
    action: "restoreBackup",
    familyId,
    backupId: "too-large",
    expectedVersion: 1,
  });
  assert.equal(tooLarge.error.code, "BACKUP_TOO_LARGE");

  const loaded = await fixture.main({ action: "load", familyId });
  assert.equal(loaded.snapshot.version, 1);
  assert.equal(loaded.snapshot.data.note, "稳定数据");
}

async function capacityStatusWarnsBeforeTheCompatibilityLimit() {
  const fixture = createFixture();
  const familyId = await createFamily(fixture);
  const payload = { text: "x".repeat(700000) };
  const saved = await save(fixture, familyId, 0, payload);
  assert.equal(saved.ok, true);
  assert.equal(saved.capacity.snapshotBytes > 700000, true);
  assert.equal(saved.capacity.warning, true);
  assert.equal(saved.capacity.storageFormat, "legacy-snapshot-v1");

  const tooLarge = await save(fixture, familyId, 1, { text: "x".repeat(850000) });
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.error.code, "SNAPSHOT_TOO_LARGE");
}

async function run() {
  const tests = [
    preservesExistingFamilyActions,
    savesAreRecoverableAndExportable,
    ownerCanRestoreAndCurrentVersionIsProtectedFirst,
    restoreRejectsStaleVersionAndUnauthorizedCaller,
    nonOwnerMemberCanReadBackupsButCannotRestore,
    memberIdentityPersistsAcrossCreateJoinAndReload,
    legacyFamilyGetsSafeMemberMetadataUpgradeOnFirstRead,
    ownerCanAssignBackupAdminWhoCanRestoreButOrdinaryMemberCannot,
    revokedBackupAdminIsDeniedOnTheVeryNextSensitiveRequest,
    backupAdminCanMaintainMemberIdentityButOrdinaryMemberCannot,
    inactiveMemberCannotReadOrWriteFamilyDataUntilReactivated,
    onlyCurrentOwnerCanTransferOwnershipOrDissolveFamily,
    sixthMemberCanJoinAndSeventhIsRejectedWithoutMutation,
    rollingRetentionKeepsOnlyThirtyRecoverableVersions,
    oversizedOrCorruptBackupCannotBeRestored,
    capacityStatusWarnsBeforeTheCompatibilityLimit,
  ];
  for (const test of tests) {
    await test();
    console.log(`✓ ${test.name}`);
  }
  console.log(`Family API backup tests: ${tests.length}/${tests.length} passed`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
