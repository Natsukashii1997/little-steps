"use strict";

// 成长（底栏 3）：S1 只渲染「家里看到的」——本月龄观察点（没记过＝短横；在等＝虚线圈；看到了＝勾＋日期）＋自由观察；
// 行可点，打开记一笔·观察并选好条目（有记录就点开编辑）。测量三个数、医生说、家里在留意在 S2；
// 还没量过时数字的位置写「还没量过」（规范 5.10）。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");
const content = require("../../../lib/v5/content");
const stageView = require("../../../lib/v5/stage-view");

const MEASURES = [{ label: "身高" }, { label: "体重" }, { label: "头围" }];

Page({
  data: {
    ready: false,
    asOf: "",
    measures: MEASURES,
    hasContent: false,
    seenRows: [],
    freeRows: [],
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
    const points = content.observePoints(window.index);
    this.setData({
      ready: true,
      asOf: "截至 " + age.formatMonthDay(today),
      hasContent: !!content.monthContent(window.index),
      seenRows: stageView.homeSeenRows(points, data.records, today),
      freeRows: stageView.freeRows(data.records, window, today),
      draftLine: content.isDraft(window.index) ? content.draftLine() : "",
      points: content.pickableItems(window.index),
    });
  },

  // 有记录的行点开编辑；没记过的行打开记一笔并选好这一条
  tapSeen(event) {
    const { id, recordId } = event.currentTarget.dataset;
    if (recordId) this.openRecord(recordId);
    else this.setData({ sheetPreset: { itemId: id, seen: "seen" }, sheetRecord: null, sheetOpen: true });
  },

  tapFree(event) {
    this.openRecord(event.currentTarget.dataset.recordId);
  },

  openRecord(id) {
    const record = repo.getData().records.filter(function (r) { return r.id === id && !r.deletedAt; })[0];
    if (!record) return;
    this.setData({ sheetRecord: record, sheetPreset: null, sheetOpen: true });
  },

  closeSheet() {
    this.setData({ sheetOpen: false, sheetRecord: null, sheetPreset: null });
  },

  onSaved() {
    this.closeSheet();
    this.refresh();
  },
});
