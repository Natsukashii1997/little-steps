"use strict";

// 今天页头部的显示规则（审查 B13）：
// - 那句话：这个月最近一条「看到了」的观察；
// - 没有记录：月龄窗口第一天写「新的一个月开始了。」，其他日子写「这个月还没有记录。」，插画换成 ill-home-leaf。

const age = require("./age");
const recordsView = require("./records-view");

const ILL_SLEEP = "/assets/v5/ill-home-sleep.png";
const ILL_LEAF = "/assets/v5/ill-home-leaf.png";
const RECENT_COUNT = 3;

function monthObservations(records, window) {
  return recordsView.monthRecords(records, window).filter(function (record) { return record.type === "observe"; });
}

// points：本月龄的观察点，用来把只挑了条目、没写字的记录显示出来
function buildTodayView(data, today, points) {
  const baby = data.baby;
  const parts = age.ageParts(baby.birthDate, today);
  const window = age.monthWindow(baby.birthDate, today);
  const observations = monthObservations(data.records, window);
  const seen = observations
    .filter(function (record) { return record.seen === "seen" && recordsView.displayText(record, points); })[0];
  const rows = recordsView.monthRows(data.records, window, points, today);

  let lead;
  let leadSub;
  let illustration;
  if (seen) {
    lead = "这个月，\n" + recordsView.displayText(seen, points).replace(/[。．.]+$/, "") + "。";
    leadSub = age.formatMonthDay(seen.at.slice(0, 10)) + " 家里记的";
    illustration = ILL_SLEEP;
  } else if (parts.days === 0 && parts.months > 0) {
    lead = "新的一个月\n开始了。";
    leadSub = "看到什么，随手记一笔。";
    illustration = ILL_LEAF;
  } else {
    lead = "这个月，\n还没有记录。";
    leadSub = "看到什么，随手记一笔。";
    illustration = ILL_LEAF;
  }

  return {
    dateHeading: age.dateHeading(today),
    name: baby.name,
    nameClass: baby.name.length >= 3 ? "name-long" : "",
    ageLabel: age.ageLabel(parts),
    window: window,
    lead: lead,
    leadSub: leadSub,
    illustration: illustration,
    monthCount: rows.length,
    recent: rows.slice(0, RECENT_COUNT),
  };
}

module.exports = { buildTodayView, monthObservations, ILL_SLEEP, ILL_LEAF, RECENT_COUNT };
