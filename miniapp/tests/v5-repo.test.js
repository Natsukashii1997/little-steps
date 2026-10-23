"use strict";

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

function fakeWx(options) {
  const storage = {};
  const settings = Object.assign({ failWrite: false, corruptRead: false }, options);
  return {
    storage,
    getStorageSync(key) {
      if (settings.corruptRead) return "not-json-object";
      return storage[key] === undefined ? "" : JSON.parse(JSON.stringify(storage[key]));
    },
    setStorageSync(key, value) {
      if (settings.failWrite) return; // 假装写成功，其实没写
      storage[key] = JSON.parse(JSON.stringify(value));
    },
  };
}

test("空存储读出合法的空结构", () => {
  repo.__setApi(fakeWx());
  assert.deepEqual(repo.load(), { schemaVersion: 5, baby: null, records: [], updatedAt: "" });
});

test("坏数据也读出合法结构", () => {
  repo.__setApi(fakeWx({ corruptRead: true }));
  assert.equal(repo.load().baby, null);
  repo.__setApi(fakeWx());
  assert.deepEqual(repo.normalize({ baby: { name: "小满", birthDate: "2026-02-30" }, records: [null, 1, { id: "" }, { id: "a" }] }).records, [{ id: "a" }]);
  assert.equal(repo.normalize({ baby: { name: "小满", birthDate: "2026-02-30" } }).baby, null);
});

test("写宝宝信息，写后回读，再次读取还在", () => {
  const api = fakeWx();
  repo.__setApi(api);
  const saved = repo.setBaby({ name: " 硕之 ", birthDate: "2026-08-04" }, "2026-10-23T23:40:00+08:00");
  assert.deepEqual(saved.baby, { name: "硕之", birthDate: "2026-08-04" });
  assert.equal(api.storage[repo.STORAGE_KEY].baby.name, "硕之");
  repo.__setApi(api); // 清缓存，从存储重新读
  assert.deepEqual(repo.getData().baby, { name: "硕之", birthDate: "2026-08-04" });
});

test("写失败时报错，不更新缓存", () => {
  const api = fakeWx({ failWrite: true });
  repo.__setApi(api);
  assert.throws(() => repo.setBaby({ name: "硕之", birthDate: "2026-08-04" }), /没存上/);
  assert.equal(repo.getData().baby, null);
});

test("宝宝信息校验", () => {
  repo.__setApi(fakeWx());
  assert.throws(() => repo.setBaby({ name: "", birthDate: "2026-08-04" }), /名字还没写/);
  assert.throws(() => repo.setBaby({ name: "一二三四五六七八九十一二三", birthDate: "2026-08-04" }), /太长/);
  assert.throws(() => repo.setBaby({ name: "硕之", birthDate: "" }), /还没选/);
  assert.throws(() => repo.setBaby({ name: "硕之", birthDate: "2026-12-01" }, "2026-10-23T12:00:00"), /今天之后/);
});

test("新存储键和旧键不同", () => {
  assert.equal(repo.STORAGE_KEY, "baby-workbench-v5");
  assert.notEqual(repo.STORAGE_KEY, "little-steps-miniapp-family-v1");
});

console.log("v5-repo：通过 " + passed + "，失败 " + failed);
if (failed) process.exit(1);
