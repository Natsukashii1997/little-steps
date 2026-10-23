"use strict";

const { getHeaderLayout } = require("../../lib/layout");

Component({
  properties: {
    title: { type: String, value: "" },
    pageTitle: { type: String, value: "" },
    home: { type: Boolean, value: false },
    showBack: { type: Boolean, value: false },
    showNotice: { type: Boolean, value: true },
    noticeUnread: { type: Boolean, value: false },
    showShare: { type: Boolean, value: true }
  },
  data: {
    statusBarHeight: 24,
    contentTop: 68,
    barHeight: 52,
    totalHeight: 120
  },
  lifetimes: {
    attached() {
      this.setData(getHeaderLayout());
    }
  },
  methods: {
    handleBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.reLaunch({ url: "/pages/home/index" });
      }
      this.triggerEvent("back");
    },
    handleNotice() {
      if (this.properties.home) {
        this.triggerEvent("notice");
        return;
      }
      wx.reLaunch({ url: "/pages/home/index?openNotices=1" });
    }
  }
});
