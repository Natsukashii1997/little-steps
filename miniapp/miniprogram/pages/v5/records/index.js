"use strict";

// 这个月记的（二级页）：本月龄窗口内全部记录，按时间倒序；点开即编辑（第 3 批）。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");
const content = require("../../../lib/v5/content");
const recordsView = require("../../../lib/v5/records-view");

Page({
  data: { ready: false, rows: [], windowLabel: "" },

  onShow() {
    const data = repo.load();
    if (!data.baby) {
      wx.redirectTo({ url: "/pages/v5/setup/index" });
      return;
    }
    const today = age.todayKey();
    const window = age.monthWindow(data.baby.birthDate, today);
    const points = content.observePoints(window.index);
    this.setData({
      ready: true,
      rows: recordsView.monthRows(data.records, window, points, today),
      windowLabel: window.label + "，" + age.formatRange(window.start, window.end),
    });
  },

  openRecord() {
    // 第 3 批：点开即编辑
  },
});
