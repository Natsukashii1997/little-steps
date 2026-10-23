"use strict";

const store = require("../../lib/store");
const media = require("../../lib/media");
const { getHeaderLayout } = require("../../lib/layout");
const { makeId, dateKey } = require("../../lib/model");
const validation = require("../../lib/validation");

const TYPE_LABELS = { moment: "瞬间", photo: "照片", note: "随记" };
const TYPE_OPTIONS = ["瞬间", "照片", "随记"];
const TYPE_VALUES = ["moment", "photo", "note"];

function memoryDate(value) {
  const parts = String(value || "").split("-").map(Number);
  if (parts.length !== 3 || !parts[0]) return "日期未填写";
  return parts[0] + "年" + parts[1] + "月" + parts[2] + "日";
}

function errorText(error, fallback) {
  return error && (error.errMsg || error.message) || fallback;
}

function uniqueRefs(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(String)));
}

function photoIdsFor(item) {
  const record = item || {};
  const photos = Array.isArray(record.photoIds) ? record.photoIds.slice() : [];
  if (record.assetId && photos.indexOf(record.assetId) === -1) photos.unshift(record.assetId);
  return uniqueRefs(photos).slice(0, 9);
}

function memoryRefs(item) {
  const record = item || {};
  return photoIdsFor(record).concat(record.audioId || []).filter(Boolean);
}

function displayImage(item) {
  const photos = photoIdsFor(item);
  if (photos.length) return photos[0];
  if (item.type === "photo") return "/assets/ui/baby-avatar.webp";
  if (item.type === "note") return "/assets/memory/note-bear.png";
  if (/抬头|翻身|rollover/i.test(item.title || "")) return "/assets/memory/rollover.png";
  return "/assets/memory/smile.png";
}

