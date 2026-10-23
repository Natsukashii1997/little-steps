"use strict";

const HISTORY_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function validTime(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function planRetention(snapshot, nowValue) {
  const now = new Date(nowValue === undefined ? Date.now() : nowValue);
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) throw new Error("清理时间无效");

  const source = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {};
  const data = clone(source);
  const trashEntries = Array.isArray(source.trashEntries) ? source.trashEntries : [];
  const historyEntries = Array.isArray(source.recordHistory) ? source.recordHistory : [];
  const historyCutoff = nowTime - HISTORY_RETENTION_DAYS * DAY_MS;

  function trashExpired(entry) {
    const expiry = validTime(entry && entry.expiresAt);
    return expiry !== null && expiry <= nowTime;
  }
  const removedTrashEntries = trashEntries.filter(trashExpired);

  function historyExpired(entry) {
    const changedAt = validTime(entry && entry.changedAt);
    return changedAt !== null && changedAt <= historyCutoff;
  }
  const removedHistoryEntries = historyEntries.filter(historyExpired);

  data.trashEntries = trashEntries.filter(function (entry) { return !trashExpired(entry); }).map(clone);
  data.recordHistory = historyEntries.filter(function (entry) { return !historyExpired(entry); }).map(clone);

  return {
    changed: removedTrashEntries.length > 0 || removedHistoryEntries.length > 0,
    data: data,
    removedTrashEntries: clone(removedTrashEntries),
    removedHistoryEntries: clone(removedHistoryEntries),
  };
}

module.exports = {
  HISTORY_RETENTION_DAYS,
  planRetention,
};
