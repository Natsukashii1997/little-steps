"use strict";

// 成长（底栏 3）：第 1 批只有页头；第 3 批接「家里看到的」。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");

Page({
  data: { ready: false, asOf: "" },

  onShow() {
    // 每次进页面都从本机存储重读，不信任模块缓存（存储可能被清）
    const data = repo.load();
    if (!data.baby) {
      wx.redirectTo({ url: "/pages/v5/setup/index" });
      return;
    }
    this.setData({ ready: true, asOf: "截至 " + age.formatMonthDay(age.todayKey()) });
  },
});
