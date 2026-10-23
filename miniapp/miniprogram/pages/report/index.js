"use strict";

const store = require("../../lib/store");
const report = require("../../lib/report");
const { BABY } = require("../../lib/constants");
const { getHeaderLayout } = require("../../lib/layout");

const DEFAULT_SELECTED_MODULES = Object.freeze(["care", "growth", "health"]);

function pad(value) { return String(value).padStart(2, "0"); }
function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
function localDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}
function errorText(error, fallback) {
  return error && (error.errMsg || error.message) || fallback;
}
function setDataAsync(page, updates) {
  return new Promise(function (resolve) { page.setData(updates, resolve); });
}
function selectCanvas(page) {
  return new Promise(function (resolve, reject) {
    const query = wx.createSelectorQuery();
    if (typeof query.in === "function") query.in(page);
    query.select("#reportCanvas").fields({ node: true, size: true }).exec(function (result) {
      const box = result && result[0];
      if (!box || !box.node) reject(new Error("长图画布未准备好，请稍后重试"));
      else resolve(box);
    });
  });
}
function exportCanvas(canvas, dimensions) {
  return new Promise(function (resolve, reject) {
    wx.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
      destWidth: Math.round(dimensions.width * dimensions.dpr),
      destHeight: Math.round(dimensions.height * dimensions.dpr),
      fileType: "png",
      quality: 1,
      success: function (result) {
        if (!result || !result.tempFilePath) reject(new Error("长图生成后没有可用文件"));
        else resolve(result.tempFilePath);
      },
      fail: reject,
    });
  });
}
function previewImage(path) {
  return new Promise(function (resolve, reject) {
    wx.previewImage({ current: path, urls: [path], success: resolve, fail: reject });
  });
}
function saveImage(path) {
  return new Promise(function (resolve, reject) {
    wx.saveImageToPhotosAlbum({ filePath: path, success: resolve, fail: reject });
  });
}

Page({
  data: {
    headerHeight: getHeaderLayout().totalHeight,
    today: "",
    birthDate: BABY.birthDate,
    reportStartDate: BABY.birthDate,
    reportEndDate: BABY.birthDate,
    moduleOptions: report.SECTION_DEFINITIONS.map(function (item) {
      return {
        key: item.key,
        title: item.title,
        description: item.description,
        selected: DEFAULT_SELECTED_MODULES.indexOf(item.key) !== -1,
      };
    }),
    selectedModules: DEFAULT_SELECTED_MODULES.slice(),
    reportSections: [],
    reportCanvasHeight: 500,
    generatedImagePath: "",
    reportError: "",
    generating: false,
    saving: false,
    sharing: false,
  },

  async onLoad() {
    const app = getApp();
    await (app.globalData.ready || store.init());
    const data = store.getData();
    const baby = Object.assign({}, BABY, data.baby || {});
    const now = this.now ? this.now() : new Date();
    const endDate = dateKey(now);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 12);
    const startDate = dateKey(sevenDaysAgo) < baby.birthDate ? baby.birthDate : dateKey(sevenDaysAgo);
    this.setData({
      today: endDate,
      birthDate: baby.birthDate,
      reportStartDate: startDate,
      reportEndDate: endDate,
    });
  },

  handleStartDate(event) {
    this.setData({ reportStartDate: event.detail.value, generatedImagePath: "", reportError: "" });
  },

  handleEndDate(event) {
    this.setData({ reportEndDate: event.detail.value, generatedImagePath: "", reportError: "" });
  },

  handleModuleChange(event) {
    const selected = Array.isArray(event.detail.value) ? event.detail.value.slice() : [];
    this.setData({
      selectedModules: selected,
      moduleOptions: this.data.moduleOptions.map(function (item) {
        return Object.assign({}, item, { selected: selected.indexOf(item.key) !== -1 });
      }),
      generatedImagePath: "",
      reportError: "",
    });
  },

  validateSelection() {
    if (!this.data.selectedModules.length) return "请至少选择一个摘要模块";
    const start = localDate(this.data.reportStartDate);
    const end = localDate(this.data.reportEndDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "请选择正确的报告日期";
    if (start > end) return "开始日期不能晚于结束日期";
    return "";
  },

  async generateReport() {
    if (this.data.generating) return;
    const validationError = this.validateSelection();
    if (validationError) {
      this.setData({ reportError: validationError, generatedImagePath: "" });
      wx.showToast({ title: validationError, icon: "none" });
      return;
    }

    let loadingShown = false;
    try {
      this.setData({ generating: true, reportError: "", generatedImagePath: "" });
      wx.showLoading({ title: "正在生成长图" });
      loadingShown = true;
      const model = report.buildReport(store.getData(), {
        startDate: this.data.reportStartDate,
        endDate: this.data.reportEndDate,
        selectedModules: this.data.selectedModules,
        generatedAt: this.now ? this.now() : new Date(),
      });
      await setDataAsync(this, { reportSections: model.sections, reportCanvasHeight: model.height });
      const box = await selectCanvas(this);
      const dpr = typeof wx.getWindowInfo === "function" ? wx.getWindowInfo().pixelRatio || 1 : 1;
      const dimensions = report.drawReport(box.node, model, box.width || model.width, dpr);
      const imagePath = await exportCanvas(box.node, dimensions);
      await previewImage(imagePath);
      this.setData({ generatedImagePath: imagePath });
      wx.showToast({ title: "长图已生成", icon: "success" });
    } catch (error) {
      const message = "生成失败：" + errorText(error, "请稍后重试");
      this.setData({ reportError: message, generatedImagePath: "" });
      wx.showToast({ title: message, icon: "none", duration: 3000 });
    } finally {
      if (loadingShown) wx.hideLoading();
      this.setData({ generating: false });
    }
  },

  async previewGeneratedReport() {
    if (!this.data.generatedImagePath) return;
    try {
      await previewImage(this.data.generatedImagePath);
    } catch (error) {
      wx.showToast({ title: errorText(error, "预览失败，请重新生成"), icon: "none" });
    }
  },

  async saveGeneratedReport() {
    const path = this.data.generatedImagePath;
    if (!path || this.data.saving) return;
    try {
      this.setData({ saving: true });
      await saveImage(path);
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (error) {
      const message = String(errorText(error, "保存失败"));
      wx.showToast({
        title: message.indexOf("auth deny") !== -1 || message.indexOf("authorize") !== -1
          ? "请在微信设置中允许保存到相册"
          : "保存失败，可打开预览后长按保存",
        icon: "none",
        duration: 3000,
      });
    } finally {
      this.setData({ saving: false });
    }
  },

  async shareGeneratedReport() {
    const path = this.data.generatedImagePath;
    if (!path || this.data.sharing) return;
    if (typeof wx.showShareImageMenu !== "function") {
      wx.showToast({ title: "当前微信版本暂不支持直接分享，请保存后发送", icon: "none", duration: 3000 });
      return;
    }
    try {
      this.setData({ sharing: true });
      await new Promise(function (resolve, reject) {
        wx.showShareImageMenu({ path, success: resolve, fail: reject });
      });
    } catch (error) {
      if (String(errorText(error, "")).toLowerCase().indexOf("cancel") === -1) {
        wx.showToast({ title: "分享未完成，可保存后发送", icon: "none" });
      }
    } finally {
      this.setData({ sharing: false });
    }
  },
});
