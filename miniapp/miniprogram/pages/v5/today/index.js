"use strict";

// 今天（底栏 1）：日期、名字、月龄、这个月那句话、这个月记的、记一笔。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");
const content = require("../../../lib/v5/content");
const { buildTodayView } = require("../../../lib/v5/today-view");

Page({
  data: {
    ready: false,
    sheetOpen: false,
    sheetRecord: null,
    points: [],
  },

  onShow() {
    this.refresh();
  },

  // 每次进页面、记完一笔都从本机存储重读，不信任模块缓存（存储可能被清）
  refresh() {
    let data;
    try {
      data = repo.load();
    } catch (error) {
      wx.showModal({
        title: "记录没有读出来",
        content: error.message,
        confirmText: "重试读取",
        showCancel: false,
        success: (result) => { if (result.confirm) this.refresh(); },
      });
      return;
    }
    if (!data.baby) {
      wx.redirectTo({ url: "/pages/v5/setup/index" });
      return;
    }
    const today = age.todayKey();
    const window = age.monthWindow(data.baby.birthDate, today);
    const points = content.pickableItems(window.index);
    this.setData(Object.assign({ ready: true, points: points }, buildTodayView(data, today, points)));
  },

  editBaby() {
    wx.navigateTo({ url: "/pages/v5/setup/index" });
  },

  openQuick() {
    this.setData({ sheetRecord: null, sheetOpen: true });
  },

  closeSheet() {
    this.setData({ sheetOpen: false, sheetRecord: null });
  },

  onSaved() {
    this.setData({ sheetOpen: false });
    this.refresh();
  },

  openRecords() {
    wx.navigateTo({ url: "/pages/v5/records/index" });
  },

  // 点开即编辑：同一弹层回填（审查 B2）
  openRecord(event) {
    const id = event.currentTarget.dataset.id;
    const record = repo.getData().records.filter(function (r) { return r.id === id && !r.deletedAt; })[0];
    if (!record) return;
    this.setData({ sheetRecord: record, sheetOpen: true });
  },
});
