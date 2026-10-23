"use strict";

const store = require("../../lib/store");
const derive = require("../../lib/derive");
const media = require("../../lib/media");
const { getHeaderLayout } = require("../../lib/layout");
const { makeId, dateKey, dateTime } = require("../../lib/model");
const { BABY } = require("../../lib/constants");
const validation = require("../../lib/validation");

const FAMILY_RELATIONS = ["父亲", "母亲", "外公", "外婆", "爷爷", "奶奶"];

const COLLECTION_BY_KIND = {
  feeding: "feedings",
  sleep: "sleeps",
  diaper: "diaperChanges",
  poop: "poops",
  growth: "growthRecords",
  todo: "todos",
};

const MANAGER_TITLES = {
  feeding: "喂养记录",
  sleep: "睡眠记录",
  diaper: "换尿布记录",
  poop: "便便记录",
};

const TRASH_TYPE_LABELS = {
  feedings: "喂养",
  sleeps: "睡眠",
  diaperChanges: "换尿布",
  poops: "便便",
  supplements: "健康确认",
  todos: "待办",
  memories: "回忆",
  growthRecords: "成长",
  vaccines: "疫苗",
  abilities: "发育里程碑",
  checkups: "儿保",
};

const CONFLICT_COLLECTION_LABELS = {
  feedings: "喂养记录",
  sleeps: "睡眠记录",
  diaperChanges: "换尿布记录",
  poops: "便便记录",
  supplements: "健康确认",
  todos: "待办",
  memories: "回忆",
  growthRecords: "成长记录",
  vaccines: "疫苗记录",
  abilities: "发育里程碑",
  checkups: "儿保记录",
};

const CONFLICT_FIELD_LABELS = {
  title: "标题",
  name: "名称",
  date: "日期",
  time: "时间",
  start: "开始时间",
  end: "结束时间",
  note: "备注",
  completed: "完成状态",
  completedDate: "接种日期",
  "$record": "整条记录",
};

function pad(value) { return String(value).padStart(2, "0"); }
function nowParts(value) {
  const current = value || new Date();
  return { date: dateKey(current), time: pad(current.getHours()) + ":" + pad(current.getMinutes()) };
}
function splitDateTime(value) {
  const date = derive.asDate(value);
  if (isNaN(date.getTime())) return nowParts();
  return { date: dateKey(date), time: pad(date.getHours()) + ":" + pad(date.getMinutes()) };
}
function combineDateTime(day, time) { return String(day || "") + "T" + String(time || "00:00"); }
function formatTime(value) {
  const date = derive.asDate(value);
  return isNaN(date.getTime()) ? "--:--" : pad(date.getHours()) + ":" + pad(date.getMinutes());
}
function formatDateTime(value) {
  const date = derive.asDate(value);
  return isNaN(date.getTime()) ? "暂无时间" : (date.getMonth() + 1) + "月" + date.getDate() + "日 " + formatTime(date);
}
function homeDate(value) {
  const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return value.getFullYear() + "." + pad(value.getMonth() + 1) + "." + pad(value.getDate()) + " " + week[value.getDay()];
}
function relativeCompact(value, nowValue) {
  const from = derive.asDate(value);
  const now = nowValue || new Date();
  if (isNaN(from.getTime())) return "暂无记录";
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return minutes + "分钟前";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return hours + "小时" + (remainder ? remainder + "分钟前" : "前");
  const days = Math.floor(hours / 24);
  const hourPart = hours % 24;
  return days + "天" + (hourPart ? hourPart + "小时前" : "前");
}
function sortNewest(records, field) {
  return (records || []).slice().sort(function (a, b) {
    return derive.asDate(b[field]).getTime() - derive.asDate(a[field]).getTime();
  });
}
function measurement(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(Number(Number(value).toFixed(2)));
}
function measurementSource(record, baby) {
  if (!record) return '尚未测量';
  const date = String(record.date || '').slice(5).replace('-', '.');
  return (record.date === baby.birthDate ? '出生 · ' : '测量 · ') + date;
}
function hasSleepToday(records, now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (records || []).some(item => {
    const from = derive.asDate(item.start).getTime(), to = derive.asDate(item.end).getTime();
    return Number.isFinite(from) && Number.isFinite(to) && to > from && to > start && from < now.getTime();
  });
}
function minutesBetween(startValue, endValue) {
  const start = derive.asDate(startValue).getTime();
  const end = derive.asDate(endValue).getTime();
  return isFinite(start) && isFinite(end) && end > start ? Math.round((end - start) / 60000) : 0;
}
function errorText(error, fallback) {
  return error && (error.errMsg || error.message) || fallback;
}
function personalCloudErrorText(error, fallback) {
  const message = String(errorText(error, fallback) || fallback);
  return /(家庭|邀请码|邀请|加入|成员)/.test(message) ? fallback : message;
}
function cloudDate(value) {
  if (value && typeof value === "object") {
    if (value.$date) return derive.asDate(value.$date);
    if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
    if (Number.isFinite(value._seconds)) return new Date(value._seconds * 1000);
  }
  return derive.asDate(value);
}
function backupDateLabel(value) {
  const date = cloudDate(value);
  if (isNaN(date.getTime())) return "时间未记录";
  return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate())
    + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}
