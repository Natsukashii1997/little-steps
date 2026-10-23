"use strict";

const { BABY, VACCINE_AGE_ORDER } = require("./constants");

function asDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== "string") return new Date(NaN);
  // Date-only values must be treated as local dates in a Mini Program, rather than UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12);
  }
  return new Date(value);
}
function isDate(value) { return !isNaN(asDate(value).getTime()); }
function dayKey(value) {
  const date = asDate(value);
  if (isNaN(date.getTime())) return "";
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function startOfDay(value) {
  const date = asDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function babyAge(birthDate, nowValue) {
  const birth = asDate(birthDate || BABY.birthDate);
  const now = asDate(nowValue || new Date());
  if (isNaN(birth.getTime()) || isNaN(now.getTime()) || now < birth) return { months: 0, days: 0, totalDays: 0, label: "0 months 0 days" };
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  let anchor = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate(), 12);
  if (anchor > now) {
    months -= 1;
    anchor = new Date(birth.getFullYear(), birth.getMonth() + months, birth.getDate(), 12);
  }
  const days = Math.max(0, Math.floor((startOfDay(now) - startOfDay(anchor)) / 86400000));
  const totalDays = Math.max(0, Math.floor((startOfDay(now) - startOfDay(birth)) / 86400000));
  return { months: months, days: days, totalDays: totalDays, label: months + " months " + days + " days" };
}

function relativeTime(value, nowValue) {
  const from = asDate(value);
  const now = asDate(nowValue || new Date());
  if (isNaN(from.getTime()) || isNaN(now.getTime())) return "暂无记录";
  let seconds = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + " minutes ago";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return hours + " hours" + (remainder ? " " + remainder + " minutes" : "") + " ago";
  const days = Math.floor(hours / 24);
  const hourPart = hours % 24;
  return days + " days" + (hourPart ? " " + hourPart + " hours" : "") + " ago";
}

function latestBy(records, field) {
  return (records || []).filter(function (item) { return item && isDate(item[field]); }).slice().sort(function (a, b) {
    return asDate(b[field]).getTime() - asDate(a[field]).getTime();
  })[0] || null;
}

// Union overlap intervals first. This prevents a manually edited overlapping sleep
// record from being counted twice in the Home card's "今日总时长".
function totalSleepToday(sleeps, nowValue) {
  const now = asDate(nowValue || new Date());
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayEnd = Math.min(now.getTime(), dayStart + 86400000);
  const intervals = (sleeps || []).map(function (item) {
    const start = asDate(item.start).getTime();
    const end = asDate(item.end).getTime();
    if (!isFinite(start) || !isFinite(end) || end <= start) return null;
    return [Math.max(start, dayStart), Math.min(end, dayEnd)];
  }).filter(function (pair) { return pair && pair[1] > pair[0]; }).sort(function (a, b) { return a[0] - b[0]; });
  const merged = [];
  intervals.forEach(function (pair) {
    const last = merged[merged.length - 1];
    if (last && pair[0] <= last[1]) last[1] = Math.max(last[1], pair[1]);
    else merged.push(pair.slice());
  });
  const minutes = Math.round(merged.reduce(function (total, pair) { return total + pair[1] - pair[0]; }, 0) / 60000);
  return { minutes: minutes, hours: Math.floor(minutes / 60), remainderMinutes: minutes % 60, label: minutes + " 分钟" };
}

function careEventSummary(records, nowValue) {
  const targetDay = dayKey(nowValue || new Date());
  const todayRecords = (records || []).filter(function (item) { return dayKey(item.time) === targetDay; });
  const latest = latestBy(records, "time");
  return { count: todayRecords.length, latest: latest, latestTime: latest ? latest.time : "", label: "今日 " + todayRecords.length + " 次" };
}
function poopSummary(poops, nowValue) { return careEventSummary(poops, nowValue); }
function diaperChangeSummary(diaperChanges, nowValue) { return careEventSummary(diaperChanges, nowValue); }

function isVitaminD(record) {
  const name = String(record && record.name || "").replace(/\s+/g, "").toLowerCase();
  return name.indexOf("维生素d") !== -1 || name.indexOf("vitamind") !== -1 || name === "vd";
}
function vitaminDStatus(supplements, nowValue) {
  const targetDay = dayKey(nowValue || new Date());
  const records = (supplements || []).filter(isVitaminD);
  const completed = records.some(function (item) { return item.completed && dayKey(item.date) === targetDay; });
  const latest = records.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0] || null;
  return { completed: completed, label: completed ? "今天已服用" : "今天未服用", latest: latest };
}

function sortGrowthRecords(records) {
  return (records || []).slice().filter(function (item) { return item && isDate(item.date); }).sort(function (a, b) {
    return asDate(a.date).getTime() - asDate(b.date).getTime();
  });
}

function vaccineChoiceFamily(choiceGroup) { return String(choiceGroup || "").split("·")[0]; }
function groupVaccines(vaccines) {
  const byAge = {};
  (vaccines || []).forEach(function (vaccine) {
    const age = vaccine.ageLabel || "其他";
    if (!byAge[age]) byAge[age] = [];
    byAge[age].push(vaccine);
  });
  const known = VACCINE_AGE_ORDER.map(function (ageLabel) {
    return { ageLabel: ageLabel, items: (byAge[ageLabel] || []).slice().sort(function (a, b) { return (a.scheduleOrder || 0) - (b.scheduleOrder || 0); }) };
  });
  const extras = Object.keys(byAge).filter(function (age) { return VACCINE_AGE_ORDER.indexOf(age) === -1; }).sort().map(function (ageLabel) {
    return { ageLabel: ageLabel, items: byAge[ageLabel] };
  });
  return known.concat(extras).filter(function (group) { return group.items.length; });
}

function visibleVaccineGroups(vaccines) {
  const selectedChoices = {};
  (vaccines || []).forEach(function (item) {
    if (item.completedDate && item.choiceGroup) selectedChoices[vaccineChoiceFamily(item.choiceGroup)] = item.choiceGroup;
  });
  return groupVaccines(vaccines).map(function (group) {
    return Object.assign({}, group, { items: group.items.filter(function (item) {
      const family = vaccineChoiceFamily(item.choiceGroup);
      return !family || !selectedChoices[family] || selectedChoices[family] === item.choiceGroup;
    }) });
  });
}

module.exports = {
  asDate, dayKey, babyAge, relativeTime, latestBy, totalSleepToday, poopSummary, diaperChangeSummary,
  isVitaminD, vitaminDStatus, sortGrowthRecords, vaccineChoiceFamily, groupVaccines, visibleVaccineGroups,
};
