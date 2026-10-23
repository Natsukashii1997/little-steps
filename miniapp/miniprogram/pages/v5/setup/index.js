"use strict";

// 首次启动：只问宝宝名字和出生日期（审查 B8）；之后点今天页的名字回到这里改。
const repo = require("../../../lib/v5/repo");
const age = require("../../../lib/v5/age");

Page({
  data: {
    editing: false,
    name: "",
    birthDate: "",
    birthLabel: "",
    today: "",
    error: "",
  },

  onLoad(query) {
    const data = repo.load();
    const editing = Boolean(data.baby);
    this.setData({
      editing: editing,
      today: age.todayKey(),
      name: editing ? data.baby.name : "",
      birthDate: editing ? data.baby.birthDate : "",
      birthLabel: editing ? age.formatFullDate(data.baby.birthDate) : "",
    });
  },

  onName(event) {
    this.setData({ name: event.detail.value, error: "" });
  },

  onDate(event) {
    const value = event.detail.value;
    this.setData({ birthDate: value, birthLabel: age.formatFullDate(value), error: "" });
  },

  save() {
    try {
      repo.setBaby({ name: this.data.name, birthDate: this.data.birthDate });
    } catch (error) {
      this.setData({ error: (error && error.message) || "没存上。你写的都还在。" });
      return;
    }
    wx.reLaunch({ url: "/pages/v5/today/index" });
  },
});
