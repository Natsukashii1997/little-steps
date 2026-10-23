"use strict";

// 读阶段内容表。确认过的月份照常用；草稿月份（draftMonths）也显示，但 isDraft 为 true，页脚要标出来；
// 其余月份一律当作没有内容。
let stages = require("../../content/stages");

function listed(key, index) {
  return Array.isArray(stages[key]) && stages[key].indexOf(index) >= 0;
}

function monthContent(index) {
  if (!listed("confirmedMonths", index) && !listed("draftMonths", index)) return null;
  return (stages.months && stages.months[String(index)]) || null;
}

function isDraft(index) {
  return !listed("confirmedMonths", index) && listed("draftMonths", index) && !!monthContent(index);
}

function listOf(index, kind) {
  const month = monthContent(index);
  return month && Array.isArray(month[kind]) ? month[kind].slice() : [];
}

function observePoints(index) {
  return listOf(index, "observe");
}

function playItems(index) {
  return listOf(index, "play");
}

function noticeItems(index) {
  return listOf(index, "notice");
}

function noticeItem(index, id) {
  return noticeItems(index).filter(function (n) { return n.id === id; })[0] || null;
}

// 记一笔里「关于哪一条」能挑的条目：观察点在前，可以陪宝宝玩的在后，各带 kind
function pickableItems(index) {
  return observePoints(index).map(function (p) { return { id: p.id, text: p.text, kind: "observe" }; })
    .concat(playItems(index).map(function (p) { return { id: p.id, text: p.text, kind: "play" }; }));
}

function pointText(index, itemId) {
  const hit = pickableItems(index).filter(function (p) { return p.id === itemId; })[0];
  return hit ? hit.text : "";
}

module.exports = {
  monthContent,
  isDraft,
  listOf,
  observePoints,
  playItems,
  noticeItems,
  noticeItem,
  pickableItems,
  pointText,
  // 页脚来源一句：在逗号处换行，390 宽上不会只剩一个字掉到下一行（样式用 pre-line）
  sourceLine() {
    return (stages.source || "").replace("，", "，\n");
  },
  draftLine() {
    return "这个月的内容还是草稿，等你逐月确认。";
  },
  // 测试用：换一份内容表
  __setStages(next) {
    stages = next;
  },
};
