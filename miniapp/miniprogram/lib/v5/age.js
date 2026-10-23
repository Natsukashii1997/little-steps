"use strict";

// 月龄与日期：足月出生，只按实际月龄（常浩 2026-10-23）。
// 规则见 docs/slice-plan/UI与功能结构审查-2026-10-23.md B13：
// 月龄按出生日逐月推，「3 个月 2 天」，整月写「4 个月整」；阶段窗口从出生日那天起到下个月前一天。

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

// "YYYY-MM-DD" → 当地时间正午的 Date；不合法返回 null。
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

function dateKey(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function todayKey(now) {
  return dateKey(now ? new Date(now) : new Date());
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// 出生日 + k 个月；那个月没有这一天就取月末（31 日出生，2 月取 28/29 日）。
function monthAnniversary(birth, k) {
  const first = new Date(birth.getFullYear(), birth.getMonth() + k, 1, 12);
  const day = Math.min(birth.getDate(), daysInMonth(first.getFullYear(), first.getMonth()));
  return new Date(first.getFullYear(), first.getMonth(), day, 12);
}

function diffDays(later, earlier) {
  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

// 返回 { months, days }；今天在出生前返回 { months: 0, days: 0, beforeBirth: true }。
function ageParts(birthDate, today) {
  const birth = parseDate(birthDate);
  const now = parseDate(today) || parseDate(todayKey());
  if (!birth) throw new Error("出生日期不合法");
  if (now < birth) return { months: 0, days: 0, beforeBirth: true };
  let months = 0;
  while (monthAnniversary(birth, months + 1) <= now) months += 1;
  const days = diffDays(now, monthAnniversary(birth, months));
  return { months: months, days: days };
}

function ageLabel(parts) {
  if (parts.beforeBirth) return "还没出生";
  if (parts.months === 0) return parts.days === 0 ? "今天出生" : parts.days + " 天";
  if (parts.days === 0) return parts.months + " 个月整";
  return parts.months + " 个月 " + parts.days + " 天";
}

// 当前月龄窗口：{ index, start, end, label }，start/end 为 "YYYY-MM-DD"。
function monthWindow(birthDate, today) {
  const birth = parseDate(birthDate);
  const parts = ageParts(birthDate, today);
  const index = parts.months;
  const start = monthAnniversary(birth, index);
  const next = monthAnniversary(birth, index + 1);
  const end = new Date(next.getTime() - DAY_MS);
  return {
    index: index,
    start: dateKey(start),
    end: dateKey(end),
    label: index + "–" + (index + 1) + " 月龄",
  };
}

function formatMonthDay(dateString) {
  const date = parseDate(dateString);
  if (!date) return "";
  return (date.getMonth() + 1) + "月" + date.getDate() + "日";
}

function formatFullDate(dateString) {
  const date = parseDate(dateString);
  if (!date) return "";
  return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
}

function formatRange(startString, endString) {
  return formatMonthDay(startString) + "至" + formatMonthDay(endString);
}

// 今天页顶上那行：「10月23日 周五」
function dateHeading(dateString) {
  const date = parseDate(dateString);
  if (!date) return "";
  return formatMonthDay(dateString) + " " + WEEKDAYS[date.getDay()];
}

module.exports = {
  parseDate,
  dateKey,
  todayKey,
  monthAnniversary,
  ageParts,
  ageLabel,
  monthWindow,
  formatMonthDay,
  formatFullDate,
  formatRange,
  dateHeading,
};
