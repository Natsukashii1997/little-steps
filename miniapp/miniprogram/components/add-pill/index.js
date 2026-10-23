Component({
  properties: {
    primary: { type: Boolean, value: false },
    label: { type: String, value: "Add" },
    ariaLabel: { type: String, value: "新增" }
  },
  methods: {
    handleTap() {
      this.triggerEvent("add");
    }
  }
});

