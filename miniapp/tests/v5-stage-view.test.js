"use strict";

const assert = require("node:assert/strict");
const stageView = require("../miniprogram/lib/v5/stage-view");
const recordsView = require("../miniprogram/lib/v5/records-view");

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

const TODAY = "2026-10-24";
const WINDOW = { start: "2026-10-04", end: "2026-11-03" };
const POINTS = [
  { id: "m2-head", text: "趴着能抬头" },
  { id: "m2-hands", text: "两只手碰到一起" },
  { id: "m2-smile", text: "逗一逗会笑出声" },
];
const PLAY = [{ id: "m2-play-tummy", text: "清醒时趴一会儿" }, { id: "m2-play-talk", text: "说说话" }];
const RECORDS = [
  { id: "r1", type: "observe", at: "2026-10-18T10:00", itemId: "m2-head", seen: "seen", text: "" },
  { id: "r2", type: "observe", at: "2026-10-21T10:00", itemId: "m2-hands", seen: "waiting", text: "" },
  { id: "r3", type: "observe", at: "2026-10-24T09:00", itemId: "", seen: "seen", text: "抓着我的手指不放。" },
  { id: "r4", type: "observe", at: "2026-10-20T10:00", itemId: "m2-play-tummy", seen: "seen", text: "" },
  { id: "r5", type: "observe", at: "2026-10-22T10:00", itemId: "m2-head", seen: "seen", text: "", deletedAt: "2026-10-23T00:00:00Z" },
  { id: "r6", type: "observe", at: "2026-09-20T10:00", itemId: "", seen: "seen", text: "上个月的" },
];

test("家里看到的：看到了＝勾＋日期，在等＝虚线圈，没记过＝短横", () => {
  const rows = stageView.homeSeenRows(POINTS, RECORDS, TODAY);
  assert.deepEqual(rows.map((r) => r.state), ["done", "waiting", "none"]);
  assert.equal(rows[0].right, "10月18日");
  assert.equal(rows[0].mark, stageView.MARKS.done);
  assert.equal(rows[1].right, "在等");
  assert.equal(rows[2].right, "没记过");
  assert.equal(rows[2].recordId, "");
});

test("软删除的记录不算；同一条目取最新一条", () => {
  const rows = stageView.homeSeenRows(POINTS, RECORDS, TODAY);
  assert.equal(rows[0].recordId, "r1");
  const later = RECORDS.concat([{ id: "r7", type: "observe", at: "2026-10-23T08:00", itemId: "m2-hands", seen: "seen", text: "" }]);
  assert.equal(stageView.homeSeenRows(POINTS, later, TODAY)[1].state, "done");
});

test("可以陪宝宝玩的：试过的带日期，没试过的没有", () => {
  const rows = stageView.playRows(PLAY, RECORDS, TODAY);
  assert.equal(rows[0].tried, true);
  assert.equal(rows[0].date, "10月20日");
  assert.equal(rows[1].tried, false);
  assert.equal(rows[1].date, "");
});

test("自由观察：只取这个月窗口内没挂条目的，倒序，今天写「今天」", () => {
  const rows = stageView.freeRows(RECORDS, WINDOW, TODAY);
  assert.deepEqual(rows.map((r) => r.id), ["r3"]);
  assert.equal(rows[0].date, "今天");
});

test("记录行说明：挂在玩的条目上写「试过了」", () => {
  const points = POINTS.map((p) => Object.assign({ kind: "observe" }, p)).concat(PLAY.map((p) => Object.assign({ kind: "play" }, p)));
  assert.equal(recordsView.rowOf(RECORDS[3], points, TODAY).sub, "观察 · 试过了");
  assert.equal(recordsView.rowOf(RECORDS[1], points, TODAY).sub, "观察 · 在等，还没看到");
  assert.equal(recordsView.rowOf(RECORDS[2], points, TODAY).sub, "观察 · 看到了");
});

console.log("\nv5-stage-view：通过", passed, "失败", failed);
process.exit(failed ? 1 : 0);
