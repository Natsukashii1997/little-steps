"use strict";

// 页顶：状态栏和胶囊那一行只铺纸色，不放内容（规范第 1 节）；二级页左上放小字「‹ 上一页名称」（规范 5.12）。
const { getHeaderLayout } = require("../../../lib/layout");

Component({
  properties: {
    back: { type: String, value: "" },
    backPath: { type: String, value: "" },
  },
  data: {
    contentTop: 68,
  },
  lifetimes: {
    attached() {
      const layout = getHeaderLayout();
      this.setData({ contentTop: layout.contentTop });
    },
  },
  methods: {
    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
        return;
      }
      if (this.data.backPath) wx.reLaunch({ url: this.data.backPath });
    },
  },
});