function backupReasonLabel(reason) {
  if (reason === "pre_restore") return "恢复前保护";
  if (reason === "restore") return "恢复结果";
  if (reason === "manual") return "手动备份";
  return "自动备份";
}
function byteLabel(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return Math.round(bytes) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
function capacityView(value) {
  if (!value || typeof value !== "object") return null;
  const used = Number(value.snapshotBytes !== undefined ? value.snapshotBytes : value.byteLength) || 0;
  const limit = Number(value.snapshotLimitBytes !== undefined ? value.snapshotLimitBytes : value.limitBytes) || 0;
  if (!limit) return null;
  const rawRatio = Number(value.usageRatio !== undefined ? value.usageRatio : value.ratio);
  const ratio = Number.isFinite(rawRatio) ? rawRatio : used / limit;
  return {
    used: byteLabel(used),
    limit: byteLabel(limit),
    percent: Math.min(100, Math.max(0, Math.round(ratio * 1000) / 10)),
    warning: Boolean(value.warning),
  };
}
function conflictValueLabel(value) {
  if (value === undefined || value === null || value === "") return "空白";
  if (value === true) return "是";
  if (value === false) return "否";
  let text;
  if (typeof value === "object") {
    try { text = JSON.stringify(value); } catch (error) { text = "复杂内容"; }
  } else {
    text = String(value);
  }
  return text.length > 48 ? text.slice(0, 45) + "…" : text;
}
function syncConflictView(syncInfo) {
  const conflicts = syncInfo && Array.isArray(syncInfo.conflicts) ? syncInfo.conflicts : [];
  return {
    count: conflicts.length,
    guidance: conflicts.length
      ? "系统已保留最后提交的结果，并覆盖较早的同字段内容。请打开对应页面核对；如果结果不对，请重新编辑并保存。"
      : "",
    items: conflicts.slice(-5).reverse().map(function (conflict, index) {
      return {
        id: conflict.conflictId || conflict.operationId || (String(conflict.recordId || "record") + ":" + String(conflict.field || index)),
        title: (CONFLICT_COLLECTION_LABELS[conflict.collection] || "个人记录") + " · "
          + (CONFLICT_FIELD_LABELS[conflict.field] || conflict.field || "内容"),
        result: "当前保留：" + conflictValueLabel(conflict.winningValue),
        overwritten: "已覆盖：" + conflictValueLabel(conflict.losingValue),
      };
    }),
  };
}
function trashTitle(entry, typeLabel) {
  const record = entry && entry.record || {};
  return String(record.title || record.name || record.label || record.status || record.condition || (typeLabel + "记录"));
}
function remainingDays(expiresValue, nowValue) {
  const remaining = derive.asDate(expiresValue).getTime() - nowValue.getTime();
  return Math.max(1, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}
function localDay(value) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const parsed = derive.asDate(value);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}
function reminderDistance(value, nowValue) {
  const due = localDay(value);
  const today = localDay(nowValue);
  if (!due || !today) return null;
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
function reminderMeta(distance, type) {
  if (type === "todo") return "今天待完成";
  if (distance < 0) return "已超过计划日期 " + Math.abs(distance) + " 天";
  if (distance === 0) return "今天计划完成";
  return distance + " 天后计划完成";
}
function buildReminders(data, nowValue) {
  const reminders = [];
  const seen = Object.create(null);
  function append(type, id, title, dueValue) {
    const key = type + ":" + id;
    if (!id || seen[key]) return;
    const distance = type === "todo" ? null : reminderDistance(dueValue, nowValue);
    if (type !== "todo" && (distance === null || distance > 14)) return;
    seen[key] = true;
    reminders.push({
      key,
      type,
      id,
      title,
      typeLabel: type === "vaccine" ? "疫苗" : (type === "checkup" ? "儿保" : "待办"),
      meta: reminderMeta(distance, type),
      distance,
      sortValue: distance === null ? Number.MAX_SAFE_INTEGER : distance,
    });
  }

  (data.vaccines || []).forEach(function (item) {
    if (item.completedDate || item.completed) return;
    append("vaccine", item.id, [item.name, item.dose].filter(Boolean).join(" · ") || "待接种疫苗", item.dueDate);
  });
  (data.checkups || []).forEach(function (item) {
    if (item.completedDate || item.completed) return;
    append("checkup", item.id, item.name || "待完成儿保", item.date || item.dueDate);
  });
  (data.todos || []).forEach(function (item) {
    if (item.completed) return;
    append("todo", item.id, item.title || "未命名待办", "");
  });

  return reminders.sort(function (a, b) {
    if (a.sortValue !== b.sortValue) return a.sortValue - b.sortValue;
    return a.key.localeCompare(b.key);
  });
}
function familyRoleLabel(role) {
  if (role === "owner") return "家庭所有者";
  if (role === "backup-admin") return "备用管理员";
  return "家庭成员";
}
function canChangeBabyAvatar(syncInfo) {
  const family = syncInfo && syncInfo.family;
  return !family || Boolean(family.owner || family.role === "owner");
}
function familyMemberViews(family) {
  if (!family || !Array.isArray(family.members)) return [];
  const meId = family.me && family.me.memberId || "";
  const canManage = Boolean(family.owner || family.role === "backup-admin");
  return family.members.map(function (member) {
    const isMe = member.memberId === meId;
    const isOwner = member.role === "owner";
    const active = member.status !== "inactive";
    return Object.assign({}, member, {
      initial: String(member.nickname || member.relation || "家").slice(0, 1),
      relationLabel: member.relation || "关系未填写",
      roleLabel: familyRoleLabel(member.role),
      statusLabel: active ? "使用中" : "已停用",
      active,
      isMe,
      canEdit: isMe || (canManage && !isOwner),
      canChangeStatus: Boolean(family.owner && family.role === "owner" && !isOwner),
      canSetBackupAdmin: Boolean(family.owner && active && !isMe && member.role === "member"),
      canRevokeBackupAdmin: Boolean(family.owner && member.role === "backup-admin"),
    });
  });
}
function writeTextFile(filePath, content) {
  return new Promise(function (resolve, reject) {
    const manager = wx.getFileSystemManager();
    manager.writeFile({ filePath, data: content, encoding: "utf8", success: resolve, fail: reject });
  });
}
function shareFile(filePath, fileName) {
  return new Promise(function (resolve, reject) {
    if (typeof wx.shareFileMessage !== "function") {
      reject(new Error("当前微信版本不支持导出文件，请升级微信后重试"));
      return;
    }
    wx.shareFileMessage({ filePath, fileName, success: resolve, fail: reject });
  });
}

Page({
  data: {
    headerHeight: getHeaderLayout().totalHeight,
    birthDate: BABY.birthDate,
    today: validation.todayKey(),
    dateHeading: "",
    baby: Object.assign({}, BABY),
    avatarSrc: "/assets/ui/baby-avatar.webp",
    ageLabel: "0 months 0 days",
    ageMonths: 0,
    ageDays: 0,
    weight: "2.4",
    height: "48",
    feeding: { relative: "暂无记录", time: "--:--", amount: "未记录", milkType: "未记录" },
    sleep: { range: "暂无记录", total: "0 分钟" },
    diaper: { latest: "--:--", count: 0 },
    poop: { latest: "--:--", count: 0 },
    vitamin: { completed: false, label: "今天未服用" },
    todos: [],
    managerOpen: false,
    managerKind: "",
    managerTitle: "",
    managerRecords: [],
    editorOpen: false,
    editorKind: "",
    editorTitle: "",
    editorId: "",
    editorFromManager: false,
    draft: {},
    milkTypes: ["母乳", "配方奶", "混合喂养"],
    diaperConditions: ["未标注", "湿尿布", "干尿布", "与便便同时发生"],
    poopStatuses: ["未标注", "正常软便", "偏稀", "偏干", "其他"],
    uploadingAvatar: false,
    canChangeAvatar: false,
    editorSaving: false,
    syncOpen: false,
    inviteCodeInput: "",
    familyRelations: FAMILY_RELATIONS,
    familyRelationIndex: 0,
    familyProfileNickname: "",
    familyMembers: [],
    familyActionId: "",
    memberEditorOpen: false,
    memberEditorId: "",
    memberEditorNickname: "",
    memberEditorRelationIndex: 0,
    memberEditorStatus: "active",
    memberEditorCanChangeStatus: false,
    syncInfo: { mode: "local", pending: false, error: "", family: null },
    syncConflict: { count: 0, guidance: "", items: [] },
    capacityView: null,
    backups: [],
    backupRetention: 30,
    backupLoading: false,
    backupError: "",
    backupActionId: "",
    exportLoading: false,
    trashEntries: [],
    trashActionId: "",
    undoVisible: false,
    undoTrashId: "",
    undoMessage: "",
    undoToken: "",
    noticeOpen: false,
    reminders: [],
  },

  async onLoad(options) {
    const shouldOpenNotices = options && String(options.openNotices) === "1";
    const app = getApp();
    await (app.globalData.ready || store.init());
    this.unsubscribe = store.subscribe(() => this.refresh());
    this.refresh();
    if (shouldOpenNotices) this.setData({ noticeOpen: true });
    this.clock = setInterval(() => this.refresh(), 60000);
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.clock) clearInterval(this.clock);
  },

  refresh() {
    const data = store.getData();
    const now = this.now ? this.now() : new Date();
    const syncInfo = store.getSyncStatus();
    const baby = Object.assign({}, BABY, data.baby || {});
    const age = derive.babyAge(baby.birthDate, now);
    const growth = derive.sortGrowthRecords(data.growthRecords);
    const weightRecord = growth.slice().reverse().find(function (item) { return item.weight !== "" && item.weight !== undefined && item.weight !== null; });
    const heightRecord = growth.slice().reverse().find(function (item) { return item.height !== "" && item.height !== undefined && item.height !== null; });
    const feeding = derive.latestBy(data.feedings, "time");
    const sleep = derive.latestBy(data.sleeps, "end");
    const sleepTotal = derive.totalSleepToday(data.sleeps, now);
    const diaper = derive.diaperChangeSummary(data.diaperChanges, now);
    const poop = derive.poopSummary(data.poops, now);
    const vitamin = derive.vitaminDStatus(data.supplements, now);

    this.setData({
      dateHeading: homeDate(now),
      today: validation.todayKey(now),
      birthDate: baby.birthDate,
      baby,
      avatarSrc: baby.avatarId || "/assets/ui/baby-avatar.webp",
      ageLabel: age.label,
      ageMonths: age.months,
      ageDays: age.days,
      weight: measurement(weightRecord && weightRecord.weight),
      height: measurement(heightRecord && heightRecord.height),
      weightSource: measurementSource(weightRecord, baby),
      heightSource: measurementSource(heightRecord, baby),
      feeding: {
        hasRecord: Boolean(feeding),
        relative: feeding ? relativeCompact(feeding.time, now) : "暂无记录",
        time: feeding ? formatTime(feeding.time) : "--:--",
        amount: feeding ? feeding.amount + " ml" : "未记录",
        milkType: feeding ? feeding.milkType : "未记录",
      },
      sleep: {
        range: sleep ? formatTime(sleep.start) + "–" + formatTime(sleep.end) : "暂无记录",
        total: hasSleepToday(data.sleeps, now) ? sleepTotal.minutes + " 分钟" : "暂无记录",
      },
      diaper: { latest: diaper.latest ? formatTime(diaper.latest.time) : "--:--", count: diaper.count },
      poop: { latest: poop.latest ? formatTime(poop.latest.time) : "--:--", count: poop.count },
      vitamin: { completed: vitamin.completed, label: vitamin.label },
      todos: (data.todos || []).map(function (item) { return Object.assign({}, item); }),
      reminders: buildReminders(data, now),
      syncInfo,
      syncConflict: syncConflictView(syncInfo),
      canChangeAvatar: canChangeBabyAvatar(syncInfo),
      capacityView: capacityView(syncInfo.capacity),
      familyMembers: familyMemberViews(syncInfo.family),
    });

    if (this.data.managerOpen) this.refreshManager();
  },

  async changeAvatar() {
    if (this.data.uploadingAvatar) return;
    const syncInfo = store.getSyncStatus();
    if (!canChangeBabyAvatar(syncInfo)) {
      wx.showToast({ title: "只有家庭所有者可以更换宝宝头像", icon: "none" });
      return;
    }
    let loadingShown = false;
    try {
      const files = await media.chooseImage({ count: 1 });
      if (!files.length) return;
      if (files[0].size > 12 * 1024 * 1024) throw new Error("照片请控制在 12 MB 以内");
      this.setData({ uploadingAvatar: true });
      wx.showLoading({ title: "正在保存照片" });
      loadingShown = true;
      const uploaded = await media.uploadImage(files[0]);
      const originalAvatarId = store.getData().baby && store.getData().baby.avatarId || "";
      await media.commitChange({
        originalRefs: [originalAvatarId],
        currentRefs: [uploaded.fileID],
        persist: function () {
          return store.mutate(function (next) {
            next.baby = Object.assign({}, BABY, next.baby || {}, { avatarId: uploaded.fileID });
            return next;
          });
        },
      });
      wx.showToast({ title: "头像已保存", icon: "success" });
    } catch (error) {
      if (!String(errorText(error, "")).includes("cancel")) wx.showToast({ title: errorText(error, "照片保存失败"), icon: "none" });
    } finally {
      if (loadingShown) wx.hideLoading();
      this.setData({ uploadingAvatar: false });
    }
  },

  openManager(event) {
    const kind = event.currentTarget.dataset.kind;
    this.openManagerKind(kind);
  },

  openManagerKind(kind) {
    this.setData({ managerOpen: true, managerKind: kind, managerTitle: MANAGER_TITLES[kind] || "记录" });
    this.refreshManager();
  },

  refreshManager() {
    const data = store.getData();
    const kind = this.data.managerKind;
    let records = [];
    if (kind === "feeding") {
      records = sortNewest(data.feedings, "time").map(function (item) {
        return { id: item.id, title: formatDateTime(item.time), detail: item.amount + " ml · " + item.milkType, note: item.note || "" };
      });
    } else if (kind === "sleep") {
      records = sortNewest(data.sleeps, "end").map(function (item) {
        const duration = minutesBetween(item.start, item.end);
        return { id: item.id, title: formatDateTime(item.start), detail: formatTime(item.start) + "–" + formatTime(item.end) + " · " + duration + " 分钟", note: item.note || "" };
      });
    } else if (kind === "diaper") {
      records = sortNewest(data.diaperChanges, "time").map(function (item) {
        return { id: item.id, title: formatDateTime(item.time), detail: item.condition || "未标注", note: item.note || "" };
      });
    } else if (kind === "poop") {
      records = sortNewest(data.poops, "time").map(function (item) {
        return { id: item.id, title: formatDateTime(item.time), detail: item.status || "未标注", note: item.note || "" };
      });
    }
    this.setData({ managerRecords: records });
  },

  closeManager() { this.setData({ managerOpen: false }); },
  noop() {},

  openNotices() { this.setData({ noticeOpen: true }); },

  closeNotices() { this.setData({ noticeOpen: false }); },

  openReport() { wx.navigateTo({ url: "/pages/report/index" }); },

  openReminder(event) {
    const dataset = event && event.currentTarget && event.currentTarget.dataset || {};
    const type = dataset.type;
    const id = dataset.id;
    this.setData({ noticeOpen: false });
    if (type === "todo") {
      this.openTodoEditor({ currentTarget: { dataset: { id } } });
      return;
    }
    if (type === "vaccine" || type === "checkup") {
      wx.reLaunch({ url: "/pages/health/index?tab=" + type });
    }
  },

  openSync() {
    const syncInfo = store.getSyncStatus();
    const me = syncInfo.family && syncInfo.family.me;
    const relationIndex = me ? Math.max(0, FAMILY_RELATIONS.indexOf(me.relation)) : this.data.familyRelationIndex;
    this.setData({
      syncOpen: true,
      syncInfo,
      syncConflict: syncConflictView(syncInfo),
      capacityView: capacityView(syncInfo.capacity),
      familyMembers: familyMemberViews(syncInfo.family),
      familyProfileNickname: me && me.nickname || this.data.familyProfileNickname,
      familyRelationIndex: relationIndex,
    });
    this.refreshTrash();
    if (syncInfo.family) this.loadBackups();
  },

  closeSync() { this.setData({ syncOpen: false }); },

  refreshTrash() {
    const now = this.now ? this.now() : new Date();
    const entries = (store.getData().trashEntries || []).filter(function (entry) {
      return entry && entry.id && derive.asDate(entry.expiresAt).getTime() > now.getTime();
    }).sort(function (left, right) {
      return derive.asDate(right.deletedAt).getTime() - derive.asDate(left.deletedAt).getTime();
    }).map(function (entry) {
      const typeLabel = TRASH_TYPE_LABELS[entry.collection] || "记录";
      return {
        id: entry.id,
        typeLabel,
        title: trashTitle(entry, typeLabel),
        deletedLabel: backupDateLabel(entry.deletedAt),
        expiryLabel: remainingDays(entry.expiresAt, now) + "天后清理",
      };
    });
    this.setData({ trashEntries: entries });
  },

  async restoreTrashEntry(event) {
    const trashId = event.currentTarget.dataset.id;
    if (!trashId || this.data.trashActionId) return;
    try {
      this.setData({ trashActionId: trashId });
      await store.restoreFromTrash(trashId);
      this.refreshTrash();
      this.refresh();
      wx.showToast({ title: "已恢复到原位置", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "恢复失败，请重试"), icon: "none" });
    } finally {
      this.setData({ trashActionId: "" });
    }
  },

  handleInviteInput(event) { this.setData({ inviteCodeInput: String(event.detail.value || "").toUpperCase() }); },

  handleFamilyNicknameInput(event) {
    this.setData({ familyProfileNickname: String(event.detail.value || "") });
  },

  handleFamilyRelationChange(event) {
    const index = Math.max(0, Math.min(FAMILY_RELATIONS.length - 1, Number(event.detail.value) || 0));
    this.setData({ familyRelationIndex: index });
  },

  familyProfile() {
    const nickname = String(this.data.familyProfileNickname || "").trim();
    if (!nickname) {
      wx.showToast({ title: "请先填写你的昵称", icon: "none" });
      return null;
    }
    return { nickname, relation: FAMILY_RELATIONS[this.data.familyRelationIndex] || FAMILY_RELATIONS[0] };
  },

  async enablePersonalCloudSync() {
    if (this.data.familyActionId) return;
    try {
      this.setData({ familyActionId: "personal-cloud" });
      wx.showLoading({ title: "正在开启云同步" });
      await store.createFamily({ nickname: "我", relation: "" });
      const syncInfo = store.getSyncStatus();
      this.setData({
        syncInfo,
        syncConflict: syncConflictView(syncInfo),
        capacityView: capacityView(syncInfo.capacity),
        familyMembers: familyMemberViews(syncInfo.family),
      });
      await this.loadBackups();
      wx.showToast({ title: "个人云同步已开启", icon: "success" });
    } catch (error) {
      wx.showToast({ title: personalCloudErrorText(error, "开启云同步失败"), icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ familyActionId: "" });
    }
  },

  async createFamily() {
    const profile = this.familyProfile();
    if (!profile) return;
    try {
      wx.showLoading({ title: "正在创建家庭" });
      await store.createFamily(profile);
      const syncInfo = store.getSyncStatus();
      this.setData({ syncInfo, capacityView: capacityView(syncInfo.capacity), familyMembers: familyMemberViews(syncInfo.family) });
      await this.loadBackups();
      wx.showToast({ title: "家庭已创建", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "创建家庭失败"), icon: "none" });
    } finally { wx.hideLoading(); }
  },

  async joinFamily() {
    const code = String(this.data.inviteCodeInput || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return wx.showToast({ title: "请输入6位邀请码", icon: "none" });
    const profile = this.familyProfile();
    if (!profile) return;
    try {
      wx.showLoading({ title: "正在加入家庭" });
      await store.joinFamily(code, profile);
      const syncInfo = store.getSyncStatus();
      this.setData({ syncInfo, capacityView: capacityView(syncInfo.capacity), familyMembers: familyMemberViews(syncInfo.family), inviteCodeInput: "" });
      await this.loadBackups();
      wx.showToast({ title: "已加入家庭", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "加入家庭失败"), icon: "none" });
    } finally { wx.hideLoading(); }
  },

  copyInviteCode() {
    const family = this.data.syncInfo && this.data.syncInfo.family;
    if (!family || !family.inviteCode) return;
    wx.setClipboardData({ data: family.inviteCode });
  },

  openFamilyMemberEditor(event) {
    const memberId = event.currentTarget.dataset.id;
    const member = this.data.familyMembers.find(function (item) { return item.memberId === memberId; });
    if (!member || !member.canEdit) return;
    this.setData({
      memberEditorOpen: true,
      memberEditorId: member.memberId,
      memberEditorNickname: member.nickname || "",
      memberEditorRelationIndex: Math.max(0, FAMILY_RELATIONS.indexOf(member.relation)),
      memberEditorStatus: member.active ? "active" : "inactive",
      memberEditorCanChangeStatus: Boolean(member.canChangeStatus),
    });
  },

  closeFamilyMemberEditor() {
    this.setData({
      memberEditorOpen: false,
      memberEditorId: "",
      memberEditorNickname: "",
      memberEditorStatus: "active",
      memberEditorCanChangeStatus: false,
    });
  },

  handleMemberNicknameInput(event) {
    this.setData({ memberEditorNickname: String(event.detail.value || "") });
  },

  handleMemberRelationChange(event) {
    const index = Math.max(0, Math.min(FAMILY_RELATIONS.length - 1, Number(event.detail.value) || 0));
    this.setData({ memberEditorRelationIndex: index });
  },

  async saveFamilyMember() {
    const memberId = this.data.memberEditorId;
    const nickname = String(this.data.memberEditorNickname || "").trim();
    if (!memberId || this.data.familyActionId) return;
    if (!nickname) return wx.showToast({ title: "成员昵称不能为空", icon: "none" });
    try {
      this.setData({ familyActionId: "member:" + memberId });
      await store.updateFamilyMember(memberId, {
        nickname,
        relation: FAMILY_RELATIONS[this.data.memberEditorRelationIndex] || FAMILY_RELATIONS[0],
      });
      const syncInfo = store.getSyncStatus();
      this.setData({
        syncInfo,
        familyMembers: familyMemberViews(syncInfo.family),
        memberEditorOpen: false,
        memberEditorId: "",
        memberEditorNickname: "",
      });
      wx.showToast({ title: "成员资料已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "成员资料保存失败"), icon: "none" });
    } finally {
      this.setData({ familyActionId: "" });
    }
  },

  async toggleFamilyMemberStatus() {
    const memberId = this.data.memberEditorId;
    const syncInfo = store.getSyncStatus();
    const family = syncInfo && syncInfo.family;
    const member = family && Array.isArray(family.members)
      ? family.members.find(function (item) { return item.memberId === memberId; })
      : null;
    if (!family || !family.owner || family.role !== "owner" || !member || member.role === "owner") {
      wx.showToast({ title: "只有家庭所有者可以停用或重新启用成员", icon: "none" });
      return;
    }
    if (this.data.familyActionId) return;
    const nextStatus = member.status === "inactive" ? "active" : "inactive";
    const confirmed = await new Promise(function (resolve) {
      wx.showModal({
        title: nextStatus === "inactive" ? "停用这位成员？" : "重新启用这位成员？",
        content: nextStatus === "inactive"
          ? "停用后，该成员将不能读取或修改家庭数据；以后可以在这里重新启用。"
          : "重新启用后，该成员可以继续读取和修改家庭数据。",
        confirmText: nextStatus === "inactive" ? "确认停用" : "确认启用",
        confirmColor: nextStatus === "inactive" ? "#9d4438" : "#526b39",
        success: function (result) { resolve(Boolean(result.confirm)); },
        fail: function () { resolve(false); },
      });
    });
    if (!confirmed) return;
    try {
      this.setData({ familyActionId: "member-status:" + memberId });
      await store.updateFamilyMember(memberId, { status: nextStatus });
      const updatedSyncInfo = store.getSyncStatus();
      this.setData({
        syncInfo: updatedSyncInfo,
        syncConflict: syncConflictView(updatedSyncInfo),
        familyMembers: familyMemberViews(updatedSyncInfo.family),
        memberEditorStatus: nextStatus,
      });
      wx.showToast({ title: nextStatus === "inactive" ? "成员已停用" : "成员已重新启用", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "成员状态修改失败"), icon: "none" });
    } finally {
      this.setData({ familyActionId: "" });
    }
  },

  async updateBackupAdmin(memberId) {
    if (this.data.familyActionId) return;
    try {
      this.setData({ familyActionId: "backup-admin" });
      await store.setBackupAdmin(memberId || null);
      const syncInfo = store.getSyncStatus();
      this.setData({ syncInfo, familyMembers: familyMemberViews(syncInfo.family) });
      wx.showToast({ title: memberId ? "备用管理员已设置" : "已撤销备用管理员", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "管理员设置失败"), icon: "none" });
    } finally {
      this.setData({ familyActionId: "" });
    }
  },

  setFamilyBackupAdmin(event) {
    return this.updateBackupAdmin(event.currentTarget.dataset.id);
  },

  clearFamilyBackupAdmin() {
    return this.updateBackupAdmin(null);
  },

  async loadBackups() {
    if (this.data.backupLoading || !(this.data.syncInfo && this.data.syncInfo.family)) return;
    this.setData({ backupLoading: true, backupError: "" });
    try {
      const result = await store.listBackups(10);
      const backups = (result.backups || []).map(function (item) {
        return Object.assign({}, item, {
          dateLabel: backupDateLabel(item.createdAt),
          reasonLabel: backupReasonLabel(item.reason),
          sizeLabel: byteLabel(item.byteLength),
        });
      });
      const syncInfo = store.getSyncStatus();
      this.setData({
        backups,
        backupRetention: result.retentionLimit || 30,
        syncInfo,
        syncConflict: syncConflictView(syncInfo),
        capacityView: capacityView(syncInfo.capacity),
      });
    } catch (error) {
      this.setData({
        backups: [],
        backupActionId: "",
        backupError: personalCloudErrorText(error, "备份列表读取失败，请重试"),
      });
    } finally {
      this.setData({ backupLoading: false });
    }
  },

  async createManualBackup() {
    const family = this.data.syncInfo && this.data.syncInfo.family;
    if (!family || !family.owner || this.data.backupActionId || this.data.backupLoading) return;
    let loadingShown = false;
    try {
      this.setData({ backupActionId: "create", backupError: "" });
      wx.showLoading({ title: "正在备份" });
      loadingShown = true;
      await store.createBackup();
      await this.loadBackups();
      wx.showToast({ title: "个人记录备份已创建", icon: "success" });
    } catch (error) {
      wx.showToast({ title: personalCloudErrorText(error, "备份失败，请重试"), icon: "none", duration: 2800 });
    } finally {
      if (loadingShown) wx.hideLoading();
      this.setData({ backupActionId: "" });
    }
  },

  async exportFamilyData() {
    if (this.data.exportLoading) return;
    let loadingShown = false;
    try {
      this.setData({ exportLoading: true });
      wx.showLoading({ title: "正在生成备份" });
      loadingShown = true;
      const exported = await store.exportFamily();
      const fileName = "Little-Steps-个人数据存档.json";
      const filePath = wx.env.USER_DATA_PATH + "/" + fileName;
      await writeTextFile(filePath, JSON.stringify(exported, null, 2));
      wx.hideLoading();
      loadingShown = false;
      await shareFile(filePath, fileName);
      const syncInfo = store.getSyncStatus();
      this.setData({ syncInfo, capacityView: capacityView(syncInfo.capacity) });
      wx.showToast({ title: "离线存档已生成", icon: "success" });
    } catch (error) {
      const message = personalCloudErrorText(error, "导出失败，请重试");
      if (!String(message).toLowerCase().includes("cancel")) wx.showToast({ title: message, icon: "none", duration: 2800 });
    } finally {
      if (loadingShown) wx.hideLoading();
      this.setData({ exportLoading: false });
    }
  },

  async restoreFamilyBackup(event) {
    const backupId = event.currentTarget.dataset.id;
    const selected = (this.data.backups || []).find(function (item) { return item.backupId === backupId; });
    if (!selected || this.data.backupActionId) return;
    const confirmed = await new Promise(function (resolve) {
      wx.showModal({
        title: "恢复这份个人备份？",
        content: "将恢复到 " + selected.dateLabel + " 的内容。当前数据会先自动保留一份保护备份。",
        confirmText: "确认恢复",
        confirmColor: "#b8655b",
        success: function (result) { resolve(result.confirm); },
        fail: function () { resolve(false); },
      });
    });
    if (!confirmed) return;
    let loadingShown = false;
    try {
      this.setData({ backupActionId: backupId });
      wx.showLoading({ title: "正在恢复" });
      loadingShown = true;
      await store.restoreBackup(backupId);
      this.refresh();
      await this.loadBackups();
      wx.showToast({ title: "个人数据已恢复", icon: "success" });
    } catch (error) {
      if (error && error.code === "RESTORE_REFRESH_REQUIRED") {
        if (loadingShown) {
          wx.hideLoading();
          loadingShown = false;
        }
        wx.showModal({
          title: error.restoreCommitted ? "云端已恢复" : "需要重新载入",
          content: error.restoreCommitted
            ? "云端备份已经恢复，但本机数据暂时未刷新。请关闭并重新进入小程序；刷新完成前不会上传旧数据。"
            : "恢复结果尚未确认。请关闭并重新进入小程序；重新载入完成前不会上传本机旧数据。",
          showCancel: false,
          confirmText: "知道了",
        });
      } else {
        wx.showToast({ title: personalCloudErrorText(error, "恢复失败，当前内容未变更"), icon: "none", duration: 2800 });
      }
    } finally {
      if (loadingShown) wx.hideLoading();
      this.setData({ backupActionId: "" });
    }
  },

  async syncNow() {
    try {
      wx.showLoading({ title: "正在同步" });
      const result = await store.syncNow();
      const syncInfo = store.getSyncStatus();
      const syncConflict = syncConflictView(syncInfo);
      this.setData({ syncInfo, syncConflict, capacityView: capacityView(syncInfo.capacity) });
      if (!result || !result.ok || !result.synced) {
        wx.showToast({ title: "云端暂不可用，内容仍安全保存在本机", icon: "none", duration: 2600 });
        return;
      }
      await this.loadBackups();
      if (syncConflict.count) {
        wx.showToast({ title: "发现 " + syncConflict.count + " 项冲突，请核对", icon: "none", duration: 3000 });
        return;
      }
      wx.showToast({ title: "已同步到个人云端", icon: "success" });
    } catch (error) {
      wx.showToast({ title: personalCloudErrorText(error, "同步失败"), icon: "none" });
    } finally { wx.hideLoading(); }
  },

  addFromManager() {
    this.openEditor(this.data.managerKind, null, true);
  },

  editManagerRecord(event) {
    const kind = this.data.managerKind;
    const collection = COLLECTION_BY_KIND[kind];
    const item = (store.getData()[collection] || []).find(function (record) { return record.id === event.currentTarget.dataset.id; });
    if (item) this.openEditor(kind, item, true);
  },

  async deleteManagerRecord(event) {
    const kind = this.data.managerKind;
    const id = event.currentTarget.dataset.id;
    const confirmed = await new Promise(function (resolve) {
      wx.showModal({ title: "删除这条记录？", content: "删除后 5 秒内可撤销，也可在回收站保留 30 天。", confirmText: "删除", confirmColor: "#c96050", success: function (result) { resolve(result.confirm); } });
    });
    if (!confirmed) return;
    try {
      const removed = await store.remove(COLLECTION_BY_KIND[kind], id);
      this.refreshManager();
      this.showUndo(removed, "记录已删除");
    } catch (error) {
      wx.showToast({ title: errorText(error, "删除失败，请重试"), icon: "none" });
    }
  },

  openGrowthEditor() {
    const data = store.getData();
    const today = dateKey(new Date());
    const existing = (data.growthRecords || []).find(function (item) { return item.date === today; });
    this.openEditor("growth", existing || null, false);
  },

  openTodoEditor(event) {
    const id = event && event.currentTarget.dataset.id;
    const item = id ? (store.getData().todos || []).find(function (record) { return record.id === id; }) : null;
    this.openEditor("todo", item || null, false);
  },

  openEditor(kind, item, fromManager) {
    const now = this.now ? this.now() : new Date();
    const parts = nowParts(now);
    let draft = {};
    let title = "新增记录";
    if (kind === "feeding") {
      const time = splitDateTime(item && item.time);
      draft = { date: time.date, time: time.time, amount: item ? String(item.amount) : "", milkType: item && item.milkType || "母乳", note: item && item.note || "" };
      title = item ? "编辑喂养" : "新增喂养";
    } else if (kind === "sleep") {
      const startDefault = new Date(now.getTime() - 60 * 60000);
      const start = splitDateTime(item && item.start || startDefault);
      const end = splitDateTime(item && item.end || now);
      draft = { startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time, note: item && item.note || "" };
      title = item ? "编辑睡眠" : "新增睡眠";
    } else if (kind === "diaper") {
      const time = splitDateTime(item && item.time);
      draft = { date: time.date, time: time.time, condition: item && item.condition || "未标注", note: item && item.note || "" };
      title = item ? "编辑换尿布" : "新增换尿布";
    } else if (kind === "poop") {
      const time = splitDateTime(item && item.time);
      draft = { date: time.date, time: time.time, status: item && item.status || "未标注", note: item && item.note || "" };
      title = item ? "编辑便便" : "新增便便";
    } else if (kind === "growth") {
      const records = derive.sortGrowthRecords(store.getData().growthRecords);
      const latest = records[records.length - 1] || {};
      draft = { date: item && item.date || parts.date, weight: item && item.weight !== undefined ? String(item.weight) : String(latest.weight || ""), height: item && item.height !== undefined ? String(item.height) : String(latest.height || ""), note: item && item.note || "" };
      title = item ? "修改成长数据" : "填写当前数据";
    } else if (kind === "todo") {
      draft = { title: item && item.title || "" };
      title = item ? "编辑待办" : "新增待办";
    }
    this.setData({
      managerOpen: false,
      editorOpen: true,
      editorKind: kind,
      editorTitle: title,
      editorId: item && item.id || "",
      editorFromManager: Boolean(fromManager),
      draft,
    });
  },

  closeEditor() {
    if (this.data.editorSaving) return;
    const returnToManager = this.data.editorFromManager;
    const kind = this.data.editorKind;
    this.setData({ editorOpen: false });
    if (returnToManager) this.openManagerKind(kind);
  },

  handleDraftInput(event) {
    this.setData({ ["draft." + event.currentTarget.dataset.field]: event.detail.value });
  },

  handleDraftPicker(event) {
    this.setData({ ["draft." + event.currentTarget.dataset.field]: event.detail.value });
  },

  handleOptionPicker(event) {
    const field = event.currentTarget.dataset.field;
    const source = event.currentTarget.dataset.source;
    const options = this.data[source] || [];
    this.setData({ ["draft." + field]: options[Number(event.detail.value)] || "" });
  },

  async saveEditor() {
    if (this.data.editorSaving) return;
    const kind = this.data.editorKind;
    const draft = this.data.draft;
    const id = this.data.editorId || makeId(kind);
    const now = this.now ? this.now() : new Date();
    let record;
    try {
      this.setData({ editorSaving: true });
      if (kind === "feeding") {
        const amount = Number(draft.amount);
        if (!isFinite(amount) || amount <= 0) throw new Error("请输入正确的奶量");
        const time = combineDateTime(draft.date, draft.time);
        const timeResult = validation.validateDateTimeInLife(time, now, "喂奶时间");
        if (!timeResult.ok) throw new Error(timeResult.message);
        record = { id, time, amount, milkType: draft.milkType || "母乳", note: String(draft.note || "").trim() };
      } else if (kind === "sleep") {
        const start = combineDateTime(draft.startDate, draft.startTime);
        const end = combineDateTime(draft.endDate, draft.endTime);
        const startResult = validation.validateDateTimeInLife(start, now, "睡眠开始时间");
        const endResult = validation.validateDateTimeInLife(end, now, "睡眠结束时间");
        if (!startResult.ok) throw new Error(startResult.message);
        if (!endResult.ok) throw new Error(endResult.message);
        if (derive.asDate(end) <= derive.asDate(start)) throw new Error("睡眠结束时间必须晚于开始时间");
        record = { id, start, end, note: String(draft.note || "").trim() };
      } else if (kind === "diaper") {
        const time = combineDateTime(draft.date, draft.time);
        const timeResult = validation.validateDateTimeInLife(time, now, "换尿布时间");
        if (!timeResult.ok) throw new Error(timeResult.message);
        record = { id, time, condition: draft.condition || "未标注", note: String(draft.note || "").trim() };
      } else if (kind === "poop") {
        const time = combineDateTime(draft.date, draft.time);
        const timeResult = validation.validateDateTimeInLife(time, now, "便便时间");
        if (!timeResult.ok) throw new Error(timeResult.message);
        record = { id, time, status: draft.status || "未标注", note: String(draft.note || "").trim() };
      } else if (kind === "growth") {
        const growthResult = validation.validateGrowthRecord(Object.assign({}, draft, { id }), store.getData().growthRecords, now);
        if (!growthResult.ok) throw new Error(growthResult.message);
        record = growthResult.value;
      } else if (kind === "todo") {
        const title = String(draft.title || "").trim();
        if (!title) throw new Error("请输入待办内容");
        const previous = (store.getData().todos || []).find(function (item) { return item.id === id; });
        record = { id, title, completed: previous ? Boolean(previous.completed) : false };
      }
      await store.upsert(COLLECTION_BY_KIND[kind], record);
      const returnToManager = this.data.editorFromManager;
      this.setData({ editorOpen: false });
      if (returnToManager) this.openManagerKind(kind);
      wx.showToast({ title: "已保存", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "保存失败"), icon: "none" });
    } finally {
      this.setData({ editorSaving: false });
    }
  },

  async quickDiaper() {
    if (this.diaperSaving) return;
    this.diaperSaving = true;
    try {
      const now = this.now ? this.now() : new Date();
      await store.upsert("diaperChanges", { id: makeId("diaper"), time: dateTime(now), condition: "未标注", note: "首页快捷记录" });
      wx.showToast({ title: "已记录换尿布", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "记录失败，请重试"), icon: "none" });
    } finally {
      this.diaperSaving = false;
    }
  },

  async quickPoop() {
    if (this.poopSaving) return;
    this.poopSaving = true;
    try {
      const now = this.now ? this.now() : new Date();
      await store.upsert("poops", { id: makeId("poop"), time: dateTime(now), status: "未标注", note: "首页快捷记录" });
      wx.showToast({ title: "已记录便便", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "记录失败，请重试"), icon: "none" });
    } finally {
      this.poopSaving = false;
    }
  },

  async toggleVitamin() {
    if (this.vitaminSaving) return;
    this.vitaminSaving = true;
    const data = store.getData();
    const today = dateKey(new Date());
    const existing = (data.supplements || []).find(function (item) {
      return derive.dayKey(item.date) === today && derive.isVitaminD(item);
    });
    try {
      await store.upsert("supplements", {
        id: existing && existing.id || makeId("supplement"),
        name: "维生素 D",
        date: today,
        completed: existing ? !existing.completed : true,
      });
      wx.showToast({ title: existing && existing.completed ? "已取消确认" : "今日已确认", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "确认失败，请重试"), icon: "none" });
    } finally {
      this.vitaminSaving = false;
    }
  },

  async toggleTodo(event) {
    const id = event.currentTarget.dataset.id;
    const item = (store.getData().todos || []).find(function (record) { return record.id === id; });
    if (!item) return;
    this.todoSaving = this.todoSaving || new Set();
    if (this.todoSaving.has(id)) return;
    this.todoSaving.add(id);
    try {
      await store.upsert("todos", Object.assign({}, item, { completed: !item.completed }));
    } catch (error) {
      wx.showToast({ title: errorText(error, "更新失败，请重试"), icon: "none" });
    } finally {
      this.todoSaving.delete(id);
    }
  },

  async deleteTodo(event) {
    const id = event.currentTarget.dataset.id;
    const confirmed = await new Promise(function (resolve) {
      wx.showModal({ title: "删除待办？", content: "删除后 5 秒内可撤销，也可在回收站保留 30 天。", confirmText: "删除", confirmColor: "#c96050", success: function (result) { resolve(result.confirm); } });
    });
    if (!confirmed) return;
    try {
      const removed = await store.remove("todos", id);
      this.showUndo(removed, "待办已删除");
    } catch (error) {
      wx.showToast({ title: errorText(error, "删除失败，请重试"), icon: "none" });
    }
  },

  showUndo(result, message) {
    const trashId = result && result.trashId || "";
    if (!trashId) {
      wx.showToast({ title: message || "已删除", icon: "success" });
      return;
    }
    this.setData({
      undoVisible: true,
      undoTrashId: trashId,
      undoMessage: message || "已删除",
      undoToken: trashId + ":" + Date.now(),
    });
  },

  onUndoExpired() {
    this.setData({ undoVisible: false, undoTrashId: "", undoMessage: "" });
  },

  async undoLastDelete() {
    const trashId = this.data.undoTrashId;
    if (!trashId) return;
    try {
      await store.restoreFromTrash(trashId);
      this.setData({ undoVisible: false, undoTrashId: "", undoMessage: "" });
      if (this.data.managerOpen) this.refreshManager();
      wx.showToast({ title: "已恢复", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "恢复失败，请到回收站重试"), icon: "none" });
    }
  },

  onShareAppMessage() {
    return { title: "硕之的婴儿成长工作台", path: "/pages/home/index" };
  },
});
