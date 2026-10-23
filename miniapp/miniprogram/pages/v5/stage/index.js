"use strict";

// 这个月（底栏 2）：第 1 批只有页头；第 3 批接内容表（可以陪宝宝玩的、要留意的）。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");

Page({
  data: { ready: false, windowLabel: "" },

  onShow() {
    // 每次进页面都从本机存储重读，不信任模块缓存（存储可能被清）
    const data = repo.load();
    if (!data.baby) {
      wx.redirectTo({ url: "/pages/v5/setup/index" });
      return;
    }
    const window = age.monthWindow(data.baby.birthDate, age.todayKey());
    this.setData({
      ready: true,
      windowLabel: window.label + "，" + age.formatRange(window.start, window.end),
    });
  },
});
