"use strict";

// 记一笔弹层（规范 5.6、5.7、5.11；参考屏 screen-5、8、15）。
// S1 只开「观察」一类：关于哪一条（本月龄观察点和可以陪宝宝玩的，可不选）、看到了 / 在等，还没看到、一句话、改时间。
// 「取消」丢掉；「先放着」和没存上都把草稿留在本机，下次打开回填。
// 点开已有记录即编辑（审查 B2）：同一弹层回填，左下「删掉」点两次才删，数据层软删除。
// preset：从这个月页、成长页的行打开时预先挑好的条目 { itemId, seen }。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");

const TYPES = [
  { id: "observe", label: "观察", icon: "icon-observe" },
  { id: "measure", label: "测量", icon: "icon-measure" },
  { id: "photo", label: "照片", icon: "icon-photo" },
  { id: "care", label: "照护", icon: "icon-care" },
  { id: "doctor", label: "问医生", icon: "icon-doctor" },
];
const GROUP_LABELS = { observe: "这个月可能看到的", play: "可以陪宝宝玩的" };

function pad(value) {
  return String(value).padStart(2, "0");
}

function nowAt() {
  const now = new Date();
  return age.dateKey(now) + "T" + pad(now.getHours()) + ":" + pad(now.getMinutes());
}

Component({
  properties: {
    open: { type: Boolean, value: false },
    points: { type: Array, value: [] },
    record: { type: Object, value: null },
    preset: { type: Object, value: null },
  },

  data: {
    types: TYPES,
    type: "observe",
    seen: "seen",
    text: "",
    itemId: "",
    itemText: "",
    itemKind: "",
    canWait: false,
    groups: [],
    pickingItem: false,
    at: "",
    atLabel: "",
    dateValue: "",
    dateLabel: "",
    timeValue: "",
    editingTime: false,
    keyboardHeight: 0,
    error: "",
    today: "",
    editing: false,
    recordId: "",
    confirmDelete: false,
  },

  observers: {
    open(value) {
      if (value) this.reset();
      else this.setData({ keyboardHeight: 0, confirmDelete: false });
    },
  },

  methods: {
    reset() {
      const record = this.data.record;
      const preset = this.data.preset;
      const draft = record ? null : repo.loadDraft();
      const source = record || preset || draft || {};
      const itemId = source.itemId || "";
      const kind = this.pointKind(itemId);
      const at = (record && record.at) || (draft && draft.at) || nowAt();
      const seen = source.seen === "waiting" && itemId && kind !== "play" ? "waiting" : "seen";
      this.setData(Object.assign({
        type: "observe",
        seen: seen,
        text: (record && record.text) || (draft && !preset && draft.text) || "",
        itemId: itemId,
        itemText: this.pointText(itemId),
        itemKind: kind,
        canWait: this.canWaitFor(kind),
        groups: this.groupsOf(),
        pickingItem: false,
        editingTime: false,
        keyboardHeight: 0,
        error: "",
        today: age.todayKey(),
        editing: !!record,
        recordId: (record && record.id) || "",
        confirmDelete: false,
      }, this.timeFields(at)));
    },

    pointOf(id) {
      return (this.data.points || []).filter(function (p) { return p.id === id; })[0] || null;
    },

    pointText(id) {
      const hit = this.pointOf(id);
      return hit ? hit.text : "";
    },

    pointKind(id) {
      const hit = this.pointOf(id);
      return hit ? hit.kind || "observe" : "";
    },

    // 「在等，还没看到」只对观察点有意义：挑了可以陪宝宝玩的条目时不出现
    canWaitFor(kind) {
      const hasObserve = (this.data.points || []).some(function (p) { return (p.kind || "observe") === "observe"; });
      return hasObserve && kind !== "play";
    },

    groupsOf() {
      const groups = [];
      (this.data.points || []).forEach(function (p) {
        const kind = p.kind || "observe";
        let group = groups.filter(function (g) { return g.kind === kind; })[0];
        if (!group) {
          group = { kind: kind, label: GROUP_LABELS[kind] || "", items: [] };
          groups.push(group);
        }
        group.items.push(p);
      });
      return groups;
    },

    timeFields(at) {
      const date = at.slice(0, 10);
      const time = at.slice(11, 16);
      const dateLabel = age.formatMonthDay(date);
      return {
        at: at,
        dateValue: date,
        timeValue: time,
        dateLabel: dateLabel,
        atLabel: (date === age.todayKey() ? "今天 " : "") + dateLabel + " " + time,
      };
    },

    draftOf() {
      return { type: this.data.type, seen: this.data.seen, text: this.data.text, itemId: this.data.itemId, at: this.data.at };
    },

    chooseType() {
      // S1 只有观察，其余四类在后面的切片
    },

    togglePick() {
      this.setData({ pickingItem: !this.data.pickingItem });
    },

    choosePoint(event) {
      const id = event.currentTarget.dataset.id;
      const next = id === this.data.itemId ? "" : id;
      const kind = this.pointKind(next);
      const canWait = this.canWaitFor(kind);
      this.setData({
        itemId: next,
        itemText: this.pointText(next),
        itemKind: kind,
        canWait: canWait,
        pickingItem: false,
        error: "",
        seen: next && canWait ? this.data.seen : "seen",
      });
    },

    chooseSeen(event) {
      const seen = event.currentTarget.dataset.seen;
      if (seen === "waiting" && !this.data.canWait) return;
      const patch = { seen: seen, error: "" };
      if (seen === "waiting" && !this.data.itemId) patch.pickingItem = true;
      this.setData(patch);
    },

    onInput(event) {
      this.setData({ text: event.detail.value, error: "" });
    },

    onKeyboard(event) {
      this.setData({ keyboardHeight: (event.detail && event.detail.height) || 0 });
    },

    onBlur() {
      this.setData({ keyboardHeight: 0 });
    },

    toggleTime() {
      this.setData({ editingTime: !this.data.editingTime });
    },

    onDate(event) {
      this.setData(this.timeFields(event.detail.value + "T" + this.data.timeValue));
    },

    onTime(event) {
      this.setData(this.timeFields(this.data.dateValue + "T" + event.detail.value));
    },

    cancel() {
      if (!this.data.editing) repo.clearDraft();
      this.triggerEvent("close");
    },

    hold() {
      if (!this.data.editing) repo.saveDraft(this.draftOf());
      this.triggerEvent("close");
    },

    save() {
      let record;
      try {
        record = this.data.editing
          ? repo.updateRecord(this.data.recordId, this.draftOf())
          : repo.addRecord(this.draftOf());
      } catch (error) {
        const message = (error && error.message) || "没存上。";
        if (!this.data.editing) repo.saveDraft(this.draftOf());
        this.setData({ error: /^没存上/.test(message) ? message + " 你写的都还在。" : message });
        return;
      }
      if (!this.data.editing) repo.clearDraft();
      this.triggerEvent("saved", { record: record });
    },

    // 「删掉」→ 同一位置变成「确定删掉」，再点一次才删（审查 B2）
    remove() {
      if (!this.data.editing) return;
      if (!this.data.confirmDelete) {
        this.setData({ confirmDelete: true, error: "" });
        return;
      }
      try {
        repo.deleteRecord(this.data.recordId);
      } catch (error) {
        this.setData({ confirmDelete: false, error: (error && error.message) || "没删掉。" });
        return;
      }
      this.triggerEvent("saved", { deleted: this.data.recordId });
    },
  },
});
