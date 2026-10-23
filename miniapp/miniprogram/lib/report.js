"use strict";

const derive = require("./derive");
const { BABY } = require("./constants");

const SECTION_DEFINITIONS = [
  { key: "care", title: "照护摘要", description: "喂养、睡眠、换尿布、便便与 Vitamin D", accent: "#ef6d50" },
  { key: "growth", title: "成长记录", description: "身高、体重与最新测量", accent: "#5c83a8" },
  { key: "health", title: "健康记录", description: "疫苗、发育里程碑与儿保", accent: "#6b814c" },
  { key: "memory", title: "成长回忆", description: "时段内收藏的成长回忆", accent: "#b8655b" },
  { key: "todo", title: "当前待办", description: "当前待办完成情况", accent: "#df9a20" },
];

function pad(value) { return String(value).padStart(2, "0"); }
function localDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return derive.asDate(value);
}
function dayKey(value) {
  const date = localDate(value);
  if (isNaN(date.getTime())) return "";
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
function dateLabel(value) {
  const date = localDate(value);
  if (isNaN(date.getTime())) return "日期未记录";
  return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
}
function inRange(value, startDate, endDate) {
  const key = dayKey(value);
  return Boolean(key && key >= startDate && key <= endDate);
}
function pluralMinutes(value) {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return minutes + " 分钟";
  return hours + " 小时" + (remainder ? " " + remainder + " 分钟" : "");
}
function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function sleepMinutes(sleeps, startDate, endDate) {
  const start = localDate(startDate);
  start.setHours(0, 0, 0, 0);
  const end = localDate(endDate);
  end.setHours(23, 59, 59, 999);
  const intervals = (sleeps || []).map(function (item) {
    const left = derive.asDate(item.start).getTime();
    const right = derive.asDate(item.end).getTime();
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return null;
    return [Math.max(left, start.getTime()), Math.min(right, end.getTime())];
  }).filter(function (item) { return item && item[1] > item[0]; }).sort(function (a, b) { return a[0] - b[0]; });
  const merged = [];
  intervals.forEach(function (interval) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push(interval.slice());
  });
  return merged.reduce(function (total, interval) { return total + interval[1] - interval[0]; }, 0) / 60000;
}
function splitLine(value, maximum) {
  const text = String(value || "");
  const max = maximum || 23;
  if (text.length <= max) return [text];
  const lines = [];
  for (let index = 0; index < text.length; index += max) lines.push(text.slice(index, index + max));
  return lines;
}
function displayLines(values) {
  return (values || []).reduce(function (lines, value) {
    return lines.concat(splitLine(value));
  }, []);
}
function section(key, lines) {
  const definition = SECTION_DEFINITIONS.find(function (item) { return item.key === key; });
  return Object.assign({}, definition, { lines: displayLines(lines) });
}

function careSection(data, startDate, endDate) {
  const feedings = (data.feedings || []).filter(function (item) { return inRange(item.time, startDate, endDate); });
  const diaperChanges = (data.diaperChanges || []).filter(function (item) { return inRange(item.time, startDate, endDate); });
  const poops = (data.poops || []).filter(function (item) { return inRange(item.time, startDate, endDate); });
  const vitamins = (data.supplements || []).filter(function (item) {
    return item.completed && derive.isVitaminD(item) && inRange(item.date, startDate, endDate);
  });
  const totalMilk = feedings.reduce(function (total, item) { return total + safeNumber(item.amount); }, 0);
  return section("care", [
    "喂养 " + feedings.length + " 次" + (totalMilk ? " · 共 " + Number(totalMilk.toFixed(1)) + " ml" : ""),
    "睡眠 " + pluralMinutes(sleepMinutes(data.sleeps, startDate, endDate)),
    "换尿布 " + diaperChanges.length + " 次 · 便便 " + poops.length + " 次",
    "Vitamin D 已确认 " + new Set(vitamins.map(function (item) { return dayKey(item.date); })).size + " 天",
  ]);
}
function growthSection(data, startDate, endDate) {
  const records = derive.sortGrowthRecords(data.growthRecords).filter(function (item) { return inRange(item.date, startDate, endDate); });
  if (!records.length) return section("growth", ["该时段没有成长测量"]);
  const latest = records[records.length - 1];
  const values = [];
  if (latest.weight !== "" && latest.weight !== undefined && latest.weight !== null) values.push(Number(latest.weight) + " kg");
  if (latest.height !== "" && latest.height !== undefined && latest.height !== null) values.push(Number(latest.height) + " cm");
  return section("growth", [
    "共 " + records.length + " 次测量",
    "最新 " + dateLabel(latest.date) + (values.length ? " · " + values.join(" · ") : ""),
  ]);
}
function healthSection(data, startDate, endDate) {
  const vaccines = (data.vaccines || []).filter(function (item) { return item.completedDate && inRange(item.completedDate, startDate, endDate); });
  const abilities = (data.abilities || []).filter(function (item) { return inRange(item.date, startDate, endDate); });
  const checkups = (data.checkups || []).filter(function (item) { return item.completedDate && inRange(item.completedDate, startDate, endDate); });
  return section("health", [
    "已接种疫苗 " + vaccines.length + " 针",
    "记录发育里程碑 " + abilities.length + " 个",
    "完成儿保 " + checkups.length + " 次",
  ]);
}
function memorySection(data, startDate, endDate) {
  const memories = (data.memories || []).filter(function (item) { return inRange(item.date, startDate, endDate); }).sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
  const lines = ["共收藏 " + memories.length + " 段成长回忆"];
  memories.slice(0, 3).forEach(function (item) { lines.push("· " + (item.title || item.description || "一段回忆")); });
  return section("memory", lines);
}
function todoSection(data) {
  const todos = data.todos || [];
  const completed = todos.filter(function (item) { return item.completed; });
  const pending = todos.filter(function (item) { return !item.completed; });
  const lines = ["已完成 " + completed.length + " / " + todos.length + " 项"];
  pending.slice(0, 3).forEach(function (item) { lines.push("待完成 · " + (item.title || "未命名待办")); });
  if (!pending.length) lines.push(todos.length ? "当前待办已全部完成" : "当前没有待办");
  return section("todo", lines);
}

