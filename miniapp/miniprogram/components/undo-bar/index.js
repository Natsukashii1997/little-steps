"use strict";

Component({
  properties: {
    visible: { type: Boolean, value: false },
    message: { type: String, value: "已删除" },
    token: { type: String, value: "" },
  },

  observers: {
    "visible, token": function (visible) {
      this.clearExpiry();
      if (!visible) return;
      this.expiryTimer = setTimeout(() => {
        this.triggerEvent("expired");
      }, 5000);
    },
  },

  lifetimes: {
    detached() {
      this.clearExpiry();
    },
  },

  methods: {
    clearExpiry() {
      if (this.expiryTimer) clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    },

    handleUndo() {
      this.clearExpiry();
      this.triggerEvent("undo");
    },
  },
});
