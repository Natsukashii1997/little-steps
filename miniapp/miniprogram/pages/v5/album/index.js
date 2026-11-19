"use strict";

// 相册（底栏 4）：S1 只有空状态，相册在下一个切片（S3）做。
const repo = require("../../../lib/v5/repo");

Page({
  data: { ready: false },

  onShow() {
    // 每次进页面都从本机存储重读，不信任模块缓存（存储可能被清）
    let data;
    try {
      data = repo.load();
    } catch (error) {
      wx.showModal({
        title: "记录没有读出来",
        content: error.message,
        confirmText: "重试读取",
        showCancel: false,
        success: (result) => { if (result.confirm) this.onShow(); },
      });
      return;
    }
    if (!data.baby) {
      wx.redirectTo({ url: "/pages/v5/setup/index" });
      return;
    }
    this.setData({ ready: true });
  },
});