function buildReport(data, options) {
  const input = data && typeof data === "object" ? data : {};
  const selected = Array.isArray(options.selectedModules) ? options.selectedModules : [];
  const startDate = options.startDate;
  const endDate = options.endDate;
  const factories = {
    care: function () { return careSection(input, startDate, endDate); },
    growth: function () { return growthSection(input, startDate, endDate); },
    health: function () { return healthSection(input, startDate, endDate); },
    memory: function () { return memorySection(input, startDate, endDate); },
    todo: function () { return todoSection(input); },
  };
  const sections = SECTION_DEFINITIONS.filter(function (item) { return selected.indexOf(item.key) !== -1; }).map(function (item) { return factories[item.key](); });
  const generatedAt = localDate(options.generatedAt || new Date());
  const baby = Object.assign({}, BABY, input.baby || {});
  const contentHeight = sections.reduce(function (total, item) { return total + 70 + item.lines.length * 29; }, 0);
  return {
    title: (baby.name || BABY.name || "硕之") + "的成长摘要",
    periodLabel: dateLabel(startDate) + " — " + dateLabel(endDate),
    generatedLabel: "生成于 " + dateLabel(generatedAt),
    sections,
    width: 345,
    height: Math.max(500, 220 + contentHeight),
  };
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawReport(canvas, model, displayWidth, pixelRatio) {
  if (!canvas || typeof canvas.getContext !== "function") throw new Error("长图画布未准备好");
  const width = Math.max(300, Number(displayWidth) || model.width || 345);
  const height = Number(model.height) || 500;
  const dpr = Math.max(1, Number(pixelRatio) || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建长图画布");
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#f6eee3";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(143, 111, 72, 0.10)";
  for (let index = 0; index < 110; index += 1) {
    const x = (index * 83) % Math.round(width);
    const y = (index * 137) % Math.round(height);
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.fillStyle = "#11100e";
  ctx.textAlign = "center";
  ctx.font = "bold 25px STKaiti, KaiTi, serif";
  ctx.fillText(model.title, width / 2, 49);
  ctx.fillStyle = "#ad6a5f";
  ctx.font = "15px STKaiti, KaiTi, serif";
  ctx.fillText(model.periodLabel, width / 2, 76);

  ctx.strokeStyle = "rgba(102, 88, 67, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(26, 98);
  ctx.lineTo(width - 26, 98);
  ctx.stroke();
  ctx.setLineDash([]);

  let top = 118;
  model.sections.forEach(function (item) {
    const cardHeight = 50 + item.lines.length * 29;
    roundRect(ctx, 20, top, width - 40, cardHeight, 16);
    ctx.fillStyle = "rgba(255, 251, 241, 0.74)";
    ctx.fill();
    ctx.strokeStyle = "rgba(39, 34, 27, 0.72)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = item.accent;
    ctx.beginPath();
    ctx.arc(37, top + 27, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#11100e";
    ctx.textAlign = "left";
    ctx.font = "bold 17px STKaiti, KaiTi, serif";
    ctx.fillText(item.title, 51, top + 33);
    ctx.font = "14px STKaiti, KaiTi, serif";
    item.lines.forEach(function (line, lineIndex) {
      ctx.fillText(line, 36, top + 64 + lineIndex * 29);
    });
    top += cardHeight + 20;
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#746b5f";
  ctx.font = "12px STKaiti, KaiTi, serif";
  ctx.fillText("只包含本次手动选择的摘要，不是个人数据备份", width / 2, height - 50);
  ctx.fillText(model.generatedLabel, width / 2, height - 28);
  return { width, height, dpr };
}

module.exports = { SECTION_DEFINITIONS, buildReport, drawReport };
