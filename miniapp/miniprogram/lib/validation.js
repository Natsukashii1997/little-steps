"use strict";

const { BABY } = require("./constants");

const GROWTH_LIMITS = {
  height: { min: 20, max: 200 },
  weight: { min: 0.5, max: 50 },
};

function pad(value) { return String(value).padStart(2, "0"); }

function todayKey(nowValue) {
  const now = nowValue ? new Date(nowValue) : new Date();
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function parseDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ""));
  if (!match || !parseDateKey(match[1] + "-" + match[2] + "-" + match[3])) return null;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute, second, 0);
}

function failure(message) { return { ok: false, message: message }; }

function validateDateNotBeforeBirth(value, label) {
  const field = label || "日期";
  if (!value) return failure(field + "不能为空");
  if (!parseDateKey(value)) return failure(field + "格式不正确");
  if (value < BABY.birthDate) return failure(field + "不能早于出生日期");
  return { ok: true, value: value };
}

function validateDateInLife(value, nowValue, label) {
  const base = validateDateNotBeforeBirth(value, label);
  if (!base.ok) return base;
  if (value > todayKey(nowValue)) return failure((label || "日期") + "不能晚于今天");
  return base;
}

function validateDateTimeInLife(value, nowValue, label) {
  const field = label || "时间";
  if (!value) return failure(field + "不能为空");
  const parsed = parseDateTime(value);
  if (!parsed) return failure(field + "格式不正确");
  if (String(value).slice(0, 10) < BABY.birthDate) return failure(field + "不能早于出生日期");
  const now = nowValue ? new Date(nowValue) : new Date();
  if (parsed.getTime() > now.getTime()) return failure(field + "不能晚于当前时间");
  return { ok: true, value: value };
}

function validateGrowthRecord(draft, existingRecords, nowValue) {
  const dateResult = validateDateInLife(draft && draft.date, nowValue, "测量日期");
  if (!dateResult.ok) return dateResult;

  const hasHeight = draft.height !== "" && draft.height !== null && typeof draft.height !== "undefined";
  const hasWeight = draft.weight !== "" && draft.weight !== null && typeof draft.weight !== "undefined";
  if (!hasHeight && !hasWeight) return failure("身高和体重请至少填写一项");

  const height = hasHeight ? Number(draft.height) : undefined;
  const weight = hasWeight ? Number(draft.weight) : undefined;
  if (hasHeight && (!Number.isFinite(height) || height < GROWTH_LIMITS.height.min || height > GROWTH_LIMITS.height.max)) {
    return failure("身高请输入 20–200 cm 之间的数字");
  }
  if (hasWeight && (!Number.isFinite(weight) || weight < GROWTH_LIMITS.weight.min || weight > GROWTH_LIMITS.weight.max)) {
    return failure("体重请输入 0.5–50 kg 之间的数字");
  }

  const duplicate = (existingRecords || []).some(function (record) {
    return record.id !== draft.id && record.date === draft.date;
  });
  if (duplicate) return failure("同一天只保留一条成长记录，请编辑已有记录");

  const value = { id: draft.id, date: draft.date, note: String(draft.note || "").trim() };
  if (hasHeight) value.height = height;
  else if (draft.height === "") {
    const previous = (existingRecords || []).find(function (record) { return record.id === draft.id; });
    if (previous && previous.height !== "" && previous.height !== null && typeof previous.height !== "undefined") {
      // Explicitly clear an edited height; omitting it would preserve the old value during upsert.
      value.height = "";
    }
  }
  if (hasWeight) value.weight = weight;
  return { ok: true, value: value };
}

module.exports = {
  GROWTH_LIMITS,
  todayKey,
  validateDateNotBeforeBirth,
  validateDateInLife,
  validateDateTimeInLife,
  validateGrowthRecord,
};
