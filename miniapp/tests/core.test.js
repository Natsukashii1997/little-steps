"use strict";

const assert = require("assert");
const config = require("../miniprogram/config");
const { VACCINE_SCHEDULE } = require("../miniprogram/lib/constants");
const { createSeedData, CURRENT_SCHEMA_VERSION } = require("../miniprogram/lib/model");
const derive = require("../miniprogram/lib/derive");
const validation = require("../miniprogram/lib/validation");

function test(name, fn) {
  try { fn(); process.stdout.write("✓ " + name + "\n"); }
  catch (error) { process.stderr.write("✗ " + name + "\n" + error.stack + "\n"); process.exitCode = 1; }
}

test("疫苗清单保留 43 针", function () {
  assert.strictEqual(VACCINE_SCHEDULE.length, 43);
  const seed = createSeedData("2026-08-10T12:00:00+08:00");
  assert.strictEqual(seed.vaccines.length, 43);
  assert.strictEqual(seed.vaccines[0].dueDate, "2026-08-04");
  assert.strictEqual(seed.vaccines[2].dueDate, "2026-09-04");
});

test("正式首次启动只保留固定资料与疫苗参考", function () {
  const seed = createSeedData("2026-08-10T12:00:00+08:00");
  assert.strictEqual(CURRENT_SCHEMA_VERSION, 4);
  assert.strictEqual(seed.schemaVersion, 4);
  assert.strictEqual(config.schemaVersion, CURRENT_SCHEMA_VERSION, "运行配置必须和模型 schema 版本一致");
  [
    "feedings", "sleeps", "diapers", "diaperChanges", "poops", "supplements", "todos", "memories",
    "abilities", "checkups",
  ].forEach(function (collection) {
    assert.deepStrictEqual(seed[collection], [], collection + " 不应包含演示业务记录");
  });
  ["musicTracks", "stories", "learningItems", "studySeedVersion"].forEach(function (field) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(seed, field), false, field + " 已下线，不应继续出现在 schema v4");
  });
  assert.deepStrictEqual(seed.baby, {
    name: "硕之", birthDate: "2026-08-04", birthWeight: 2.4, birthHeight: 48,
  });
  assert.deepStrictEqual(seed.growthRecords, [
    { id: "birth-growth", date: "2026-08-04", height: 48, weight: 2.4, note: "出生记录" },
  ]);
  assert.strictEqual(seed.vaccines.length, 43);
  assert.strictEqual(seed.vaccines.some(function (item) { return Boolean(item.completedDate); }), false);
});

test("疫苗按 16 个年龄阶段分组", function () {
  const groups = derive.groupVaccines(createSeedData("2026-08-10T12:00:00+08:00").vaccines);
  assert.strictEqual(groups.length, 16);
  assert.strictEqual(groups[0].ageLabel, "24小时内");
  assert.strictEqual(groups[15].ageLabel, "6周岁");
});

test("月龄按完整月和余下天数计算", function () {
  const age = derive.babyAge("2026-08-04", "2026-09-16T10:00:00+08:00");
  assert.deepStrictEqual({ months: age.months, days: age.days, totalDays: age.totalDays }, { months: 1, days: 12, totalDays: 43 });
  assert.strictEqual(age.label, "1 months 12 days");
});

test("最近喂养时间按真实间隔呈现", function () {
  assert.strictEqual(derive.relativeTime("2026-08-10T02:00", "2026-08-10T03:15"), "1 hours 15 minutes ago");
  assert.strictEqual(derive.relativeTime("2026-08-10T03:14", "2026-08-10T03:15"), "1 minutes ago");
});

test("今日睡眠去重计算跨午夜和重叠记录", function () {
  const result = derive.totalSleepToday([
    { start: "2026-08-09T23:40", end: "2026-08-10T01:00" },
    { start: "2026-08-10T00:30", end: "2026-08-10T02:00" },
    { start: "2026-08-10T10:00", end: "2026-08-10T10:30" },
  ], "2026-08-10T12:00");
  assert.strictEqual(result.minutes, 150);
  assert.strictEqual(result.label, "150 分钟");
});

test("便便次数和最新记录仅依据今日与全量真实记录", function () {
  const records = [
    { time: "2026-08-09T23:59" }, { time: "2026-08-10T08:20" }, { time: "2026-08-10T17:03" },
  ];
  const result = derive.poopSummary(records, "2026-08-10T20:00");
  assert.strictEqual(result.count, 2);
  assert.strictEqual(result.latestTime, "2026-08-10T17:03");
});

test("换尿布与便便首页摘要分别只读取自己的真实集合", function () {
  const diaperChanges = [
    { id: "diaper-1", time: "2026-08-10T07:10", status: "湿尿布" },
    { id: "diaper-2", time: "2026-08-10T16:30", status: "干燥" },
    { id: "diaper-yesterday", time: "2026-08-09T23:50", status: "湿尿布" },
  ];
  const poops = [
    { id: "poop-1", time: "2026-08-10T12:20", status: "正常软便" },
  ];
  const diaperSummary = derive.diaperChangeSummary(diaperChanges, "2026-08-10T20:00");
  const poopSummary = derive.poopSummary(poops, "2026-08-10T20:00");
  assert.deepStrictEqual(
    { count: diaperSummary.count, latestTime: diaperSummary.latestTime },
    { count: 2, latestTime: "2026-08-10T16:30" },
  );
  assert.deepStrictEqual(
    { count: poopSummary.count, latestTime: poopSummary.latestTime },
    { count: 1, latestTime: "2026-08-10T12:20" },
  );
});

