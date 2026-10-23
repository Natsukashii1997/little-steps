"use strict";

const assert = require("node:assert/strict");
const { buildTodayView, ILL_SLEEP, ILL_LEAF } = require("../miniprogram/lib/v5/today-view");

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

const baby = { name: "硕之", birthDate: "2026-08-04" };

test("没有记录：这个月还没有记录，叶子插画", () => {
  const view = buildTodayView({ baby, records: [] }, "2026-10-23");
  assert.equal(view.dateHeading, "10月23日 周五");
  assert.equal(view.name, "硕之");
  assert.equal(view.nameClass, "");
  assert.equal(view.ageLabel, "2 个月 19 天");
  assert.equal(view.lead, "这个月，\n还没有记录。");
  assert.equal(view.illustration, ILL_LEAF);
});

test("月龄窗口第一天：新的一个月开始了", () => {
  const view = buildTodayView({ baby, records: [] }, "2026-11-04");
  assert.equal(view.ageLabel, "3 个月整");
  assert.equal(view.lead, "新的一个月\n开始了。");
  assert.equal(view.illustration, ILL_LEAF);
});

test("有「看到了」的观察：取这个月最近一条，睡觉插画", () => {
  const records = [
    { id: "a", type: "observe", seen: "seen", text: "逗一逗会笑出声", at: "2026-10-09T10:00" },
    { id: "b", type: "observe", seen: "seen", text: "趴着能抬头了。", at: "2026-10-18T09:30" },
    { id: "c", type: "observe", seen: "waiting", text: "两只手碰到一起", at: "2026-10-20T09:30" },
    { id: "d", type: "observe", seen: "seen", text: "上个月的", at: "2026-09-30T09:30" },
    { id: "e", type: "observe", seen: "seen", text: "删掉的", at: "2026-10-22T09:30", deletedAt: "2026-10-22T10:00" },
  ];
  const view = buildTodayView({ baby, records }, "2026-10-23");
  assert.equal(view.lead, "这个月，\n趴着能抬头了。");
  assert.equal(view.leadSub, "10月18日 家里记的");
  assert.equal(view.illustration, ILL_SLEEP);
});

test("3 个字及以上的名字降一档", () => {
  const view = buildTodayView({ baby: { name: "小满满", birthDate: "2026-08-04" }, records: [] }, "2026-10-23");
  assert.equal(view.nameClass, "name-long");
});

console.log("v5-today-view：通过 " + passed + "，失败 " + failed);
if (failed) process.exit(1);
