"use strict";

// 记一笔弹层（规范 5.6、5.7、5.11；参考屏 screen-5、8、15）。
// S1 只开「观察」一类：关于哪一条（本月龄观察点，可不选）、看到了 / 在等，还没看到、一句话、改时间。
// 「取消」丢掉；「先放着」和没存上都把草稿留在本机，下次打开回填。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");

const TYPES = [
  { id: "observe", label: "观察", icon: "icon-observe" },
  { id: "measure", label: "测量", icon: "icon-measure" },
  { id: "photo", label: "照片", icon: "icon-photo" },
  { id: "care", label: "照护", icon: "icon-care" },
  { id: "doctor", label: "问医生", icon: "icon-doctor" },
];

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
  },

  data: {
    types: TYPES,
    type: "observe",
    seen: "seen",
    text: "",
    itemId: "",
    itemText: "",
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
  },

  observers: {
    open(value) {
      if (value) this.reset();
      else this.setData({ keyboardHeight: 0 });
    },
  },

  methods: {
    reset() {
      const draft = repo.loadDraft();
      const itemId = (draft && draft.itemId) || "";
      const at = (draft && draft.at) || nowAt();
      this.setData(Object.assign({
        type: "observe",
        seen: draft && draft.seen === "waiting" && itemId ? "waiting" : "seen",
        text: (draft && draft.text) || "",
        itemId: itemId,
        itemText: this.pointText(itemId),
        pickingItem: false,
        editingTime: false,
        keyboardHeight: 0,
        error: "",
        today: age.todayKey(),
      }, this.timeFields(at)));
    },

    pointText(id) {
      const hit = (this.data.points || []).filter(function (p) { return p.id === id; })[0];
      return hit ? hit.text : "";
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
      this.setData({
        itemId: next,
        itemText: this.pointText(next),
        pickingItem: false,
        error: "",
        seen: next ? this.data.seen : "seen",
      });
    },

    chooseSeen(event) {
      const seen = event.currentTarget.dataset.seen;
      if (seen === "waiting" && !(this.data.points || []).length) return;
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
      repo.clearDraft();
      this.triggerEvent("close");
    },

    hold() {
      repo.saveDraft(this.draftOf());
      this.triggerEvent("close");
    },

    save() {
      let record;
      try {
        record = repo.addRecord(this.draftOf());
      } catch (error) {
        const message = (error && error.message) || "没存上。";
        repo.saveDraft(this.draftOf());
        this.setData({ error: /^没存上/.test(message) ? message + " 你写的都还在。" : message });
        return;
      }
      repo.clearDraft();
      this.triggerEvent("saved", { record: record });
    },
  },
});
