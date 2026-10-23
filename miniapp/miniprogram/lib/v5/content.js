"use strict";

// 读阶段内容表。没确认的月份一律当作没有内容。
let stages = require("../../content/stages");

function monthContent(index) {
  const confirmed = Array.isArray(stages.confirmedMonths) && stages.confirmedMonths.indexOf(index) >= 0;
  if (!confirmed) return null;
  return (stages.months && stages.months[String(index)]) || null;
}

function listOf(index, kind) {
  const month = monthContent(index);
  return month && Array.isArray(month[kind]) ? month[kind].slice() : [];
}

function observePoints(index) {
  return listOf(index, "observe");
}

function pointText(index, itemId) {
  const hit = observePoints(index).filter(function (p) { return p.id === itemId; })[0];
  return hit ? hit.text : "";
}

module.exports = {
  monthContent,
  listOf,
  observePoints,
  pointText,
  sourceLine() {
    return stages.source || "";
  },
  // 测试用：换一份内容表
  __setStages(next) {
    stages = next;
  },
};
