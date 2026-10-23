"use strict";

// 这个月页与成长页的行算法：条目（观察点、可以陪宝宝玩的）的状态由挂在它上面的最新一条记录决定。
// 成长·家里看到的：没记过＝短横；在等＝虚线圈；看到了＝勾＋日期（规范 5.1）。
const age = require("./age");

const MARKS = {
  done: "/assets/v5/mark-done.png",
  waiting: "/assets/v5/mark-not-yet.png",
  none: "/assets/v5/mark-none.png",
};

function live(records) {
  return (records || []).filter(function (r) { return r && !r.deletedAt && r.type === "observe"; });
}

function dayLabel(at, today) {
  const date = at.slice(0, 10);
  return date === today ? "今天" : age.formatMonthDay(date);
}

// 每个条目只看最新一条记录
function latestByItem(records) {
  const map = {};
  live(records).forEach(function (r) {
    if (!r.itemId) return;
    const current = map[r.itemId];
    if (!current || r.at > current.at) map[r.itemId] = r;
  });
  return map;
}

function homeSeenRows(points, records, today) {
  const latest = latestByItem(records);
  return (points || []).map(function (p) {
    const r = latest[p.id];
    const state = !r ? "none" : r.seen === "waiting" ? "waiting" : "done";
    return {
      id: p.id,
      text: p.text,
      state: state,
      mark: MARKS[state],
      right: state === "done" ? dayLabel(r.at, today) : state === "waiting" ? "在等" : "没记过",
      recordId: r ? r.id : "",
    };
  });
}

function playRows(items, records, today) {
  const latest = latestByItem(records);
  return (items || []).map(function (p) {
    const r = latest[p.id];
    const tried = !!r && r.seen !== "waiting";
    return { id: p.id, text: p.text, tried: tried, date: tried ? dayLabel(r.at, today) : "", recordId: r ? r.id : "" };
  });
}

// 自由观察：这个月窗口内没挂条目的观察，按时间倒序
function freeRows(records, window, today) {
  return live(records)
    .filter(function (r) { return !r.itemId && r.at >= window.start && r.at <= window.end + "T23:59"; })
    .sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; })
    .map(function (r) { return { id: r.id, text: r.text, mark: MARKS.done, date: dayLabel(r.at, today) }; });
}

module.exports = { MARKS, latestByItem, homeSeenRows, playRows, freeRows };
