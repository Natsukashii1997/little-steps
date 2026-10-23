"use strict";

// 动作与选中（规范 5.2、5.3）：
// - primary：字下一笔浅绿（每屏只一处）；
// - secondary：字加「→」，没有底色；
// - select：选中的字下一笔淡蓝。
// 笔触按字数挑长短：≤2 字用 s，≤4 字用 m，其余 l。对外事件名 press，避免和原生 tap 重复触发。

Component({
  properties: {
    label: { type: String, value: "" },
    kind: { type: String, value: "secondary" },
    disabled: { type: Boolean, value: false },
  },
  data: {
    size: "m",
  },
  observers: {
    label(value) {
      const length = String(value || "").replace(/\s/g, "").length;
      this.setData({ size: length <= 2 ? "s" : length <= 4 ? "m" : "l" });
    },
  },
  methods: {
    tap() {
      if (this.data.disabled) return;
      this.triggerEvent("press");
    },
  },
});
