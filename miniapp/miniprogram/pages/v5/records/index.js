"use strict";

// 这个月记的（二级页）：本月龄窗口内全部记录，按时间倒序；点开即编辑（第 3 批）。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");
const content = require("../../../lib/v5/content");
const recordsView = require("../../../lib/v5/records-view");

Page({
  data: { ready: false, rows: [], windowLabel: "", points: [], sheetOpen: false, sheetRecord: null },

  onShow() {
    this.refresh();
  },

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
    this.setData({
      ready: true,
      points: points,
      rows: recordsView.monthRows(data.records, window, points, today),
      windowLabel: window.label + "，" + age.formatRange(window.start, window.end),
    });
  },

  // 点开即编辑：同一弹层回填（审查 B2）
  openRecord(event) {
    const id = event.currentTarget.dataset.id;
    const record = repo.getData().records.filter(function (r) { return r.id === id && !r.deletedAt; })[0];
    if (!record) return;
    this.setData({ sheetRecord: record, sheetOpen: true });
  },

  closeSheet() {
    this.setData({ sheetOpen: false, sheetRecord: null });
  },

  onSaved() {
    this.closeSheet();
    this.refresh();
  },
});
