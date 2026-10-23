"use strict";

// 阶段内容表（0–12 月龄）。只放常浩逐月确认过的月份：起草稿在 docs/content/阶段内容表.md，
// 常浩确认一个月，就把那个月抄进来并把月龄加进 confirmedMonths；没确认的月份页面按空状态显示。
// 每条：{ id, text }，text 一句话、不下判断、不写疫苗名和剂量。
// 四类：observe（这个月可能看到的，观察点）、play（可以陪宝宝玩的）、notice（要留意的）、arrange（要安排的）。

module.exports = {
  version: "2026-10-24",
  source: "内容整理自公开的儿童保健资料，以儿保医生的意见为准",
  confirmedMonths: [],
  months: {},
};
