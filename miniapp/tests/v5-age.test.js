"use strict";

const assert = require("node:assert/strict");
const age = require("../miniprogram/lib/v5/age");

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

test("硕之 2026-08-04 出生，2026-10-23 是 2 个月 19 天", () => {
  const parts = age.ageParts("2026-08-04", "2026-10-23");
  assert.deepEqual(parts, { months: 2, days: 19 });
  assert.equal(age.ageLabel(parts), "2 个月 19 天");
});

test("出生日当天是整月", () => {
  assert.equal(age.ageLabel(age.ageParts("2026-08-04", "2026-11-04")), "3 个月整");
  assert.equal(age.ageLabel(age.ageParts("2026-08-04", "2026-08-04")), "今天出生");
  assert.equal(age.ageLabel(age.ageParts("2026-08-04", "2026-08-20")), "16 天");
});

test("31 日出生，短月取月末", () => {
  assert.equal(age.ageLabel(age.ageParts("2026-01-31", "2026-02-28")), "1 个月整");
  assert.equal(age.ageLabel(age.ageParts("2026-01-31", "2026-03-01")), "1 个月 1 天");
  assert.equal(age.ageLabel(age.ageParts("2024-02-29", "2025-02-28")), "12 个月整");
});

test("今天在出生之前", () => {
  const parts = age.ageParts("2026-08-04", "2026-08-01");
  assert.equal(parts.beforeBirth, true);
  assert.equal(age.ageLabel(parts), "还没出生");
});

test("月龄窗口从出生日那天起到下个月前一天", () => {
  const window = age.monthWindow("2026-08-04", "2026-10-23");
  assert.deepEqual(window, { index: 2, start: "2026-10-04", end: "2026-11-03", label: "2–3 月龄" });
  assert.equal(age.formatRange(window.start, window.end), "10月4日至11月3日");
  const first = age.monthWindow("2026-08-04", "2026-11-04");
  assert.equal(first.start, "2026-11-04");
  assert.equal(first.index, 3);
});

test("日期显示", () => {
  assert.equal(age.dateHeading("2026-10-23"), "10月23日 周五");
  assert.equal(age.formatMonthDay("2026-01-05"), "1月5日");
  assert.equal(age.formatFullDate("2026-08-04"), "2026年8月4日");
});

test("不合法的日期", () => {
  assert.equal(age.parseDate("2026-02-30"), null);
  assert.equal(age.parseDate("2026/08/04"), null);
  assert.equal(age.parseDate(""), null);
  assert.throws(() => age.ageParts("", "2026-10-23"));
});

console.log("v5-age：通过 " + passed + "，失败 " + failed);
if (failed) process.exit(1);