Page({
  data: {
    headerHeight: getHeaderLayout().totalHeight,
    birthDate: "2026-08-04",
    today: validation.todayKey(),
    filters: [
      { value: "all", label: "全部" },
      { value: "moment", label: "瞬间" },
      { value: "photo", label: "照片" },
      { value: "note", label: "随记" },
    ],
    activeFilter: "all",
    records: [],
    totalCount: 0,
    editorOpen: false,
    editorId: "",
    editorTitle: "新增回忆",
    draft: {
      type: "moment", typeLabel: "瞬间", title: "", date: "", description: "",
      photoIds: [], originalPhotoIds: [], audioId: "", originalAudioId: "",
      audioName: "", originalAudioName: "",
    },
    typeOptions: TYPE_OPTIONS,
    uploading: false,
    saving: false,
    undoVisible: false,
    undoTrashId: "",
    undoMessage: "",
    undoToken: "",
    playingAudioId: "",
  },

  async onLoad() {
    const app = getApp();
    await (app.globalData.ready || store.init());
    this.unsubscribe = store.subscribe(() => this.refresh());
    this.refresh();
  },

  onUnload() {
    if (this.unsubscribe) this.unsubscribe();
    this.destroyAudio();
  },

  refresh() {
    const memories = (store.getData().memories || []).slice().sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    const activeFilter = this.data.activeFilter;
    const visible = memories.filter(function (item) {
      return activeFilter === "all" || item.type === activeFilter;
    }).map(function (item, index) {
      const photoIds = photoIdsFor(item);
      const hasAudio = Boolean(item.audioId);
      return Object.assign({}, item, {
        typeLabel: TYPE_LABELS[item.type] || "回忆",
        displayDate: memoryDate(item.date),
        imageSrc: displayImage(item),
        tone: item.type === "note" ? "blue" : (index % 2 ? "sage" : "yellow"),
        isPhoto: photoIds.length > 0,
        photoIds: photoIds,
        photoCount: photoIds.length,
        hasAudio: hasAudio,
        audioLabel: item.audioName || "语音回忆",
        descriptionText: item.description || (hasAudio ? "轻点播放这段声音" : (photoIds.length ? photoIds.length + " 张成长照片" : "一段小小的成长回忆")),
      });
    });
    this.setData({ records: visible, totalCount: memories.length, today: validation.todayKey() });
  },

  selectFilter(event) {
    const value = event.currentTarget.dataset.value;
    if (!value || value === this.data.activeFilter) return;
    this.setData({ activeFilter: value }, () => this.refresh());
  },

  openAdd() {
    const preferred = this.data.activeFilter === "all" ? "moment" : this.data.activeFilter;
    this.openEditor(null, preferred);
  },

  editRecord(event) {
    const id = event.currentTarget.dataset.id;
    const item = (store.getData().memories || []).find(function (record) { return record.id === id; });
    if (item) this.openEditor(item, item.type || "moment");
  },

  openEditor(item, defaultType) {
    const type = item && item.type || defaultType || "moment";
    const photoIds = photoIdsFor(item);
    const audioId = item && item.audioId || "";
    this.setData({
      editorOpen: true,
      editorId: item && item.id || "",
      editorTitle: item ? "编辑回忆" : "新增回忆",
      draft: {
        type: type,
        typeLabel: TYPE_LABELS[type] || "瞬间",
        title: item && item.title || "",
        date: item && item.date || dateKey(new Date()),
        description: item && item.description || "",
        photoIds: photoIds,
        originalPhotoIds: photoIds.slice(),
        audioId: audioId,
        originalAudioId: audioId,
        audioName: item && item.audioName || "",
        originalAudioName: item && item.audioName || "",
        sourceAbilityId: item && item.sourceAbilityId || "",
      },
    });
  },

  async closeEditor() {
    if (this.data.uploading || this.data.saving) return;
    const draft = this.data.draft || {};
    await media.discardDraft({
      originalRefs: memoryRefs({ photoIds: draft.originalPhotoIds, audioId: draft.originalAudioId }),
      currentRefs: memoryRefs({ photoIds: draft.photoIds, audioId: draft.audioId }),
    });
    this.setData({ editorOpen: false });
  },
  noop() {},

  handleInput(event) {
    this.setData({ ["draft." + event.currentTarget.dataset.field]: event.detail.value });
  },

  handleDate(event) { this.setData({ "draft.date": event.detail.value }); },

  async handleType(event) {
    const index = Number(event.detail.value);
    const type = TYPE_VALUES[index] || "moment";
    this.setData({ "draft.type": type, "draft.typeLabel": TYPE_LABELS[type] });
  },

  async choosePhotos() {
    if (this.data.uploading || this.data.saving) return;
    const draft = this.data.draft || {};
    const existing = photoIdsFor({ photoIds: draft.photoIds });
    const remaining = 9 - existing.length;
    if (remaining <= 0) {
      wx.showToast({ title: "每段回忆最多 9 张照片", icon: "none" });
      return;
    }
    let loadingShown = false;
    const uploadedRefs = [];
    try {
      const files = await media.chooseImage({ count: remaining });
      if (!files.length) return;
      this.setData({ uploading: true });
      wx.showLoading({ title: "正在保存照片" });
      loadingShown = true;
      for (const file of files.slice(0, remaining)) {
        const uploaded = await media.uploadImage(file);
        const ref = media.mediaPath(uploaded);
        if (!ref) throw new Error("照片保存失败");
        uploadedRefs.push(ref);
      }
      const previousAudio = this.data.draft.audioId || "";
      this.setData({
        "draft.photoIds": uniqueRefs(existing.concat(uploadedRefs)).slice(0, 9),
        "draft.audioId": "",
        "draft.audioName": "",
        "draft.type": "photo",
        "draft.typeLabel": "照片",
      });
      await media.discardDraft({
        originalRefs: [this.data.draft.originalAudioId],
        currentRefs: [previousAudio],
      });
      wx.showToast({ title: "已加入 " + uploadedRefs.length + " 张照片", icon: "success" });
    } catch (error) {
      await media.discardDraft({ originalRefs: [], currentRefs: uploadedRefs });
      if (!String(errorText(error, "")).includes("cancel")) wx.showToast({ title: errorText(error, "照片保存失败"), icon: "none" });
    } finally {
      if (loadingShown) wx.hideLoading();
      this.setData({ uploading: false });
    }
  },

  async removeDraftPhoto(event) {
    if (this.data.uploading || this.data.saving) return;
    const index = Number(event.currentTarget.dataset.index);
    const photos = photoIdsFor({ photoIds: this.data.draft.photoIds });
    if (!Number.isInteger(index) || index < 0 || index >= photos.length) return;
    const removed = photos.splice(index, 1)[0];
    this.setData({ "draft.photoIds": photos });
    await media.discardDraft({ originalRefs: this.data.draft.originalPhotoIds || [], currentRefs: [removed] });
  },

  previewDraftPhoto(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const urls = photoIdsFor({ photoIds: this.data.draft.photoIds });
    if (!urls.length || typeof wx.previewImage !== "function") return;
    wx.previewImage({ current: urls[index] || urls[0], urls: urls });
  },

  async chooseMemoryAudio() {
    if (this.data.uploading || this.data.saving) return;
    let loadingShown = false;
    let uploadedRef = "";
    try {
      const files = await media.chooseAudio({ count: 1 });
      if (!files.length) return;
      this.setData({ uploading: true });
      wx.showLoading({ title: "正在保存音频" });
      loadingShown = true;
      const uploaded = await media.uploadAudio(files[0]);
      uploadedRef = media.mediaPath(uploaded);
      if (!uploadedRef) throw new Error("音频保存失败");
      const previousAudio = this.data.draft.audioId || "";
      const previousPhotos = photoIdsFor({ photoIds: this.data.draft.photoIds });
      this.setData({
        "draft.audioId": uploadedRef,
        "draft.audioName": uploaded.name || files[0].name || "语音回忆",
        "draft.photoIds": [],
      });
      await media.discardDraft({ originalRefs: [this.data.draft.originalAudioId], currentRefs: [previousAudio] });
      await media.discardDraft({ originalRefs: this.data.draft.originalPhotoIds || [], currentRefs: previousPhotos });
      wx.showToast({ title: "音频已选择", icon: "success" });
    } catch (error) {
      if (uploadedRef) await media.discardDraft({ originalRefs: [], currentRefs: [uploadedRef] });
      if (!String(errorText(error, "")).includes("cancel")) wx.showToast({ title: errorText(error, "音频保存失败"), icon: "none" });
    } finally {
      if (loadingShown) wx.hideLoading();
      this.setData({ uploading: false });
    }
  },

  async removeDraftAudio() {
    if (this.data.uploading || this.data.saving) return;
    const removed = this.data.draft.audioId || "";
    this.setData({ "draft.audioId": "", "draft.audioName": "" });
    await media.discardDraft({ originalRefs: [this.data.draft.originalAudioId], currentRefs: [removed] });
  },

  async saveRecord() {
    if (this.data.saving) return;
    const draft = this.data.draft;
    const rawTitle = String(draft.title || "").trim();
    const description = String(draft.description || "").trim();
    const photoIds = photoIdsFor({ photoIds: draft.photoIds });
    const audioId = String(draft.audioId || "");
    if (!draft.date) {
      wx.showToast({ title: "请选择回忆日期", icon: "none" });
      return;
    }
    if (!rawTitle && !description && !photoIds.length && !audioId) {
      wx.showToast({ title: "请填写文字、选择照片或上传音频", icon: "none" });
      return;
    }
    if (photoIds.length > 9) {
      wx.showToast({ title: "每段回忆最多 9 张照片", icon: "none" });
      return;
    }
    if (photoIds.length && audioId) {
      wx.showToast({ title: "照片和音频请只保留一种", icon: "none" });
      return;
    }
    const dateResult = validation.validateDateInLife(
      draft.date,
      this.data.today + "T23:59:59+08:00",
      "回忆日期",
    );
    if (!dateResult.ok) {
      wx.showToast({ title: dateResult.message, icon: "none" });
      return;
    }
    const title = rawTitle || (audioId ? "一段声音回忆" : (photoIds.length ? (photoIds.length > 1 ? photoIds.length + " 张成长照片" : "一张成长照片") : "一段小回忆"));
    const originalRefs = memoryRefs({ photoIds: draft.originalPhotoIds, audioId: draft.originalAudioId });
    const currentRefs = memoryRefs({ photoIds: photoIds, audioId: audioId });
    try {
      this.setData({ saving: true });
      await media.commitChange({
        originalRefs: originalRefs,
        currentRefs: currentRefs,
        persist: () => store.upsert("memories", {
          id: this.data.editorId || makeId("memory"),
          type: draft.type || "moment",
          title: title,
          date: draft.date,
          description: description,
          photoIds: photoIds,
          assetId: photoIds[0] || "",
          audioId: audioId,
          audioName: audioId ? String(draft.audioName || "语音回忆") : "",
          sourceAbilityId: draft.sourceAbilityId || "",
        }),
      });
      this.setData({ editorOpen: false });
      wx.showToast({ title: "回忆已保存", icon: "success" });
    } catch (error) {
      this.setData({
        "draft.photoIds": (draft.originalPhotoIds || []).slice(),
        "draft.audioId": draft.originalAudioId || "",
        "draft.audioName": draft.originalAudioName || "",
      });
      wx.showToast({ title: errorText(error, "保存失败"), icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  async playMemoryAudio(event) {
    const id = event.currentTarget.dataset.id;
    const item = (store.getData().memories || []).find(function (record) { return record.id === id; });
    if (!item || !item.audioId) return;
    if (this.data.playingAudioId === id) {
      this.destroyAudio();
      return;
    }
    this.destroyAudio();
    try {
      let source = item.audioId;
      if (/^cloud:\/\//i.test(source) && wx.cloud && typeof wx.cloud.getTempFileURL === "function") {
        const result = await new Promise(function (resolve, reject) {
          wx.cloud.getTempFileURL({ fileList: [source], success: resolve, fail: reject });
        });
        const file = result && result.fileList && result.fileList[0];
        source = file && (file.tempFileURL || file.fileID) || source;
      }
      const audio = wx.createInnerAudioContext();
      this.audio = audio;
      audio.src = source;
      audio.onPlay(() => this.setData({ playingAudioId: id }));
      audio.onEnded(() => this.destroyAudio());
      audio.onError(() => {
        this.destroyAudio();
        wx.showToast({ title: "音频播放失败，请重试", icon: "none" });
      });
      audio.play();
    } catch (error) {
      this.destroyAudio();
      wx.showToast({ title: errorText(error, "音频播放失败"), icon: "none" });
    }
  },

  destroyAudio() {
    if (this.audio) {
      try { this.audio.destroy(); } catch (error) { /* Ignore a finished context. */ }
      this.audio = null;
    }
    if (this.data && this.data.playingAudioId) this.setData({ playingAudioId: "" });
  },

  async deleteRecord() {
    if (this.data.saving || this.data.uploading) return;
    const id = this.data.editorId;
    if (!id) return;
    const confirmed = await new Promise(function (resolve) {
      wx.showModal({
        title: "删除这段回忆？",
        content: "删除后 30 天内可恢复。关联的健康记录不会被删除。",
        confirmText: "删除",
        confirmColor: "#c96050",
        success: function (result) { resolve(result.confirm); },
      });
    });
    if (!confirmed) return;
    try {
      this.setData({ saving: true });
      const removed = await store.remove("memories", id);
      this.setData({ editorOpen: false });
      this.showUndo(removed, "回忆已删除");
    } catch (error) {
      wx.showToast({ title: errorText(error, "删除失败，请重试"), icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  showUndo(result, message) {
    const trashId = result && result.trashId || "";
    if (!trashId) {
      wx.showToast({ title: message || "已删除", icon: "success" });
      return;
    }
    this.setData({
      undoVisible: true,
      undoTrashId: trashId,
      undoMessage: message || "已删除",
      undoToken: trashId + ":" + Date.now(),
    });
  },

  onUndoExpired() {
    this.setData({ undoVisible: false, undoTrashId: "", undoMessage: "", undoToken: "" });
  },

  async undoLastDelete() {
    const trashId = this.data.undoTrashId;
    if (!trashId || this.undoRestoring) return;
    this.undoRestoring = true;
    try {
      await store.restoreFromTrash(trashId);
      if (this.data.undoTrashId === trashId) this.onUndoExpired();
      wx.showToast({ title: "已恢复", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error, "恢复失败，请到回收站重试"), icon: "none" });
    } finally {
      this.undoRestoring = false;
    }
  },

  onShareAppMessage() {
    return { title: "硕之的成长回忆", path: "/pages/memory/index" };
  },
});
