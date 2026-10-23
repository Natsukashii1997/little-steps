"use strict";

// 今天（底栏 1）：日期、名字、月龄、这个月那句话、记一笔。
// 「这个月记的」区块在第 2 批接上记录后出现；记一笔弹层也在第 2 批。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");
const { buildTodayView } = require("../../../lib/v5/today-view");

Page({
  data: {
    ready: false,
  },

  onShow() {
    // 每次进页面都从本机存储重读，不信任模块缓存（存储可能被清）
    const data = repo.load();
    if (!data.baby) {
      wx.redirectTo({ url: "/pages/v5/setup/index" });
      return;
    }
    this.setData(Object.assign({ ready: true }, buildTodayView(data, age.todayKey())));
  },

  editBaby() {
    wx.navigateTo({ url: "/pages/v5/setup/index" });
  },

  openQuick() {
    // 第 2 批：打开记一笔弹层
  },
});
