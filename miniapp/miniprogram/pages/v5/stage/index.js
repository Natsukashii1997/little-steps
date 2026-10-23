"use strict";

// 这个月（底栏 2）：月龄窗口；只读显示当月「可以陪宝宝玩的」「要留意的」；
// 「试过了 →」打开记一笔·观察并选好条目；「看看 →」进注意事项正文页；页脚来源一句。
// 「要安排的」整块在 S2。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");
const content = require("../../../lib/v5/content");
const stageView = require("../../../lib/v5/stage-view");

Page({
  data: {
    ready: false,
    windowLabel: "",
    hasContent: false,
    playRows: [],
    noticeRows: [],
    sourceLine: "",
    draftLine: "",
    points: [],
    sheetOpen: false,
    sheetRecord: null,
    sheetPreset: null,
  },

  onShow() {
    this.refresh();
  },

  // 每次进页面、记完一笔都从本机存储重读，不信任模块缓存（存储可能被清）
  refresh() {
    const data = repo.load();
    if (!data.baby) {
      wx.redirectTo({ url: "/pages/v5/setup/index" });
      return;
    }
    const today = age.todayKey();
    const window = age.monthWindow(data.baby.birthDate, today);
    this.monthIndex = window.index;
    const month = content.monthContent(window.index);
    this.setData({
      ready: true,
      windowLabel: window.label + "，" + age.formatRange(window.start, window.end),
      hasContent: !!month,
      playRows: stageView.playRows(content.playItems(window.index), data.records, today),
      noticeRows: content.noticeItems(window.index).map(function (n) { return { id: n.id, text: n.text }; }),
      sourceLine: content.sourceLine(),
      draftLine: content.isDraft(window.index) ? content.draftLine() : "",
      points: content.pickableItems(window.index),
    });
  },

  // 还没试过：打开记一笔并选好这一条；试过了：点开那条记录改一改
  tapPlay(event) {
    const { id, recordId } = event.currentTarget.dataset;
    if (recordId) this.openRecord(recordId);
    else this.openPreset(id);
  },

  tryItem(event) {
    this.openPreset(event.currentTarget.dataset.id);
  },

  openPreset(id) {
    this.setData({ sheetPreset: { itemId: id, seen: "seen" }, sheetRecord: null, sheetOpen: true });
  },

  openRecord(id) {
    const record = repo.getData().records.filter(function (r) { return r.id === id && !r.deletedAt; })[0];
    if (!record) return;
    this.setData({ sheetRecord: record, sheetPreset: null, sheetOpen: true });
  },

  openNotice(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/v5/notice/index?month=" + this.monthIndex + "&id=" + id });
  },

  closeSheet() {
    this.setData({ sheetOpen: false, sheetRecord: null, sheetPreset: null });
  },

  onSaved() {
    this.closeSheet();
    this.refresh();
  },
});
