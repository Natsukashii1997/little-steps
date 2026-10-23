"use strict";

// 底栏四格：今天｜这个月｜成长｜相册（常浩 2026-10-23 定）。当前页 ink 加字下淡蓝小点，其余 ink-2（规范 5.4）。
const ITEMS = [
  { id: "today", label: "今天", path: "/pages/v5/today/index" },
  { id: "stage", label: "这个月", path: "/pages/v5/stage/index" },
  { id: "growth", label: "成长", path: "/pages/v5/growth/index" },
  { id: "album", label: "相册", path: "/pages/v5/album/index" },
];

Component({
  properties: {
    active: { type: String, value: "today" },
  },
  data: {
    items: ITEMS,
  },
  methods: {
    navigate(event) {
      const { id, path } = event.currentTarget.dataset;
      if (id === this.data.active) return;
      wx.reLaunch({ url: path });
    },
  },
});
