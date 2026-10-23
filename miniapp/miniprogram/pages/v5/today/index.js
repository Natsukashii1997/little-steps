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
    points: [],
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
    const points = content.observePoints(window.index);
    this.setData(Object.assign({ ready: true, points: points }, buildTodayView(data, today, points)));
  },

  editBaby() {
    wx.navigateTo({ url: "/pages/v5/setup/index" });
  },

  openQuick() {
    this.setData({ sheetOpen: true });
  },

  closeSheet() {
    this.setData({ sheetOpen: false });
  },

  onSaved() {
    this.setData({ sheetOpen: false });
    this.refresh();
  },

  openRecords() {
    wx.navigateTo({ url: "/pages/v5/records/index" });
  },

  openRecord() {
    // 第 3 批：点开即编辑
  },
});
