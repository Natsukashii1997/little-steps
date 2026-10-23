const baseConfig = require("./config");
const store = require("./lib/store");
const media = require("./lib/media");

let localConfig = {};
try {
  localConfig = require("./config.local");
} catch (error) {
  localConfig = {};
}

const config = { ...baseConfig, ...localConfig };
media.configure(config);
let hasShownOnce = false;

function uniqueRefs(refs) {
  return Array.from(new Set((Array.isArray(refs) ? refs : []).filter(Boolean)));
}

async function protectedMediaReferences(expiredRefs) {
  const status = typeof store.getSyncStatus === "function" ? store.getSyncStatus() : {};
  if (!status || !status.familyId) return [];
  try {
    return await store.getProtectedMediaReferences();
  } catch (error) {
    // If the family backup index cannot be checked, defer every pending
    // physical deletion. Keeping an orphaned file is safer than losing a file
    // that an older recoverable backup still needs.
    console.warn("Little Steps 暂未核对云端备份媒体，本次不物理删除文件", error);
    const queued = typeof media.getCleanupQueue === "function" ? media.getCleanupQueue() : [];
    return uniqueRefs((expiredRefs || []).concat(queued || []));
  }
}

async function finishRuntimeSetup() {
  const pruned = await store.pruneExpiredRecoveryData();
  let expiredMediaRefs = [];
  if (pruned.changed) {
    expiredMediaRefs = media.mediaReferences({
      trashEntries: pruned.removedTrashEntries,
      recordHistory: pruned.removedHistoryEntries,
    });
  }
  const protectedRefs = await protectedMediaReferences(expiredMediaRefs);
  if (expiredMediaRefs.length) {
    await media.removeWithMedia({
      refs: expiredMediaRefs,
      protectedRefs: protectedRefs,
      persist: function () { return Promise.resolve(store.getData()); },
    });
  }
  await media.flushCleanupQueue(store.getData(), { protectedRefs: protectedRefs });
  const migration = await media.migrateSnapshotMedia(store.getData());
  if (!migration.changed) return store.getData();
  await media.commitChange({
    originalRefs: migration.originalRefs,
    currentRefs: migration.currentRefs,
    persist: function () {
      return store.mutate(function () { return migration.data; });
    },
  });
  return store.getData();
}

async function initializeRuntime() {
  await store.init({ config });
  try {
    return await finishRuntimeSetup();
  } catch (error) {
    // Business records remain available even if media cleanup or migration is offline.
    console.warn("Little Steps 媒体整理将在下次联网时重试", error);
    return store.getData();
  }
}

App({
  globalData: {
    config,
    store,
    ready: null,
  },

  onLaunch() {
    if (config.useCloud && config.envId && wx.cloud) {
      wx.cloud.init({ env: config.envId, traceUser: true });
    }
    this.globalData.ready = initializeRuntime().catch((error) => {
      console.error("Little Steps 初始化失败", error);
      wx.showToast({ title: "数据初始化失败", icon: "none" });
      return store.getData();
    });
  },

  onShow() {
    if (!hasShownOnce) {
      hasShownOnce = true;
      return;
    }
    if (!config.useCloud || !config.envId || !wx.cloud) return;
    this.globalData.ready = store.init({ config }).then(finishRuntimeSetup).catch((error) => {
      console.error("Little Steps 前台同步失败", error);
      return store.getData();
    });
  },
});
