Component({
  properties: {
    items: { type: Array, value: [] },
    active: { type: String, value: "" },
    ariaLabelText: { type: String, value: "分类切换" }
  },
  methods: {
    handleChange(event) {
      const key = event.currentTarget.dataset.key;
      if (key === this.data.active) return;
      this.triggerEvent("change", { key });
    }
  }
});
