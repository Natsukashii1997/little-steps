"use strict";

const assert = require("node:assert/strict");
const repo = require("../miniprogram/lib/v5/repo");
const recordsView = require("../miniprogram/lib/v5/records-view");
const content = require("../miniprogram/lib/v5/content");
const { buildTodayView } = require("../miniprogram/lib/v5/today-view");

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

const POINTS = [
  { id: "m2-smile", text: "逗一逗会笑出声" },
  { id: "m2-hands", text: "两只手碰到一起" },
];

function fresh() {
  const api = fakeWx();
  repo.__setApi(api);
  repo.setBaby({ name: "硕之", birthDate: "2026-08-04" }, "2026-10-23T12:00:00+08:00");
  return api;
}

test("记一条观察，写后回读，列表能看到", () => {
  fresh();
  const record = repo.addRecord({ type: "observe", at: "2026-10-18T09:30", text: "趴着能抬头了。", seen: "seen" }, "2026-10-18T09:31:00+08:00");
  assert.ok(record.id.startsWith("rec-"));
  assert.equal(record.seen, "seen");
  assert.equal(repo.listRecords().length, 1);
  assert.equal(repo.listRecords()[0].text, "趴着能抬头了。");
});

test("校验：在等必须挑条目；看到了要有字或条目；时间格式", () => {
  fresh();
  assert.throws(() => repo.addRecord({ type: "observe", at: "2026-10-18T09:30", seen: "waiting" }), /先挑一条/);
  assert.throws(() => repo.addRecord({ type: "observe", at: "2026-10-18T09:30", seen: "seen", text: "  " }), /写一句/);
  assert.throws(() => repo.addRecord({ type: "observe", at: "2026-10-18 09:30", text: "x" }), /时间不对/);
  assert.throws(() => repo.addRecord({ type: "measure", at: "2026-10-18T09:30", text: "x" }), /还不能记/);
  assert.throws(() => repo.addRecord({ type: "observe", at: "2026-10-18T09:30", text: "一".repeat(201) }), /太长/);
  const waiting = repo.addRecord({ type: "observe", at: "2026-10-18T09:30", seen: "waiting", itemId: "m2-hands" });
  assert.equal(waiting.text, "");
  const seenByItem = repo.addRecord({ type: "observe", at: "2026-10-18T09:30", seen: "seen", itemId: "m2-smile" });
  assert.equal(seenByItem.itemId, "m2-smile");
});

test("改一条、删一条（软删除），30 天后清掉", () => {
  fresh();
  const a = repo.addRecord({ type: "observe", at: "2026-10-18T09:30", text: "原来的" }, "2026-10-18T09:31:00+08:00");
  const updated = repo.updateRecord(a.id, { text: "改过的", at: "2026-10-19T08:00" }, "2026-10-19T08:01:00+08:00");
  assert.equal(updated.text, "改过的");
  assert.equal(updated.at, "2026-10-19T08:00");
  assert.throws(() => repo.updateRecord("rec-none", { text: "x" }), /找不到/);
  repo.deleteRecord(a.id, "2026-10-20T10:00:00+08:00");
  assert.equal(repo.listRecords().length, 0);
  assert.equal(repo.getData().records.length, 1, "软删除后原始数据还在");
  assert.equal(repo.purgeDeleted("2026-11-10T10:00:00+08:00"), 0, "不到 30 天不清");
  assert.equal(repo.purgeDeleted("2026-11-20T10:00:01+08:00"), 1, "满 30 天清掉");
  assert.equal(repo.getData().records.length, 0);
});

test("草稿：先放着能回填，取消就清掉", () => {
  const api = fresh();
  assert.equal(repo.loadDraft(), null);
  repo.saveDraft({ type: "observe", seen: "seen", text: "写了一半", itemId: "", at: "2026-10-23T14:20" });
  assert.equal(repo.loadDraft().text, "写了一半");
  assert.ok(api.storage[repo.DRAFT_KEY]);
  repo.clearDraft();
  assert.equal(repo.loadDraft(), null);
});

test("显示行：挑了条目没写字的用条目文字；今天显示「今天」", () => {
  const window = { index: 2, start: "2026-10-04", end: "2026-11-03", label: "2–3 月龄" };
  const records = [
    { id: "a", type: "observe", seen: "seen", text: "趴着能抬头了。", at: "2026-10-18T09:30" },
    { id: "b", type: "observe", seen: "waiting", text: "", itemId: "m2-hands", at: "2026-10-23T08:00" },
    { id: "c", type: "observe", seen: "seen", text: "上个月的", at: "2026-09-30T09:30" },
    { id: "d", type: "observe", seen: "seen", text: "删了的", at: "2026-10-22T09:30", deletedAt: "2026-10-22T10:00:00Z" },
  ];
  const rows = recordsView.monthRows(records, window, POINTS, "2026-10-23");
  assert.deepEqual(rows.map((r) => r.id), ["b", "a"]);
  assert.equal(rows[0].text, "两只手碰到一起");
  assert.equal(rows[0].sub, "观察 · 在等，还没看到");
  assert.equal(rows[0].date, "今天");
  assert.equal(rows[0].time, "08:00");
  assert.equal(rows[1].sub, "观察 · 看到了");
  assert.equal(rows[1].date, "10月18日");
});

test("今天页：这个月记的最多 3 条，总数另算；那句话跳过只挑条目的在等记录", () => {
  const baby = { name: "硕之", birthDate: "2026-08-04" };
  const records = [1, 2, 3, 4].map((n) => ({ id: "r" + n, type: "observe", seen: "seen", text: "第 " + n + " 条", at: "2026-10-1" + n + "T09:00" }));
  records.push({ id: "w", type: "observe", seen: "waiting", text: "", itemId: "m2-hands", at: "2026-10-20T09:00" });
  const view = buildTodayView({ baby, records }, "2026-10-23", POINTS);
  assert.equal(view.monthCount, 5);
  assert.deepEqual(view.recent.map((r) => r.id), ["w", "r4", "r3"]);
  assert.equal(view.lead, "这个月，\n第 4 条。");
});

test("内容表：没列出的月份没有观察点；草稿或确认后能读到", () => {
  assert.deepEqual(content.observePoints(7), []);
  assert.equal(content.isDraft(2), true);
  content.__setStages({ confirmedMonths: [2], draftMonths: [], months: { "2": { observe: POINTS } }, source: "测试来源" });
  assert.equal(content.isDraft(2), false);
  assert.equal(content.observePoints(2).length, 2);
  assert.equal(content.pointText(2, "m2-smile"), "逗一逗会笑出声");
  assert.deepEqual(content.observePoints(3), []);
  assert.equal(content.sourceLine(), "测试来源");
});

console.log("v5-records：通过 " + passed + "，失败 " + failed);
if (failed) process.exit(1);
