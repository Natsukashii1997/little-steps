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

test("坏存储拒绝读取，纯规范化仍可整理输入", () => {
  repo.__setApi(fakeWx({ corruptRead: true }));
  assert.throws(() => repo.load(), /读取|损坏/);
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
  assert.throws(() => repo.setBaby({ name: "硕之", birthDate: "2026-08-04" }), /确认/);
  assert.throws(() => repo.getData(), /读取|确认/);
  assert.equal(repo.load().baby, null);
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

test("读取异常后禁止初始化覆盖，成功重读后原记录仍在", () => {
  const api = fakeWx();
  repo.__setApi(api);
  repo.setBaby({ name: "硕之", birthDate: "2026-08-04" });
  repo.addRecord({ at: "2026-10-23T10:00", text: "原有记录" });
  const original = JSON.stringify(api.storage[repo.STORAGE_KEY]);
  const read = api.getStorageSync;
  let failing = true;
  api.getStorageSync = (key) => { if (failing) throw new Error("read-failed"); return read(key); };
  assert.throws(() => repo.load(), /读取/);
  assert.throws(() => repo.setBaby({ name: "新名字", birthDate: "2026-08-04" }), /读取/);
  assert.throws(() => repo.save(repo.emptyData()), /读取/);
  assert.equal(JSON.stringify(api.storage[repo.STORAGE_KEY]), original);
  failing = false;
  assert.equal(repo.load().records[0].text, "原有记录");
  repo.setBaby({ name: "改名字", birthDate: "2026-08-04" });
  assert.equal(repo.listRecords().length, 1);
});

test("冷启动读取失败或结构损坏均不得写空档案", () => {
  for (const raw of ["broken", {}, { schemaVersion: 5, baby: null, records: "broken" }]) {
    const api = fakeWx();
    api.storage[repo.STORAGE_KEY] = raw;
    repo.__setApi(api);
    assert.throws(() => repo.load(), /读取|损坏/);
    assert.throws(() => repo.setBaby({ name: "硕之", birthDate: "2026-08-04" }), /读取|损坏/);
    assert.deepEqual(api.storage[repo.STORAGE_KEY], raw);
  }
});

test("所有读取页面失败都不跳首次设置，重试后原记录仍在", () => {
  for (const page of ["today", "setup", "records", "growth", "stage", "album"]) {
    const api = fakeWx();
    repo.__setApi(api);
    repo.setBaby({ name: "硕之", birthDate: "2026-08-04" });
    repo.addRecord({ at: "2026-10-23T10:00", text: "原有记录" });
    const original = JSON.stringify(api.storage[repo.STORAGE_KEY]);
    const read = api.getStorageSync;
    let failing = true;
    api.getStorageSync = key => { if (failing) throw new Error("synthetic-read"); return read(key); };
    let retry;
    let redirected = false;
    const previousWx = global.wx;
    const previousPage = global.Page;
    let instance;
    global.wx = { showModal(options) { retry = options.success; }, redirectTo() { redirected = true; } };
    global.Page = definition => {
      instance = Object.assign({}, definition, { data: Object.assign({}, definition.data), setData(update) { Object.assign(this.data, update); } });
    };
    try {
      const file = require.resolve("../miniprogram/pages/v5/" + page + "/index");
      delete require.cache[file];
      require(file);
      instance[page === "setup" ? "onLoad" : page === "album" ? "onShow" : "refresh"]();
      assert.equal(redirected, false);
      assert.equal(typeof retry, "function");
      assert.equal(JSON.stringify(api.storage[repo.STORAGE_KEY]), original);
      failing = false;
      retry({ confirm: true });
      assert.equal(instance.data[page === "setup" ? "editing" : "ready"], true);
      assert.equal(repo.listRecords().length, 1);
    } finally {
      global.wx = previousWx;
      global.Page = previousPage;
    }
  }
});

test("启动读取失败不会中断进入页面的重试路径", () => {
  const api = fakeWx();
  api.getStorageSync = () => { throw new Error("synthetic-read"); };
  repo.__setApi(api);
  const Module = require("node:module");
  const originalLoad = Module._load;
  const originalApp = global.App;
  const originalWarn = console.warn;
  let instance;
  Module._load = function (request, parent, isMain) {
    if (request === "./config.local") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  global.App = definition => { instance = definition; };
  console.warn = () => {};
  try {
    const file = require.resolve("../miniprogram/app");
    delete require.cache[file];
    require(file);
    assert.doesNotThrow(() => instance.onLaunch());
    assert.equal(api.storage[repo.STORAGE_KEY], undefined);
  } finally {
    Module._load = originalLoad;
    global.App = originalApp;
    console.warn = originalWarn;
  }
});

for (const failure of ["throw", "mismatch"]) {
  test("写盘成功但回读" + failure + "后锁住旧缓存，成功重读保留原提交和草稿", () => {
    const api = fakeWx();
    repo.__setApi(api);
    repo.setBaby({ name: "硕之", birthDate: "2026-08-04" });
    repo.addRecord({ at: "2026-11-01T10:00", text: "original" });
    const draft = { at: "2026-11-02T10:00", text: "new-A" };
    repo.saveDraft(draft);
    const read = api.getStorageSync;
    let failNextRead = true;
    api.getStorageSync = key => {
      if (key === repo.STORAGE_KEY && failNextRead) {
        failNextRead = false;
        if (failure === "throw") throw new Error("synthetic-readback");
        return { schemaVersion: 5, baby: null, records: [], updatedAt: "" };
      }
      return read(key);
    };
    assert.throws(() => repo.addRecord(draft));
    assert.deepEqual(api.storage[repo.STORAGE_KEY].records.map(x => x.text), ["original", "new-A"]);
    const saved = JSON.stringify(api.storage[repo.STORAGE_KEY]);
    assert.throws(() => repo.addRecord({ at: "2026-11-03T10:00", text: "new-B" }), /读取|确认/);
    assert.throws(() => repo.save(repo.emptyData()), /读取|确认/);
    assert.equal(JSON.stringify(api.storage[repo.STORAGE_KEY]), saved);
    assert.deepEqual(repo.loadDraft(), draft);
    api.getStorageSync = key => { if (key === repo.STORAGE_KEY) throw new Error("retry-read-failed"); return read(key); };
    assert.throws(() => repo.load(), /保存结果未能确认/);
    assert.throws(() => repo.addRecord({ at: "2026-11-03T10:00", text: "still-blocked" }), /确认/);
    api.getStorageSync = read;
    assert.deepEqual(repo.load().records.map(x => x.text), ["original", "new-A"]);
    repo.addRecord({ at: "2026-11-03T10:00", text: "new-B" });
    assert.deepEqual(repo.listRecords().map(x => x.text), ["original", "new-A", "new-B"]);
  });
}

console.log("v5-repo：通过 " + passed + "，失败 " + failed);
if (failed) process.exit(1);
