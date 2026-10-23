"use strict";

// 记录的改、删、30 天清理（审查 B2）。
const assert = require("node:assert/strict");
const repo = require("../miniprogram/lib/v5/repo");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("通过", name);
  } catch (error) {
    failed += 1;
    console.log("失败", name, "\n   ", error.message);
  }
}

function fakeWx() {
  const storage = {};
  return {
    storage,
    getStorageSync(key) { return storage[key] === undefined ? "" : JSON.parse(JSON.stringify(storage[key])); },
    setStorageSync(key, value) { storage[key] = JSON.parse(JSON.stringify(value)); },
    removeStorageSync(key) { delete storage[key]; },
  };
}

function fresh() {
  const api = fakeWx();
  repo.__setApi(api);
  repo.setBaby({ name: "硕之", birthDate: "2026-08-04" }, "2026-10-23T12:00:00+08:00");
  return api;
}

test("改一条：文字和条目都能改，updatedAt 更新，id 不变", () => {
  fresh();
  const rec = repo.addRecord({ type: "observe", at: "2026-10-20T10:00", text: "趴着能抬头了。", itemId: "m2-head", seen: "seen" }, "2026-10-20T02:00:00Z");
  const next = repo.updateRecord(rec.id, { text: "趴着能抬头了，撑了好几秒。", itemId: "", seen: "seen" }, "2026-10-21T02:00:00Z");
  assert.equal(next.id, rec.id);
  assert.equal(next.text, "趴着能抬头了，撑了好几秒。");
  assert.equal(next.itemId, "");
  assert.equal(next.updatedAt, "2026-10-21T02:00:00.000Z");
  assert.equal(repo.listRecords().length, 1);
});

test("改成「在等」但没挑条目要报错，原记录不变", () => {
  fresh();
  const rec = repo.addRecord({ type: "observe", at: "2026-10-20T10:00", text: "一句", seen: "seen" });
  assert.throws(() => repo.updateRecord(rec.id, { seen: "waiting", itemId: "" }), /先挑一条/);
  assert.equal(repo.listRecords()[0].seen, "seen");
});

test("删一条：软删除，列表里不见了，存储里还留着 deletedAt", () => {
  const api = fresh();
  const rec = repo.addRecord({ type: "observe", at: "2026-10-20T10:00", text: "一句", seen: "seen" });
  assert.equal(repo.deleteRecord(rec.id, "2026-10-21T00:00:00Z"), true);
  assert.equal(repo.listRecords().length, 0);
  assert.equal(api.storage[repo.STORAGE_KEY].records[0].deletedAt, "2026-10-21T00:00:00.000Z");
  assert.throws(() => repo.updateRecord(rec.id, { text: "x" }), /找不到/);
  assert.throws(() => repo.deleteRecord(rec.id), /找不到/);
});

test("删满 30 天才清掉；没满的留着", () => {
  fresh();
  const a = repo.addRecord({ type: "observe", at: "2026-09-01T10:00", text: "a", seen: "seen" });
  const b = repo.addRecord({ type: "observe", at: "2026-09-02T10:00", text: "b", seen: "seen" });
  repo.deleteRecord(a.id, "2026-09-10T00:00:00Z");
  repo.deleteRecord(b.id, "2026-10-01T00:00:00Z");
  assert.equal(repo.purgeDeleted("2026-10-20T00:00:00Z"), 1);
  assert.equal(repo.getData().records.length, 1);
  assert.equal(repo.getData().records[0].id, b.id);
});

console.log("\nv5-repo-edit：通过", passed, "失败", failed);
process.exit(failed ? 1 : 0);