test("Vitamin D 状态识别中英文名称与完成状态", function () {
  const completed = derive.vitaminDStatus([{ name: "Vitamin D", date: "2026-08-10", completed: true }], "2026-08-10T20:00");
  const pending = derive.vitaminDStatus([{ name: "维生素 D", date: "2026-08-09", completed: true }], "2026-08-10T20:00");
  assert.strictEqual(completed.completed, true);
  assert.strictEqual(pending.completed, false);
});

test("Vitamin D 精确识别不会把其他含 d 的补充剂当成维D", function () {
  assert.strictEqual(derive.isVitaminD({ name: "Vitamin D" }), true);
  assert.strictEqual(derive.isVitaminD({ name: "维生素D" }), true);
  assert.strictEqual(derive.isVitaminD({ name: "VD" }), true);
  assert.strictEqual(derive.isVitaminD({ name: "Kids multivitamin" }), false);
  assert.strictEqual(derive.isVitaminD({ name: "DHA" }), false);
});

test("成长记录按测量日期升序绘图", function () {
  const sorted = derive.sortGrowthRecords([{ date: "2026-08-10" }, { date: "2026-08-04" }, { date: "2026-08-08" }]);
  assert.deepStrictEqual(sorted.map(function (item) { return item.date; }), ["2026-08-04", "2026-08-08", "2026-08-10"]);
});

test("所有实际记录日期统一限制在出生日至今天", function () {
  const now = "2026-08-24T12:00:00+08:00";
  assert.strictEqual(validation.validateDateInLife("2026-08-04", now, "记录日期").ok, true);
  assert.strictEqual(validation.validateDateInLife("2026-08-24", now, "记录日期").ok, true);
  assert.strictEqual(validation.validateDateInLife("2026-08-03", now, "记录日期").ok, false);
  assert.strictEqual(validation.validateDateInLife("2026-08-25", now, "记录日期").ok, false);
  assert.strictEqual(validation.validateDateInLife("2026-02-31", now, "记录日期").ok, false);
  assert.strictEqual(validation.validateDateTimeInLife("2026-08-24T12:01", now, "记录时间").ok, false);
});

test("首页与成长页共享成长记录范围和同日重复规则", function () {
  const existing = [
    { id: "birth-growth", date: "2026-08-04", height: 48, weight: 2.4 },
    { id: "growth-1", date: "2026-08-10", height: 51, weight: 3.4 },
  ];
  const now = "2026-08-24T12:00:00+08:00";
  assert.strictEqual(validation.validateGrowthRecord({ id: "", date: "2026-08-10", height: "52", weight: "3.8" }, existing, now).ok, false);
  assert.strictEqual(validation.validateGrowthRecord({ id: "", date: "2026-08-11", height: "19", weight: "3.8" }, existing, now).ok, false);
  assert.strictEqual(validation.validateGrowthRecord({ id: "", date: "2026-08-11", height: "52", weight: "51" }, existing, now).ok, false);
  const valid = validation.validateGrowthRecord({ id: "", date: "2026-08-11", height: "52", weight: "3.8", note: "测试" }, existing, now);
  assert.strictEqual(valid.ok, true);
  assert.deepStrictEqual({ date: valid.value.date, height: valid.value.height, weight: valid.value.weight }, { date: "2026-08-11", height: 52, weight: 3.8 });
});

test("清空身高只作用于已存在且明确清空的字段，不改变新增和其他字段规则", function () {
  const existing = [{ id:"existing", date:"2026-10-12", height:56, weight:4.6, note:"原备注" }];
  const original = JSON.stringify(existing);
  const now = "2026-10-13T12:00:00+08:00";
  const edit = { id:"existing", date:"2026-10-12", height:"", weight:"4.6", note:"原备注" };
  assert.deepStrictEqual(validation.validateGrowthRecord(edit, existing, now).value,
    { id:"existing", date:"2026-10-12", height:"", weight:4.6, note:"原备注" });
  for (const empty of [null, undefined]) {
    const result = validation.validateGrowthRecord({ ...edit, height:empty }, existing, now);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(result.value, "height"), false);
  }
  const created = validation.validateGrowthRecord({ ...edit, id:"new", date:"2026-10-13" }, existing, now);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(created.value, "height"), false);
  const weightOmitted = validation.validateGrowthRecord({ ...edit, height:"56", weight:"" }, existing, now);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(weightOmitted.value, "weight"), false);
  for (const height of [" ", "19", "201", "NaN"]) assert.strictEqual(validation.validateGrowthRecord({ ...edit, height }, existing, now).ok, false);
  assert.strictEqual(JSON.stringify(existing), original, "校验过程不能修改现有记录");
});

test("已接种替代方案后隐藏同家族未选方案", function () {
  const vaccines = createSeedData("2026-08-10T12:00:00+08:00").vaccines;
  const choice = vaccines.find(function (item) { return item.scheduleKey === "2m-pentavalent-1"; });
  choice.completedDate = "2026-10-04";
  const atTwoMonths = derive.visibleVaccineGroups(vaccines).find(function (group) { return group.ageLabel === "2月龄"; });
  assert.strictEqual(atTwoMonths.items.some(function (item) { return item.scheduleKey === "2m-polio-1"; }), false);
  assert.strictEqual(atTwoMonths.items.some(function (item) { return item.scheduleKey === "2m-pentavalent-1"; }), true);
});

if (process.exitCode) process.exit(process.exitCode);
