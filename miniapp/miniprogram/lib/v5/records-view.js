"use strict";

// 记录列表的显示行：今天页「这个月记的」和列表页共用一个算法。
const age = require("./age");

const TYPE_LABELS = { observe: "观察" };

function displayText(record, points) {
  if (record.text) return record.text;
  const hit = (points || []).filter(function (p) { return p.id === record.itemId; })[0];
  return hit ? hit.text : "";
}

function stateLabel(record) {
  if (record.type === "observe") return record.seen === "waiting" ? "在等，还没看到" : "看到了";
  return "";
}

function rowOf(record, points, today) {
  const date = record.at.slice(0, 10);
  const state = stateLabel(record);
  return {
    id: record.id,
    text: displayText(record, points),
    sub: (TYPE_LABELS[record.type] || record.type) + (state ? " · " + state : ""),
    date: date === today ? "今天" : age.formatMonthDay(date),
    time: record.at.slice(11, 16),
  };
}

// 本月龄窗口内、没删的记录，按时间倒序
function monthRecords(records, window) {
  const start = window.start;
  const end = window.end + "T23:59";
  return (records || [])
    .filter(function (record) { return record && !record.deletedAt && record.at >= start && record.at <= end; })
    .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
}

function monthRows(records, window, points, today) {
  return monthRecords(records, window).map(function (record) { return rowOf(record, points, today); });
}

module.exports = { TYPE_LABELS, displayText, stateLabel, rowOf, monthRecords, monthRows };
