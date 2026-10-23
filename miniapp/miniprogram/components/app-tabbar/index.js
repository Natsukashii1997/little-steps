const ITEMS = [
  { id: "home", label: "Home", path: "/pages/home/index", icon: "/assets/nav/nav-home.png" },
  { id: "memory", label: "Memory", path: "/pages/memory/index", icon: "/assets/nav/nav-memory.png" },
  { id: "growth", label: "Growth", path: "/pages/growth/index", icon: "/assets/nav/nav-growth.png" },
  { id: "health", label: "Health", path: "/pages/health/index", icon: "/assets/nav/nav-health.png" }
];

Component({
  properties: {
    activePage: { type: String, value: "home" }
  },
  data: { items: ITEMS },
  methods: {
    navigate(event) {
      const { id, path } = event.currentTarget.dataset;
      if (id === this.data.activePage) return;
      wx.reLaunch({ url: path });
    }
  }
});
