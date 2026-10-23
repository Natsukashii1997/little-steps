"use strict";

const CLEANUP_QUEUE_KEY = "little-steps-miniapp-media-cleanup-v1";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

let cachedOpenId = "";
let runtimeConfig = null;
let memoryCleanupQueue = [];

function wxApi() {
  if (typeof wx === "undefined") throw new Error("请在微信小程序中使用媒体功能");
  return wx;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return Array.from(new Set((values || []).filter(Boolean).map(String))); }
function extension(path) {
  const cleanPath = String(path || "").split("?")[0];
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "bin";
}
function configure(config) {
  const next = config && typeof config === "object" ? config : {};
  const previousEnv = runtimeConfig && (runtimeConfig.envId || runtimeConfig.CLOUD_ENV_ID || runtimeConfig.cloudEnvId);
  const nextEnv = next.envId || next.CLOUD_ENV_ID || next.cloudEnvId;
  runtimeConfig = Object.assign({}, next);
  if (previousEnv !== nextEnv) cachedOpenId = "";
}
function readConfig() {
  if (runtimeConfig) return runtimeConfig;
  let base = {};
  let local = {};
  try { base = require("../config") || {}; } catch (error) { base = {}; }
  try { local = require("../config.local") || {}; } catch (error) { local = {}; }
  return Object.assign({}, base, local);
}
function cloudEnabled(api) {
  const config = readConfig();
  const envId = config.envId || config.CLOUD_ENV_ID || config.cloudEnvId;
  return Boolean(config.useCloud && envId && api.cloud && typeof api.cloud.uploadFile === "function");
}
function isCloudMedia(ref) { return /^cloud:\/\//i.test(String(ref || "")); }
function isLocalMedia(ref) {
  const value = String(ref || "");
  if (/^(?:wxfile:\/\/|http:\/\/usr\/|https:\/\/usr\/)/i.test(value)) return true;
  try {
    const api = wxApi();
    return Boolean(api.env && api.env.USER_DATA_PATH && value.indexOf(api.env.USER_DATA_PATH) === 0);
  } catch (error) { return false; }
}
function isManagedMedia(ref) { return isCloudMedia(ref) || isLocalMedia(ref); }
function mediaPath(result) { return result && (result.fileID || result.savedFilePath || result.path || result.localPath) || ""; }

function getOpenId(api) {
  if (cachedOpenId) return Promise.resolve(cachedOpenId);
  return new Promise(function (resolve, reject) {
    api.cloud.callFunction({
      name: "familyApi",
      data: { action: "getStatus" },
      success: function (result) {
        const payload = result && result.result || {};
        if (!payload.openId) return reject(new Error("未获取到微信用户身份，请重新进入小程序"));
        cachedOpenId = payload.openId;
        resolve(cachedOpenId);
      },
      fail: reject,
    });
  });
}
function saveLocal(api, file, path) {
  return new Promise(function (resolve, reject) {
    api.saveFile({
      tempFilePath: path,
      success: function (result) {
        resolve({ fileID: result.savedFilePath, cloudPath: "", local: true, name: file.name || "", size: file.size || 0 });
      },
      fail: reject,
    });
  });
}
function chooseImage(options) {
  const api = wxApi();
  const setting = Object.assign({ count: 1, sourceType: ["album", "camera"] }, options || {});
  return new Promise(function (resolve, reject) {
    api.chooseMedia({
      count: setting.count, mediaType: ["image"], sourceType: setting.sourceType,
      success: function (result) {
        resolve((result.tempFiles || []).map(function (file) {
          return { path: file.tempFilePath, size: file.size || 0, type: file.fileType || "image", name: file.tempFilePath.split("/").pop() };
        }));
      }, fail: reject,
    });
  });
}
function chooseAudio(options) {
  const api = wxApi();
  const setting = Object.assign({ count: 1 }, options || {});
  return new Promise(function (resolve, reject) {
    api.chooseMessageFile({
      count: setting.count, type: "file", extension: ["mp3", "m4a", "aac", "wav", "ogg"],
      success: function (result) {
        resolve((result.tempFiles || []).map(function (file) {
          return { path: file.path, size: file.size || 0, type: file.type || "audio", name: file.name || file.path.split("/").pop() };
        }));
      }, fail: reject,
    });
  });
}
function validateFile(file, category) {
  const size = Number(file && file.size || 0);
  if (category === "images" && size > MAX_IMAGE_BYTES) throw new Error("照片请控制在 12 MB 以内");
  if (category === "audio" && size > MAX_AUDIO_BYTES) throw new Error("音频请控制在 50 MB 以内");
}
async function upload(file, category) {
  const api = wxApi();
  const path = file && (file.path || file.tempFilePath);
  if (!path) throw new Error("未找到要上传的文件");
  validateFile(file, category);
  const safeCategory = String(category || "uploads").replace(/[^a-zA-Z0-9_-]/g, "-");
  if (!cloudEnabled(api)) return saveLocal(api, file, path);
  const openId = await getOpenId(api);
  const cloudPath = "family-media/" + openId + "/" + safeCategory + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + extension(file.name || path);
  return new Promise(function (resolve, reject) {
    api.cloud.uploadFile({
      cloudPath: cloudPath, filePath: path,
      success: function (result) {
        if (!result || !result.fileID) return reject(new Error("云端未返回文件地址"));
        resolve({ fileID: result.fileID, cloudPath: cloudPath, name: file.name || "", size: file.size || 0 });
      }, fail: reject,
    });
  });
}
function uploadImage(file) { return upload(file, "images"); }
function uploadAudio(file) { return upload(file, "audio"); }

function readCleanupQueue() {
  try {
    const api = wxApi();
    if (typeof api.getStorageSync === "function") {
      const stored = api.getStorageSync(CLEANUP_QUEUE_KEY);
      if (Array.isArray(stored)) memoryCleanupQueue = unique(stored.filter(isManagedMedia));
    }
  } catch (error) { /* The in-memory queue remains available. */ }
  return memoryCleanupQueue.slice();
}
function writeCleanupQueue(queue) {
  memoryCleanupQueue = unique((queue || []).filter(isManagedMedia));
  try {
    const api = wxApi();
    if (typeof api.setStorageSync === "function") api.setStorageSync(CLEANUP_QUEUE_KEY, memoryCleanupQueue);
  } catch (error) { /* Retry remains available in this session. */ }
}
function getCleanupQueue() { return readCleanupQueue(); }
function removeFromCleanupQueue(ref) { writeCleanupQueue(readCleanupQueue().filter(function (item) { return item !== ref; })); }
function queueCleanup(ref) {
  if (isManagedMedia(ref)) writeCleanupQueue(readCleanupQueue().concat(ref));
}
function deleteManagedMedia(api, ref) {
  if (isCloudMedia(ref)) {
    if (!api.cloud || typeof api.cloud.deleteFile !== "function") return Promise.reject(new Error("云存储暂不可用"));
    return new Promise(function (resolve, reject) {
      api.cloud.deleteFile({
        fileList: [ref],
        success: function (result) {
          const item = result && result.fileList && result.fileList[0];
          if (item && item.status && Number(item.status) !== 0) return reject(new Error(item.errMsg || "云文件删除失败"));
          resolve(result || {});
        }, fail: reject,
      });
    });
  }
  if (isLocalMedia(ref)) {
    if (typeof api.removeSavedFile !== "function") return Promise.reject(new Error("本机文件删除接口不可用"));
    return new Promise(function (resolve, reject) {
      api.removeSavedFile({ filePath: ref, success: resolve, fail: reject });
    });
  }
  return Promise.resolve({ skipped: true });
}
async function deleteMedia(ref, options) {
  if (!isManagedMedia(ref)) return { deleted: false, skipped: true, ref: ref || "" };
  const setting = Object.assign({ queueOnFailure: true }, options || {});
  try {
    await deleteManagedMedia(wxApi(), ref);
    removeFromCleanupQueue(ref);
    return { deleted: true, skipped: false, ref: ref };
  } catch (error) {
    if (setting.queueOnFailure) queueCleanup(ref);
    return { deleted: false, skipped: false, ref: ref, error: error };
  }
}
async function deleteMediaList(refs, options) {
  const results = [];
  for (const ref of unique(refs)) results.push(await deleteMedia(ref, options));
  return results;
}
async function flushCleanupQueue(snapshot, options) {
  const queued = readCleanupQueue();
  const remaining = [];
  const setting = options || {};
  const retainedRefs = new Set(mediaReferences(snapshot).concat(
    unique(setting.protectedRefs).filter(isManagedMedia),
  ));
  let deleted = 0;
  let protectedCount = 0;
  for (const ref of queued) {
    if (retainedRefs.has(ref)) {
      protectedCount += 1;
      remaining.push(ref);
      continue;
    }
    const result = await deleteMedia(ref, { queueOnFailure: false });
    if (result.deleted || result.skipped) deleted += 1;
    else remaining.push(ref);
  }
  writeCleanupQueue(remaining);
  return { attempted: queued.length, deleted: deleted, protected: protectedCount, remaining: remaining.length };
}
async function commitChange(options) {
  const setting = options || {};
  if (typeof setting.persist !== "function") throw new Error("缺少数据保存操作");
  const original = unique(setting.originalRefs).filter(isManagedMedia);
  const current = unique(setting.currentRefs).filter(isManagedMedia);
  const originalSet = new Set(original);
  const currentSet = new Set(current);
  const newRefs = current.filter(function (ref) { return !originalSet.has(ref); });
  const replacedRefs = original.filter(function (ref) { return !currentSet.has(ref); });
  let result;
  try { result = await setting.persist(); }
  catch (error) { await deleteMediaList(newRefs); throw error; }
  const retainedRefs = new Set(mediaReferences(result));
  const deferredRefs = replacedRefs.filter(function (ref) { return retainedRefs.has(ref); });
  deferredRefs.forEach(queueCleanup);
  await deleteMediaList(replacedRefs.filter(function (ref) { return !retainedRefs.has(ref); }));
  return result;
}
async function discardDraft(options) {
  const setting = options || {};
  const originalSet = new Set(unique(setting.originalRefs).filter(isManagedMedia));
  const abandoned = unique(setting.currentRefs).filter(function (ref) { return isManagedMedia(ref) && !originalSet.has(ref); });
  return deleteMediaList(abandoned);
}
async function removeWithMedia(options) {
  const setting = options || {};
  if (typeof setting.persist !== "function") throw new Error("缺少数据删除操作");
  const result = await setting.persist();
  const retainedRefs = new Set(mediaReferences(result).concat(
    unique(setting.protectedRefs).filter(isManagedMedia),
  ));
  const candidates = unique(setting.refs).filter(isManagedMedia);
  candidates.filter(function (ref) { return retainedRefs.has(ref); }).forEach(queueCleanup);
  await deleteMediaList(candidates.filter(function (ref) { return !retainedRefs.has(ref); }));
  return result;
}
function mediaReferences(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const refs = [];
  const visited = [];
  function collect(value) {
    if (isManagedMedia(value)) {
      refs.push(String(value));
      return;
    }
    if (!value || typeof value !== "object" || visited.indexOf(value) !== -1) return;
    visited.push(value);
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    Object.keys(value).forEach(function (key) { collect(value[key]); });
  }
  collect(snapshot);
  return unique(refs);
}
function mediaLocations(snapshot) {
  const locations = [];
  const visited = [];
  function categoryFor(target, key, context) {
    const field = String(key || "").toLowerCase();
    const recordType = String(target && (target.type || target.kind) || "").toLowerCase();
    if (field.indexOf("audio") !== -1) return "audio";
    if (field.indexOf("image") !== -1 || field.indexOf("photo") !== -1 || field.indexOf("cover") !== -1 || field.indexOf("avatar") !== -1) return "images";
    if (field === "assetid" && (recordType === "audio" || recordType === "music")) return "audio";
    return "images";
  }
  function collect(target, context) {
    if (!target || typeof target !== "object" || visited.indexOf(target) !== -1) return;
    visited.push(target);
    const nextContext = typeof target.collection === "string" ? target.collection : context;
    Object.keys(target).forEach(function (key) {
      const value = target[key];
      const childContext = ["memories", "abilities"].indexOf(key) !== -1
        ? key
        : nextContext;
      if (isLocalMedia(value)) {
        locations.push({ target: target, key: key, category: categoryFor(target, key, childContext) });
      } else if (value && typeof value === "object") {
        collect(value, childContext);
      }
    });
  }
  collect(snapshot, "");
  return locations;
}
async function migrateSnapshotMedia(snapshot) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const next = clone(source);
  const api = wxApi();
  if (!cloudEnabled(api)) return { changed: false, data: next, originalRefs: [], currentRefs: [] };
  const locations = mediaLocations(next);
  if (!locations.length) return { changed: false, data: next, originalRefs: [], currentRefs: [] };
  const byLocalRef = new Map();
  const uploaded = [];
  try {
    for (const location of locations) {
      const localRef = location.target[location.key];
      if (!byLocalRef.has(localRef)) {
        const result = await upload({ path: localRef, name: String(localRef).split("/").pop(), size: 0 }, location.category);
        const cloudRef = mediaPath(result);
        if (!isCloudMedia(cloudRef)) throw new Error("历史媒体未成功迁移到云端");
        byLocalRef.set(localRef, cloudRef);
        uploaded.push(cloudRef);
      }
      location.target[location.key] = byLocalRef.get(localRef);
    }
  } catch (error) { await deleteMediaList(uploaded); throw error; }
  return { changed: true, data: next, originalRefs: Array.from(byLocalRef.keys()), currentRefs: Array.from(byLocalRef.values()) };
}

module.exports = {
  chooseImage, uploadImage, chooseAudio, uploadAudio, mediaPath, configure,
  isCloudMedia, isLocalMedia, deleteMedia, deleteMediaList, getCleanupQueue,
  mediaReferences, flushCleanupQueue, commitChange, discardDraft, removeWithMedia, migrateSnapshotMedia,
};
