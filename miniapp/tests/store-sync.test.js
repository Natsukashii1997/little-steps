"use strict";

const assert = require("node:assert/strict");
const { createSeedData, CURRENT_SCHEMA_VERSION } = require("../miniprogram/lib/model");
const { legacySnapshot } = require("./migration.test");
const { mergeSnapshotData, resolveFamilySnapshot } = require("../miniprogram/lib/store").__test;

function base(updatedAt) {
  return {
    baby: { name: "硕之", avatarId: "" },
    memories: [], todos: [], feedings: [], sleeps: [], diapers: [], supplements: [],
    growthRecords: [], vaccines: [], abilities: [], checkups: [],
    _updatedSections: {}, _deletedRecords: [], updatedAt: updatedAt || "2026-08-10T00:00:00.000Z",
  };
}

{
  const remote = base("2026-08-10T10:00:00.000Z");
  remote.baby.avatarId = "cloud://new-avatar";
  remote._updatedSections.baby = "2026-08-10T10:00:00.000Z";
  const staleLocal = base("2026-08-10T09:00:00.000Z");
  staleLocal.baby.avatarId = "cloud://old-avatar";
  staleLocal._updatedSections.baby = "2026-08-10T09:00:00.000Z";
  assert.equal(mergeSnapshotData(remote, staleLocal).baby.avatarId, "cloud://new-avatar", "远端较新的宝宝资料不能被旧手机回滚");
}

{
  const remote = base();
  remote.memories = [{ id: "remote", title: "远端回忆", _updatedAt: "2026-08-10T08:00:00.000Z" }];
  const local = base();
  local.memories = [{ id: "local", title: "离线新增", _updatedAt: "2026-08-10T09:00:00.000Z" }];
  const ids = mergeSnapshotData(remote, local).memories.map((item) => item.id).sort();
  assert.deepEqual(ids, ["local", "remote"], "加入家庭时必须保留本机和云端两边的记录");
}

{
  const remote = base();
  remote.todos = [{ id: "todo-1", title: "旧待办", _updatedAt: "2026-08-10T08:00:00.000Z" }];
  const local = base();
  local._deletedRecords = [{ collection: "todos", id: "todo-1", deletedAt: "2026-08-10T09:00:00.000Z" }];
  assert.equal(mergeSnapshotData(remote, local).todos.length, 0, "较新的删除标记必须胜过旧记录");
}

{
  const remote = base();
  remote.memories = [{ id: "same", title: "旧标题", _updatedAt: "2026-08-10T08:00:00.000Z" }];
  const local = base();
  local.memories = [{ id: "same", title: "新标题", _updatedAt: "2026-08-10T09:00:00.000Z" }];
  assert.equal(mergeSnapshotData(remote, local).memories[0].title, "新标题", "同一记录应保留更新时间较新的版本");
}

{
  const remoteSeed = createSeedData("2026-08-10T08:00:00.000Z");
  const newMemberSeed = createSeedData("2026-08-10T09:00:00.000Z");
  const accepted = resolveFamilySnapshot(remoteSeed, newMemberSeed, false);
  assert.equal(accepted.feedings.length, remoteSeed.feedings.length, "新设备的固定初始资料不能重复并入家庭");
  assert.equal(accepted.memories.length, remoteSeed.memories.length, "新家人的回忆示例不能重复并入家庭");
  const mergedAfterLocalEdit = resolveFamilySnapshot(remoteSeed, newMemberSeed, true);
  assert.equal(mergedAfterLocalEdit.feedings.length, remoteSeed.feedings.length, "即使加入前有本机修改，稳定示例 ID 也不能造成喂养记录翻倍");
  assert.equal(mergedAfterLocalEdit.vaccines.length, remoteSeed.vaccines.length, "稳定疫苗参考 ID 不能在家庭合并时翻倍");
}

{
  const remote = base();
  const local = base();
  local.memories.push({ id: "offline-real", title: "加入前真实记录", _updatedAt: "2026-08-10T09:00:00.000Z" });
  const merged = resolveFamilySnapshot(remote, local, true);
  assert.equal(merged.memories[0].id, "offline-real", "加入前确有本地修改时必须保留真实记录");
}

{
  const remoteLegacy = legacySnapshot();
  const accepted = resolveFamilySnapshot(remoteLegacy, createSeedData(), false);
  assert.equal(accepted.feedings.length, 0, "直接采用旧云端快照时也必须清理精确演示记录");
  assert.equal(accepted._deletedRecords.length, 20, "云端净化必须产生可阻止复活的删除标记");
  assert.equal(accepted.schemaVersion, CURRENT_SCHEMA_VERSION, "直接采用云端快照也必须升级结构版本");

  const merged = mergeSnapshotData(remoteLegacy, createSeedData());
  assert.equal(merged.memories.length, 0, "合并入口必须先统一迁移两端快照");
  assert.equal(merged.schemaVersion, CURRENT_SCHEMA_VERSION, "合并结果必须强制为当前结构版本");
}

{
  const editedLegacy = legacySnapshot();
  editedLegacy.todos[0]._updatedAt = "2026-08-20T10:00:00.000Z";
  editedLegacy.todos[0].title = "家人保留的任务";
  const merged = mergeSnapshotData(editedLegacy, createSeedData());
  assert.equal(merged.todos.some(function (item) { return item.title === "家人保留的任务"; }), true, "远端同名用户记录不能被迁移误删");
}

{
  const remoteLegacy = legacySnapshot();
  const editedLocal = createSeedData();
  editedLocal.todos = [{
    id: "demo-todo-vitamin-d",
    title: "家人修改后的任务",
    completed: true,
    _updatedAt: "2026-08-20T10:00:00.000Z",
  }];
  const merged = mergeSnapshotData(remoteLegacy, editedLocal);
  assert.equal(merged.todos.length, 1, "迁移删除标记不能误伤另一台设备上的同名用户记录");
  assert.equal(merged.todos[0].title, "家人修改后的任务");
  assert.equal(merged._deletedRecords.some(function (item) {
    return item.collection === "todos" && item.id === "demo-todo-vitamin-d";
  }), false, "保留用户记录时应同时撤销仅用于旧演示数据的删除标记");
}

console.log("Family sync merge tests: 9/9 passed");
