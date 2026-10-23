"use strict";

const { createSeedData, migrateSnapshot, CURRENT_SCHEMA_VERSION, makeId } = require("./model");
const { planRetention } = require("./retention");

const STORAGE_KEY = "little-steps-miniapp-family-v1";
const CONTEXT_KEY = "little-steps-miniapp-family-context-v1";
const COLLECTIONS = [
  "feedings", "sleeps", "diapers", "diaperChanges", "poops", "supplements", "todos", "memories", "growthRecords",
  "vaccines", "abilities", "checkups", "trashEntries", "recordHistory",
];
const RETIRED_FEATURE_KEYS = new Set(["musicTracks", "stories", "learningItems", "studySeedVersion"]);
const RETIRED_COLLECTIONS = new Set(["musicTracks", "stories", "learningItems"]);
const INTERNAL_COLLECTIONS = new Set(["trashEntries", "recordHistory"]);
const TRASH_RETENTION_DAYS = 30;
const MAX_SYNC_BATCH = 50;

let data = null;
let familyId = "";
let revision = 0;
let familyInfo = null;
let openId = "";
let capacity = null;
let outbox = [];
let partitionMode = false;
let manifestRevision = 0;
let partitionRevisions = {};
let syncConflicts = [];
let runtimeConfig = null;
let listeners = [];
let initializing = null;
let syncPromise = null;
let changeGeneration = 0;
let dirty = false;
let restoreRefreshRequired = false;
let syncStatus = { mode: "local", familyId: "", pending: false, error: "", needsSetup: false };

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function sanitizeOutbox(value) {
  return (Array.isArray(value) ? value : []).filter(function (operation) {
    if (!operation || typeof operation !== "object") return true;
    if (RETIRED_COLLECTIONS.has(operation.collection)) return false;
    return !(operation.collection === "__core__" && RETIRED_FEATURE_KEYS.has(operation.recordId));
  }).map(clone);
}
function sanitizeConflicts(value) {
  return (Array.isArray(value) ? value : []).filter(function (conflict) {
    return !conflict || !RETIRED_COLLECTIONS.has(conflict.collection);
  }).map(clone);
}
function sanitizePartitionRevisions(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.keys(source).reduce(function (result, key) {
    const collection = String(key).split("/")[0];
    if (!RETIRED_COLLECTIONS.has(collection)) result[key] = source[key];
    return result;
  }, {});
}
function timeValue(value) {
  const number = new Date(value || 0).getTime();
  return Number.isFinite(number) ? number : 0;
}
function isoNow(options) {
  const value = options && options.now ? new Date(options.now) : new Date();
  if (!Number.isFinite(value.getTime())) throw new Error("记录时间无效");
  return value.toISOString();
}
function expiresAt(isoValue, days) {
  return new Date(new Date(isoValue).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
function recordMonth(record) {
  const fields = ["date", "time", "start", "end", "completedDate", "deletedAt", "changedAt", "_updatedAt"];
  for (let index = 0; index < fields.length; index += 1) {
    const match = String(record && record[fields[index]] || "").match(/^(\d{4}-\d{2})/);
    if (match) return match[1];
  }
  return "undated";
}
function partitionKeyFor(collection, record) {
  return collection + "/" + recordMonth(record);
}
function changedFields(before, after) {
  const changes = {};
  Object.keys(Object.assign({}, before || {}, after || {})).forEach(function (key) {
    if (!after || !Object.prototype.hasOwnProperty.call(after, key)) return;
    if (!before || JSON.stringify(before[key]) !== JSON.stringify(after[key])) changes[key] = clone(after[key]);
  });
  return changes;
}
function makeOperation(details) {
  return Object.assign({
    operationId: makeId("op"),
    createdAt: new Date().toISOString(),
  }, details);
}
function operationsForChange(previous, next) {
  const operations = [];
  COLLECTIONS.forEach(function (collection) {
    const previousRecords = new Map((Array.isArray(previous[collection]) ? previous[collection] : []).filter(function (item) {
      return item && item.id;
    }).map(function (item) { return [item.id, item]; }));
    const nextRecords = new Map((Array.isArray(next[collection]) ? next[collection] : []).filter(function (item) {
      return item && item.id;
    }).map(function (item) { return [item.id, item]; }));
    const ids = new Set(Array.from(previousRecords.keys()).concat(Array.from(nextRecords.keys())));
    ids.forEach(function (id) {
      const before = previousRecords.get(id) || null;
      const after = nextRecords.get(id) || null;
      if (before && after && JSON.stringify(before) === JSON.stringify(after)) return;
      const oldPartitionKey = before ? partitionKeyFor(collection, before) : "";
      const newPartitionKey = after ? partitionKeyFor(collection, after) : "";
      if (before && (!after || oldPartitionKey !== newPartitionKey)) {
        operations.push(makeOperation({
          partitionKey: oldPartitionKey,
          collection: collection,
          recordId: id,
          kind: "delete",
          baseRecord: clone(before),
        }));
      }
      if (after) {
        operations.push(makeOperation({
          partitionKey: newPartitionKey,
          collection: collection,
          recordId: id,
          kind: "upsert",
          baseRecord: oldPartitionKey === newPartitionKey ? (before ? clone(before) : null) : null,
          changes: oldPartitionKey === newPartitionKey ? changedFields(before, after) : clone(after),
        }));
      }
    });
  });
  const internalKeys = new Set(COLLECTIONS.concat(Array.from(RETIRED_FEATURE_KEYS), ["updatedAt", "_updatedSections"]));
  Object.keys(Object.assign({}, previous, next)).forEach(function (key) {
    if (internalKeys.has(key) || JSON.stringify(previous[key]) === JSON.stringify(next[key])) return;
    operations.push(makeOperation({
      partitionKey: "core",
      collection: "__core__",
      recordId: key,
      kind: "upsert",
      baseRecord: { value: clone(previous[key]) },
      changes: { value: clone(next[key]) },
    }));
  });
  return operations;
}
function appendHistory(snapshot, details) {
  const entries = Array.isArray(snapshot.recordHistory) ? snapshot.recordHistory : [];
  entries.push({
    id: makeId("history"),
    collection: details.collection,
    recordId: details.recordId,
    action: details.action,
    changedAt: details.changedAt,
    changedBy: details.changedBy || "local-member",
    before: details.before ? clone(details.before) : null,
    after: details.after ? clone(details.after) : null,
    _updatedAt: details.changedAt,
  });
  snapshot.recordHistory = entries;
}
function prepareSnapshot(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : createSeedData();
  return migrateSnapshot(source);
}
function applyLocalSnapshot(value) {
  const migration = prepareSnapshot(value);
  data = migration.data;
  if (migration.changed) {
    dirty = true;
    changeGeneration += 1;
  }
  return migration;
}
function mergeSnapshotData(remoteValue, localValue) {
  const remote = prepareSnapshot(remoteValue).data;
  const local = prepareSnapshot(localValue).data;
  const merged = clone(remote);
  const remoteSections = remote._updatedSections && typeof remote._updatedSections === "object" ? remote._updatedSections : {};
  const localSections = local._updatedSections && typeof local._updatedSections === "object" ? local._updatedSections : {};
  const mergedSections = Object.assign({}, remoteSections);
  const internalKeys = new Set(COLLECTIONS.concat(["schemaVersion", "updatedAt", "_updatedSections", "_deletedRecords"]));

  Object.keys(Object.assign({}, remote, local)).forEach(function (key) {
    if (internalKeys.has(key)) return;
    if (!Object.prototype.hasOwnProperty.call(remote, key)) {
      merged[key] = clone(local[key]);
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(local, key)) return;
    if (timeValue(localSections[key]) > timeValue(remoteSections[key])) merged[key] = clone(local[key]);
  });

  Object.keys(Object.assign({}, remoteSections, localSections)).forEach(function (key) {
    mergedSections[key] = timeValue(localSections[key]) > timeValue(remoteSections[key]) ? localSections[key] : remoteSections[key];
  });
  const tombstones = new Map();
  function collectTombstones(list) {
    (Array.isArray(list) ? list : []).forEach(function (item) {
      if (!item || COLLECTIONS.indexOf(item.collection) === -1 || !item.id) return;
      const key = item.collection + ":" + item.id;
      const current = tombstones.get(key);
      if (!current || timeValue(item.deletedAt) >= timeValue(current.deletedAt)) tombstones.set(key, clone(item));
    });
  }
  collectTombstones(remote._deletedRecords);
  collectTombstones(local._deletedRecords);

  COLLECTIONS.forEach(function (collection) {
    const records = new Map();
    function collect(list, fallback, preferOnTie) {
      (Array.isArray(list) ? list : []).forEach(function (record) {
        if (!record || !record.id) return;
        const current = records.get(record.id);
        const candidateTime = timeValue(record._updatedAt || fallback);
        const currentTime = current ? current.time : -1;
        if (!current || candidateTime > currentTime || (preferOnTie && candidateTime === currentTime)) {
          records.set(record.id, { value: clone(record), time: candidateTime });
        }
      });
    }
    collect(remote[collection], remoteSections[collection] || "", false);
    collect(local[collection], localSections[collection] || "", false);
    merged[collection] = Array.from(records.values()).filter(function (entry) {
      const tombstone = tombstones.get(collection + ":" + entry.value.id);
      if (!tombstone) return true;
      // An exact v1 demo record is removed before merging. Therefore, if a
      // same-ID record survives migration on the other device, it is user
      // data and must win over the migration-only tombstone.
      if (tombstone.reason === "legacy-demo-v1") {
        tombstones.delete(collection + ":" + entry.value.id);
        return true;
      }
      if (entry.time > timeValue(tombstone.deletedAt)) {
        tombstones.delete(collection + ":" + entry.value.id);
        return true;
      }
      return false;
    }).map(function (entry) { return entry.value; });
  });
  merged._deletedRecords = Array.from(tombstones.values());
  merged._updatedSections = mergedSections;
  merged.updatedAt = timeValue(local.updatedAt) > timeValue(remote.updatedAt) ? local.updatedAt : remote.updatedAt;
  merged.schemaVersion = CURRENT_SCHEMA_VERSION;
  return prepareSnapshot(merged).data;
}
function resolveFamilySnapshot(remoteValue, localValue, mergeLocal) {
  return mergeLocal ? mergeSnapshotData(remoteValue, localValue) : prepareSnapshot(remoteValue).data;
}
function wxApi() { return typeof wx !== "undefined" ? wx : null; }
function readConfig() {
  if (runtimeConfig) return runtimeConfig;
  try {
    const base = require("../config") || {};
    let local = {};
    try { local = require("../config.local") || {}; } catch (error) { local = {}; }
    return Object.assign({}, base, local);
  } catch (error) { return {}; }
}
function cloudEnvId() {
  const config = readConfig();
  return config.envId || config.CLOUD_ENV_ID || config.cloudEnvId || "";
}
function cloudReady() {
  const api = wxApi();
  const config = readConfig();
  return Boolean(api && api.cloud && typeof api.cloud.callFunction === "function" && config.useCloud && cloudEnvId());
}
function invalidFamilyApiResponse(action) {
  const error = new Error("家庭云端返回了无法识别的数据，请稍后重试");
  error.code = "INVALID_FAMILY_API_RESPONSE";
  error.action = action;
  return error;
}
function restoreRefreshError(committed) {
  const error = new Error(committed
    ? "云端备份已恢复，本机数据尚未重新载入；请重新进入小程序"
    : "恢复结果尚未确认，请重新进入小程序完成重新载入");
  error.code = "RESTORE_REFRESH_REQUIRED";
  error.restoreCommitted = Boolean(committed);
  return error;
}
function ensureRestoreRefreshComplete() {
  if (restoreRefreshRequired) throw restoreRefreshError(false);
}
function persistLocal(snapshot, contextOverrides) {
  const api = wxApi();
  if (api && typeof api.setStorageSync === "function") {
    const persistedData = snapshot && typeof snapshot === "object" ? snapshot : data;
    const context = Object.assign(
      {
        familyId: familyId,
        revision: revision,
        familyInfo: familyInfo,
        openId: openId,
        capacity: capacity,
        dirty: dirty,
        restoreRefreshRequired: restoreRefreshRequired,
        outbox: clone(outbox),
        partitionMode: partitionMode,
        manifestRevision: manifestRevision,
        partitionRevisions: clone(partitionRevisions),
        syncConflicts: clone(syncConflicts),
      },
      contextOverrides || {},
    );
    api.setStorageSync(STORAGE_KEY, clone(persistedData));
    api.setStorageSync(CONTEXT_KEY, clone(context));
  }
}
function loadLocal() {
  const api = wxApi();
  if (!api || typeof api.getStorageSync !== "function") return null;
  const saved = api.getStorageSync(STORAGE_KEY);
  const context = api.getStorageSync(CONTEXT_KEY) || {};
  familyId = context.familyId || "";
  revision = Number(context.revision || 0);
  familyInfo = context.familyInfo || null;
  openId = context.openId || "";
  capacity = context.capacity || null;
  dirty = Boolean(context.dirty);
  restoreRefreshRequired = Boolean(context.restoreRefreshRequired);
  outbox = sanitizeOutbox(context.outbox);
  partitionMode = Boolean(context.partitionMode);
  manifestRevision = Number.isInteger(context.manifestRevision) && context.manifestRevision >= 0
    ? context.manifestRevision
    : 0;
  partitionRevisions = sanitizePartitionRevisions(context.partitionRevisions);
  syncConflicts = sanitizeConflicts(context.syncConflicts);
  return saved && typeof saved === "object" ? saved : null;
}
function emit() {
  const snapshot = getData();
  listeners.slice().forEach(function (listener) {
    try { listener(snapshot, getSyncStatus()); } catch (error) { /* A view cannot break the shared store. */ }
  });
}
function setStatus(next) {
  syncStatus = Object.assign({}, syncStatus, next, {
    familyId: familyId,
    family: familyInfo ? clone(familyInfo) : null,
    openId: openId,
    capacity: capacity ? clone(capacity) : null,
    revision: revision,
    restoreRefreshRequired: restoreRefreshRequired,
    outboxCount: outbox.length,
    partitionMode: partitionMode,
    manifestRevision: manifestRevision,
    partitionRevisions: clone(partitionRevisions),
    conflicts: clone(syncConflicts),
  });
  emit();
}
function callFamilyApi(action, payload) {
  const api = wxApi();
  return new Promise(function (resolve, reject) {
    api.cloud.callFunction({
      name: "familyApi",
      data: Object.assign({ action: action }, payload || {}),
      success: function (result) {
        const payload = result && result.result;
        if (payload && payload.ok === false) {
          const error = new Error(payload.error && payload.error.message || "家庭云端操作失败");
          error.code = payload.error && payload.error.code || "FAMILY_API_ERROR";
          error.definitiveFailure = true;
          reject(error);
          return;
        }
        if (!payload || payload.ok !== true) {
          reject(invalidFamilyApiResponse(action));
          return;
        }
        resolve(payload);
      },
      fail: reject,
    });
  });
}
function acceptFamily(result) {
  if (result && result.openId) openId = result.openId;
  if (result && result.capacity) capacity = clone(result.capacity);
  else if (result && result.snapshot && result.snapshot.capacity) capacity = clone(result.snapshot.capacity);
  if (result && result.family) {
    const nextFamilyId = result.family.familyId || "";
    if (nextFamilyId && nextFamilyId !== familyId) {
      revision = 0;
      restoreRefreshRequired = false;
      partitionMode = false;
      manifestRevision = 0;
      partitionRevisions = {};
      syncConflicts = [];
    }
    familyInfo = clone(result.family);
    familyId = nextFamilyId || familyId;
  }
}
function acceptRemote(result) {
  acceptFamily(result);
  const snapshot = result && result.snapshot;
  if (!snapshot || !snapshot.data || typeof snapshot.data !== "object" || !Object.keys(snapshot.data).length) return false;
  const migration = prepareSnapshot(snapshot.data);
  data = migration.data;
  revision = Number(snapshot.version || 0);
  dirty = migration.changed;
  if (migration.changed) changeGeneration += 1;
  persistLocal();
  return true;
}

async function loadRemoteFamily(options) {
  if (!familyId) return { loaded: false, changed: false };
  const requestGeneration = changeGeneration;
  const result = await callFamilyApi("load", { familyId: familyId });
  acceptFamily(result);
  const snapshot = result && result.snapshot;
  const forceRemote = Boolean(options && options.replaceLocal);
  const validData = snapshot && snapshot.data && typeof snapshot.data === "object" && !Array.isArray(snapshot.data);
  if (!validData || (!forceRemote && !Object.keys(snapshot.data).length)) {
    return { loaded: false, changed: false };
  }
  const snapshotVersion = Number(snapshot.version);
  if (!Number.isInteger(snapshotVersion) || snapshotVersion < 0) throw invalidFamilyApiResponse("load");
  const minimumVersion = Number(options && options.minimumVersion);
  if (Number.isInteger(minimumVersion) && snapshotVersion < minimumVersion) {
    throw restoreRefreshError(true);
  }
  const remoteData = clone(snapshot.data);
  const localAtApply = getData();
  const shouldMergeLocal = !forceRemote && (Boolean(options && options.mergeLocal) || changeGeneration !== requestGeneration);
  const nextData = resolveFamilySnapshot(remoteData, localAtApply, shouldMergeLocal);
  const changed = JSON.stringify(nextData) !== JSON.stringify(remoteData);
  data = nextData;
  revision = snapshotVersion;
  dirty = changed;
  if (changed && changeGeneration === requestGeneration) changeGeneration += 1;
  persistLocal();
  emit();
  return { loaded: true, changed: changed, version: revision, remoteData: remoteData };
}

function validPartitionResult(result) {
  return result && Array.isArray(result.partitions)
    && Number.isInteger(result.manifestRevision) && result.manifestRevision >= 0
    && result.partitionRevisions && typeof result.partitionRevisions === "object"
    && !Array.isArray(result.partitionRevisions);
}

function partitionEntries(partition) {
  if (Array.isArray(partition.recordEntries)) {
    return partition.recordEntries.filter(function (entry) {
      return entry && typeof entry.recordId === "string" && entry.recordId;
    }).map(function (entry) { return { recordId: entry.recordId, value: clone(entry.value) }; });
  }
  return (Array.isArray(partition.records) ? partition.records : []).filter(function (record) {
    return record && typeof record === "object" && record.id;
  }).map(function (record) { return { recordId: record.id, value: clone(record) }; });
}

function applyPartitionResult(result, options) {
  if (!validPartitionResult(result)) throw invalidFamilyApiResponse("loadPartitions");
  acceptFamily(result);
  const localAtApply = getData();
  const remote = clone(localAtApply);
  const collectionRecords = {};
  const representedCollections = new Set();
  (result.partitions || []).forEach(function (partition) {
    if (!partition || typeof partition.partitionKey !== "string" || typeof partition.collection !== "string") {
      throw invalidFamilyApiResponse("loadPartitions");
    }
    const entries = partitionEntries(partition);
    if (partition.collection === "__core__" && partition.partitionKey === "core") {
      entries.forEach(function (entry) {
        if (entry.recordId === "core" && entry.value && typeof entry.value === "object" && !Array.isArray(entry.value)) {
          Object.keys(entry.value).forEach(function (key) {
            if (!RETIRED_FEATURE_KEYS.has(key)) remote[key] = clone(entry.value[key]);
          });
        } else if (entry.value && typeof entry.value === "object" && Object.prototype.hasOwnProperty.call(entry.value, "value")) {
          if (!RETIRED_FEATURE_KEYS.has(entry.recordId)) remote[entry.recordId] = clone(entry.value.value);
        }
      });
      return;
    }
    if (RETIRED_COLLECTIONS.has(partition.collection)) return;
    if (COLLECTIONS.indexOf(partition.collection) === -1) throw invalidFamilyApiResponse("loadPartitions");
    representedCollections.add(partition.collection);
    if (!collectionRecords[partition.collection]) collectionRecords[partition.collection] = [];
    entries.forEach(function (entry) {
      if (entry.value && typeof entry.value === "object" && !Array.isArray(entry.value)) {
        collectionRecords[partition.collection].push(clone(entry.value));
      }
    });
  });
  representedCollections.forEach(function (collection) {
    remote[collection] = collectionRecords[collection] || [];
  });
  const mergeLocal = Boolean(options && options.mergeLocal);
  data = mergeLocal ? mergeSnapshotData(remote, localAtApply) : prepareSnapshot(remote).data;
  partitionMode = true;
  manifestRevision = result.manifestRevision;
  partitionRevisions = sanitizePartitionRevisions(result.partitionRevisions);
  syncConflicts = sanitizeConflicts(result.conflicts);
  dirty = outbox.length > 0;
  persistLocal();
  emit();
  return {
    loaded: true,
    partitioned: Boolean(result.partitioned),
    manifestRevision: manifestRevision,
    remoteData: clone(remote),
  };
}

async function loadPartitionedFamily(options) {
  if (!familyId) return { loaded: false, partitioned: false };
  const requestGeneration = changeGeneration;
  const result = await callFamilyApi("loadPartitions", { familyId: familyId });
  return applyPartitionResult(result, {
    mergeLocal: Boolean(options && options.mergeLocal)
      || changeGeneration !== requestGeneration
      || outbox.length > 0,
  });
}

async function ensurePartitionedFamily(options) {
  const loaded = await loadPartitionedFamily({ mergeLocal: Boolean(options && options.mergeLocal) });
  if (loaded.partitioned) return loaded;
  const result = await callFamilyApi("migrateLegacySnapshot", {
    familyId: familyId,
    legacyVersion: revision,
    data: getData(),
  });
  if (result.migrated !== true && result.reason !== "partition-data-exists") {
    throw invalidFamilyApiResponse("migrateLegacySnapshot");
  }
  return loadPartitionedFamily({ mergeLocal: Boolean(options && options.mergeLocal) });
}

function partitionProtocolUnavailable(error) {
  if (error && error.code === "INVALID_FAMILY_API_RESPONSE") return false;
  return !error || !error.definitiveFailure || error.code === "UNKNOWN_ACTION";
}

async function saveInitialSnapshot() {
  if (!familyId) return;
  const result = await callFamilyApi("save", { familyId: familyId, expectedVersion: revision, data: getData() });
  acceptFamily(result);
  revision = Number(result.version || revision || 0);
  dirty = false;
  persistLocal();
}

async function connectCurrentFamily(hadLocalChanges) {
  const loaded = await loadRemoteFamily({ mergeLocal: Boolean(hadLocalChanges) });
  let partitionLoad = null;
  try {
    partitionLoad = await ensurePartitionedFamily({ mergeLocal: Boolean(hadLocalChanges || outbox.length || loaded.changed) });
  } catch (error) {
    if (!partitionProtocolUnavailable(error)) throw error;
    partitionMode = false;
    persistLocal();
  }
  if (partitionLoad && loaded.changed && !outbox.length && partitionLoad.remoteData) {
    outbox = operationsForChange(partitionLoad.remoteData, getData());
    dirty = outbox.length > 0;
    persistLocal();
  }
  if (!partitionLoad && !loaded.loaded) await saveInitialSnapshot();
  if ((outbox.length || loaded.changed) && (partitionLoad || loaded.loaded)) await syncNow();
  return loaded;
}

async function initializeCloud() {
  const api = wxApi();
  const envId = cloudEnvId();
  api.cloud.init({ env: envId, traceUser: true });
  setStatus({ mode: "cloud", pending: true, error: "" });
  try {
    const previousFamilyId = familyId;
    const hadUnsyncedChanges = dirty;
    const pendingRestoreVersion = restoreRefreshRequired
      ? (partitionMode ? manifestRevision : revision)
      : null;
    const result = await callFamilyApi("bootstrap");
    acceptFamily(result);
    const mustRefreshAfterRestore = restoreRefreshRequired;
    if (result.joined && result.family) {
      if (mustRefreshAfterRestore && partitionMode) {
        const restoredPartitions = await loadPartitionedFamily({ mergeLocal: false });
        if (!restoredPartitions.loaded || restoredPartitions.manifestRevision < pendingRestoreVersion) {
          throw restoreRefreshError(true);
        }
        outbox = [];
        dirty = false;
        restoreRefreshRequired = false;
        persistLocal();
        setStatus({ mode: "cloud", pending: false, error: "", needsSetup: false });
        return;
      }
      const loaded = await loadRemoteFamily({
        replaceLocal: mustRefreshAfterRestore,
        minimumVersion: mustRefreshAfterRestore ? pendingRestoreVersion : undefined,
        mergeLocal: Boolean(!mustRefreshAfterRestore && hadUnsyncedChanges && (!previousFamilyId || previousFamilyId === familyId)),
      });
      if (mustRefreshAfterRestore) {
        if (!loaded.loaded) throw restoreRefreshError(false);
        restoreRefreshRequired = false;
        persistLocal();
      }
      let partitionsReady = false;
      let partitionLoad = null;
      try {
        partitionLoad = await ensurePartitionedFamily({
          mergeLocal: Boolean(!mustRefreshAfterRestore && (outbox.length || loaded.changed)),
        });
        partitionsReady = true;
      } catch (partitionError) {
        if (!partitionProtocolUnavailable(partitionError)) throw partitionError;
        // During a staged cloud-function rollout, old clients keep using the
        // legacy snapshot protocol. New daily writes switch automatically once
        // the partition actions are available.
        partitionMode = false;
        persistLocal();
      }
      if (partitionsReady && loaded.changed && !outbox.length && partitionLoad && partitionLoad.remoteData) {
        outbox = operationsForChange(partitionLoad.remoteData, getData());
        dirty = outbox.length > 0;
        persistLocal();
      }
      if (!partitionsReady && !loaded.loaded) await saveInitialSnapshot();
      if ((outbox.length || loaded.changed) && (partitionsReady || loaded.loaded)) await syncNow();
      setStatus({ mode: "cloud", pending: false, error: "", needsSetup: false });
    } else {
      if (mustRefreshAfterRestore) throw restoreRefreshError(false);
      persistLocal();
      setStatus({ mode: "cloud", pending: false, error: "", needsSetup: true });
    }
  } catch (error) {
    if (restoreRefreshRequired) {
      setStatus({
        mode: "cloud",
        pending: false,
        error: "云端恢复结果尚未重新载入，请关闭后重新进入小程序",
      });
    } else {
      setStatus({ mode: "local", pending: false, error: "云端暂不可用，内容已保存在本机" });
    }
  }
}

function init(options) {
  if (options && options.config) runtimeConfig = options.config;
  if (initializing) return initializing;
  initializing = Promise.resolve().then(async function () {
    if (!data) applyLocalSnapshot(loadLocal() || createSeedData());
    persistLocal();
    emit();
    if (cloudReady()) await initializeCloud();
    return getData();
  }).finally(function () { initializing = null; });
  return initializing;
}

function getData() {
  if (!data) applyLocalSnapshot(loadLocal() || createSeedData());
  return clone(data);
}
function subscribe(fn) {
  if (typeof fn !== "function") return function () {};
  listeners.push(fn);
  return function () { listeners = listeners.filter(function (item) { return item !== fn; }); };
}
function markChanged(next, previous) {
  ensureRestoreRefreshComplete();
  const now = new Date().toISOString();
  const prior = previous && typeof previous === "object" ? previous : {};
  const sections = Object.assign({}, prior._updatedSections || {}, next._updatedSections || {});
  Object.keys(Object.assign({}, prior, next)).forEach(function (key) {
    if (key === "updatedAt" || key === "_updatedSections" || key === "_deletedRecords") return;
    if (JSON.stringify(prior[key]) !== JSON.stringify(next[key])) sections[key] = now;
  });
  next._updatedSections = sections;
  next.updatedAt = now;
  const previousDirty = dirty;
  const previousOutbox = outbox;
  const nextOutbox = outbox.concat(operationsForChange(prior, next));
  try {
    persistLocal(next, { dirty: true, outbox: nextOutbox });
  } catch (error) {
    // setStorageSync is not transactional across the data and context keys.
    // Best-effort rollback also repairs a partial first-key write when possible.
    try { persistLocal(prior, { dirty: previousDirty, outbox: previousOutbox }); } catch (rollbackError) { /* Preserve the original write error. */ }
    throw error;
  }
  data = next;
  outbox = nextOutbox;
  dirty = true;
  changeGeneration += 1;
  emit();
  if (syncStatus.mode === "cloud") {
    setStatus({ pending: true, error: "" });
    // Writes remain usable without a network; syncNow can be retried from the UI.
    Promise.resolve().then(syncNow).catch(function () {});
  }
  return getData();
}
async function mutate(mutator) {
  const previous = getData();
  const next = clone(previous);
  const returned = typeof mutator === "function" ? mutator(next) : next;
  return markChanged(returned && typeof returned === "object" ? returned : next, previous);
}

async function pruneExpiredRecoveryData(options) {
  const planned = planRetention(getData(), options && options.now);
  if (!planned.changed) return clone(planned);
  const persisted = await mutate(function () { return clone(planned.data); });
  return {
    changed: true,
    data: persisted,
    removedTrashEntries: clone(planned.removedTrashEntries),
    removedHistoryEntries: clone(planned.removedHistoryEntries),
  };
}
async function upsert(collection, item, options) {
  if (COLLECTIONS.indexOf(collection) === -1) throw new Error("不支持的数据集合：" + collection);
  const changedAt = isoNow(options);
  return mutate(function (next) {
    const record = Object.assign({}, item || {}, { _updatedAt: changedAt });
    if (!record.id) record.id = makeId(collection.slice(0, -1) || "record");
    next._deletedRecords = (next._deletedRecords || []).filter(function (deleted) {
      return deleted.collection !== collection || deleted.id !== record.id;
    });
    const records = Array.isArray(next[collection]) ? next[collection] : [];
    const index = records.findIndex(function (current) { return current.id === record.id; });
    const before = index === -1 ? null : clone(records[index]);
    if (index === -1) records.push(record);
    else records[index] = Object.assign({}, records[index], record);
    next[collection] = records;
    if (!INTERNAL_COLLECTIONS.has(collection)) {
      appendHistory(next, {
        collection: collection,
        recordId: record.id,
        action: before ? "update" : "create",
        changedAt: changedAt,
        changedBy: options && options.actorId,
        before: before,
        after: record,
      });
    }
    return next;
  });
}
async function remove(collection, id, options) {
  if (COLLECTIONS.indexOf(collection) === -1) throw new Error("不支持的数据集合：" + collection);
  if (INTERNAL_COLLECTIONS.has(collection)) throw new Error("不能直接删除内部记录");
  const changedAt = isoNow(options);
  const trashId = options && options.trashId || makeId("trash");
  const snapshot = await mutate(function (next) {
    const existing = (next[collection] || []).find(function (record) { return record.id === id; });
    if (!existing) throw new Error("要删除的记录不存在");
    next[collection] = (next[collection] || []).filter(function (record) { return record.id !== id; });
    const trashEntries = Array.isArray(next.trashEntries) ? next.trashEntries : [];
    trashEntries.push({
      id: trashId,
      collection: collection,
      recordId: id,
      record: clone(existing),
      deletedAt: changedAt,
      deletedBy: options && options.actorId || "local-member",
      expiresAt: expiresAt(changedAt, TRASH_RETENTION_DAYS),
      _updatedAt: changedAt,
    });
    next.trashEntries = trashEntries;
    const tombstones = (next._deletedRecords || []).filter(function (deleted) {
      return deleted.collection !== collection || deleted.id !== id;
    });
    tombstones.push({ collection: collection, id: id, deletedAt: changedAt, reason: "user-delete" });
    next._deletedRecords = tombstones;
    appendHistory(next, {
      collection: collection,
      recordId: id,
      action: "delete",
      changedAt: changedAt,
      changedBy: options && options.actorId,
      before: existing,
      after: null,
    });
    return next;
  });
  return { trashId: trashId, data: snapshot };
}
async function restoreFromTrash(trashId, options) {
  if (!trashId) throw new Error("请选择要恢复的记录");
  const changedAt = isoNow(options);
  return mutate(function (next) {
    const trashEntries = Array.isArray(next.trashEntries) ? next.trashEntries : [];
    const entry = trashEntries.find(function (item) { return item.id === trashId; });
    if (!entry) throw new Error("回收站中没有这条记录");
    if (timeValue(entry.expiresAt) <= timeValue(changedAt)) throw new Error("这条记录已超过 30 天恢复期");
    if (COLLECTIONS.indexOf(entry.collection) === -1 || INTERNAL_COLLECTIONS.has(entry.collection)) {
      throw new Error("这条记录的类型无法恢复");
    }
    const records = Array.isArray(next[entry.collection]) ? next[entry.collection] : [];
    if (records.some(function (record) { return record.id === entry.recordId; })) {
      throw new Error("当前列表已存在同一条记录，未覆盖现有内容");
    }
    const restored = Object.assign({}, clone(entry.record), { _updatedAt: changedAt });
    records.push(restored);
    next[entry.collection] = records;
    next.trashEntries = trashEntries.filter(function (item) { return item.id !== trashId; });
    next._deletedRecords = (next._deletedRecords || []).filter(function (deleted) {
      return deleted.collection !== entry.collection || deleted.id !== entry.recordId;
    });
    appendHistory(next, {
      collection: entry.collection,
      recordId: entry.recordId,
      action: "restore",
      changedAt: changedAt,
      changedBy: options && options.actorId,
      before: null,
      after: restored,
    });
    return next;
  });
}

async function syncPartitionOutbox() {
  while (true) {
    while (outbox.length) {
      const batch = clone(outbox.slice(0, MAX_SYNC_BATCH));
      const result = await callFamilyApi("syncPartitions", {
        familyId: familyId,
        manifestRevision: manifestRevision,
        operations: batch,
      });
      if (!result || result.synced !== true || !Array.isArray(result.results)) {
        throw invalidFamilyApiResponse("syncPartitions");
      }
      const requestedIds = new Set(batch.map(function (operation) { return operation.operationId; }));
      const acknowledgedIds = new Set();
      result.results.forEach(function (item) {
        if (!item || !requestedIds.has(item.operationId)
          || !Number.isInteger(item.partitionRevision) || item.partitionRevision < 1
          || !Number.isInteger(item.manifestRevision) || item.manifestRevision < 1) {
          throw invalidFamilyApiResponse("syncPartitions");
        }
        acknowledgedIds.add(item.operationId);
        if (Array.isArray(item.conflicts) && item.conflicts.length) {
          syncConflicts = sanitizeConflicts(syncConflicts.concat(item.conflicts.map(function (conflict) {
            return Object.assign({
              operationId: item.operationId,
              partitionKey: item.partitionKey,
            }, clone(conflict));
          })));
        }
      });
      if (acknowledgedIds.size !== requestedIds.size) throw invalidFamilyApiResponse("syncPartitions");
      outbox = outbox.filter(function (operation) { return !acknowledgedIds.has(operation.operationId); });
      manifestRevision = Number.isInteger(result.manifestRevision)
        ? result.manifestRevision
        : Math.max.apply(null, result.results.map(function (item) { return item.manifestRevision; }));
      if (result.partitionRevisions && typeof result.partitionRevisions === "object" && !Array.isArray(result.partitionRevisions)) {
        partitionRevisions = sanitizePartitionRevisions(result.partitionRevisions);
      } else {
        result.results.forEach(function (item) { partitionRevisions[item.partitionKey] = item.partitionRevision; });
      }
      dirty = outbox.length > 0;
      persistLocal();
    }
    // Pull family edits made on other devices. If a local write appears while
    // this request is pending, loadPartitionedFamily merges it and the outer
    // loop immediately uploads its durable outbox operations.
    try { await loadPartitionedFamily({ mergeLocal: false }); } catch (error) { /* best effort refresh */ }
    dirty = outbox.length > 0;
    persistLocal();
    if (!outbox.length) break;
  }
}

async function syncNow() {
  ensureRestoreRefreshComplete();
  if (syncStatus.mode !== "cloud" || !cloudReady()) {
    return { ok: false, synced: false, reason: "cloud-unavailable" };
  }
  if (syncPromise) return syncPromise;
  syncPromise = (async function () {
    setStatus({ pending: true, error: "" });
    try {
      if (partitionMode) {
        await syncPartitionOutbox();
        setStatus({ pending: false, error: "", needsSetup: false });
        return { ok: true, synced: true, reason: "synced" };
      }
      while (true) {
        const targetGeneration = changeGeneration;
        const localSnapshot = getData();
        try {
          const result = await callFamilyApi("save", { familyId: familyId, expectedVersion: revision, data: localSnapshot });
          acceptFamily(result);
          revision = Number(result.version || revision || 0);
          if (targetGeneration === changeGeneration) dirty = false;
          persistLocal();
        } catch (error) {
          if (error && error.code === "VERSION_CONFLICT") {
            const latest = await callFamilyApi("load", { familyId: familyId });
            acceptFamily(latest);
            const snapshot = latest && latest.snapshot;
            if (!snapshot || !snapshot.data || typeof snapshot.data !== "object") throw error;
            revision = Number(snapshot.version || 0);
            // A user may keep editing while both network requests are pending.
            // Always merge the latest in-memory state, never the stale snapshot
            // captured before the await chain.
            data = mergeSnapshotData(snapshot.data, getData());
            data.updatedAt = new Date().toISOString();
            dirty = true;
            changeGeneration += 1;
            persistLocal();
            emit();
            continue;
          }
          throw error;
        }
        if (targetGeneration === changeGeneration) break;
      }
      setStatus({ pending: false, error: "", needsSetup: false });
      return { ok: true, synced: true, reason: "synced" };
    } catch (error) {
      setStatus({ pending: false, error: "同步失败，内容仍保存在本机" });
      throw error;
    } finally { syncPromise = null; }
  })();
  return syncPromise;
}
function getSyncStatus() {
  return Object.assign({}, syncStatus, {
    familyId: familyId,
    family: familyInfo ? clone(familyInfo) : null,
    openId: openId,
    capacity: capacity ? clone(capacity) : null,
    revision: revision,
    restoreRefreshRequired: restoreRefreshRequired,
    outboxCount: outbox.length,
    partitionMode: partitionMode,
    manifestRevision: manifestRevision,
    partitionRevisions: clone(partitionRevisions),
    conflicts: clone(syncConflicts),
  });
}

function requireCloudFamily() {
  if (!cloudReady() || syncStatus.mode !== "cloud") throw new Error("家庭云端暂不可用，请稍后重试");
  if (!familyId) throw new Error("请先创建或加入家庭");
}

async function createBackup() {
  requireCloudFamily();
  ensureRestoreRefreshComplete();
  if (dirty || outbox.length) {
    const synced = await syncNow();
    if (!synced || !synced.synced) throw new Error("当前数据尚未上传，未创建备份");
  }
  const result = await callFamilyApi("createBackup", { familyId: familyId });
  const backup = result && result.backup;
  const validBackup = backup && typeof backup === "object"
    && typeof backup.backupId === "string" && backup.backupId.length > 0
    && Number.isInteger(backup.version) && backup.version >= 0;
  if (!validBackup) throw invalidFamilyApiResponse("createBackup");
  acceptFamily(result);
  persistLocal();
  return { backup: clone(backup) };
}

async function listBackups(limit) {
  requireCloudFamily();
  const result = await callFamilyApi("listBackups", {
    familyId: familyId,
    limit: Math.max(1, Math.min(Number(limit) || 10, 30)),
  });
  const validBackups = Array.isArray(result.backups) && result.backups.every(function (item) {
    return item && typeof item === "object"
      && typeof item.backupId === "string" && item.backupId.length > 0
      && Number.isInteger(item.version) && item.version >= 0;
  });
  if (!validBackups || !Number.isInteger(result.retentionLimit) || result.retentionLimit < 1) {
    throw invalidFamilyApiResponse("listBackups");
  }
  acceptFamily(result);
  persistLocal();
  return {
    backups: clone(result.backups),
    retentionLimit: result.retentionLimit,
  };
}

async function exportFamily() {
  requireCloudFamily();
  ensureRestoreRefreshComplete();
  if (dirty || outbox.length) {
    try {
      const synced = await syncNow();
      if (!synced || !synced.synced) throw new Error("当前数据尚未上传");
    } catch (error) {
      const exportError = new Error("当前数据同步失败，未导出；请检查网络后重试");
      exportError.code = "EXPORT_SYNC_FAILED";
      exportError.cause = error;
      throw exportError;
    }
  }
  const result = await callFamilyApi("exportFamily", { familyId: familyId });
  const exported = result.export;
  const snapshot = exported && exported.snapshot;
  const validExport = exported && typeof exported === "object"
    && exported.format === "baby-care-family-export-v1"
    && snapshot && typeof snapshot === "object"
    && snapshot.data && typeof snapshot.data === "object" && !Array.isArray(snapshot.data)
    && Number.isInteger(snapshot.version) && snapshot.version >= 0;
  if (!validExport) throw invalidFamilyApiResponse("exportFamily");
  acceptFamily(result);
  persistLocal();
  emit();
  return clone(result.export);
}

async function restoreBackup(backupId) {
  requireCloudFamily();
  ensureRestoreRefreshComplete();
  if (!backupId) throw new Error("请选择要恢复的备份");
  setStatus({ pending: true, error: "" });
  let restoreCommitted = false;
  try {
    if (dirty || outbox.length) {
      const synced = await syncNow();
      if (!synced || !synced.synced) throw new Error("当前数据尚未上传，未执行恢复");
    }
    restoreRefreshRequired = true;
    try {
      persistLocal();
    } catch (error) {
      restoreRefreshRequired = false;
      throw error;
    }
    const result = await callFamilyApi("restoreBackup", {
      familyId: familyId,
      expectedVersion: partitionMode ? manifestRevision : revision,
      backupId: String(backupId),
    });
    const validRestore = result.restored === true
      && Number.isInteger(result.version) && result.version >= 0
      && Number.isInteger(result.restoredFromVersion) && result.restoredFromVersion >= 0;
    if (!validRestore) throw invalidFamilyApiResponse("restoreBackup");
    restoreCommitted = true;
    acceptFamily(result);
    let migrationSyncWarning = "";
    if (result.partitioned === true || partitionMode) {
      partitionMode = true;
      manifestRevision = result.version;
      outbox = [];
      dirty = false;
      persistLocal();
      const loadedPartitions = await loadPartitionedFamily({ mergeLocal: false });
      if (!loadedPartitions.loaded || loadedPartitions.manifestRevision < result.version) {
        throw restoreRefreshError(true);
      }
    } else {
      revision = result.version;
      dirty = false;
      persistLocal();
      const loaded = await loadRemoteFamily({ replaceLocal: true, minimumVersion: result.version });
      if (!loaded.loaded) throw restoreRefreshError(true);
      restoreRefreshRequired = false;
      persistLocal();
      if (loaded.changed) {
        try {
          await syncNow();
        } catch (error) {
          migrationSyncWarning = "家庭数据已恢复；格式升级将在网络恢复后自动同步";
        }
      }
    }
    restoreRefreshRequired = false;
    persistLocal();
    setStatus({ pending: false, error: migrationSyncWarning, needsSetup: false });
    return {
      ok: true,
      restored: true,
      restoredFromVersion: Number(result.restoredFromVersion || 0),
      version: result.version,
    };
  } catch (error) {
    if (restoreRefreshRequired && error && error.definitiveFailure) {
      restoreRefreshRequired = false;
      try {
        persistLocal();
      } catch (persistError) {
        // If the durable unlock cannot be written, stay locked in memory too.
        // A restart can then safely force a fresh cloud read before any edit.
        restoreRefreshRequired = true;
      }
    }
    if (restoreRefreshRequired) {
      const refreshError = restoreRefreshError(restoreCommitted || Boolean(error && error.restoreCommitted));
      setStatus({
        pending: false,
        error: refreshError.restoreCommitted
          ? "云端备份已恢复，本机数据尚未重新载入；请关闭后重新进入小程序"
          : "恢复结果尚未确认；请关闭后重新进入小程序完成重新载入",
      });
      throw refreshError;
    }
    setStatus({ pending: false, error: "备份恢复失败，当前内容未变更" });
    throw error;
  }
}

function identityPayload(options) {
  const source = options && typeof options === "object" && !Array.isArray(options) ? options : {};
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(source, "nickname")) payload.nickname = String(source.nickname || "").trim();
  if (Object.prototype.hasOwnProperty.call(source, "relation")) payload.relation = String(source.relation || "").trim();
  return payload;
}

async function createFamily(options) {
  if (!cloudReady()) throw new Error("请先在 config.local.js 填入云开发环境 ID");
  setStatus({ mode: "cloud", pending: true, error: "" });
  try {
    const hadLocalChanges = dirty;
    const result = await callFamilyApi("createFamily", identityPayload(options));
    acceptFamily(result);
    revision = 0;
    await connectCurrentFamily(hadLocalChanges);
    setStatus({ mode: "cloud", pending: false, error: "", needsSetup: false });
    return getSyncStatus();
  } catch (error) {
    setStatus({ mode: "local", pending: false, error: "家庭连接失败，内容仍保存在本机" });
    throw error;
  }
}

// 页面只在“家人加入”这一个场景使用额外接口；其余日常增删改只使用固定 store 接口。
async function joinFamily(inviteCode, options) {
  if (!cloudReady()) throw new Error("请先在 config.local.js 填入云开发环境 ID");
  setStatus({ mode: "cloud", pending: true, error: "" });
  try {
    const hadLocalChanges = dirty;
    const result = await callFamilyApi("join", Object.assign(
      { inviteCode: String(inviteCode || "").trim() },
      identityPayload(options),
    ));
    acceptFamily(result);
    revision = 0;
    // A fresh install only contains fixed profile/reference data, so the family
    // snapshot becomes the source of truth. Real offline edits are merged.
    await connectCurrentFamily(hadLocalChanges);
    setStatus({ mode: "cloud", pending: false, error: "", needsSetup: false });
    return getData();
  } catch (error) {
    setStatus({ mode: "local", pending: false, error: "加入家庭失败，内容仍保存在本机" });
    throw error;
  }
}

async function updateFamilyMember(memberId, changes) {
  requireCloudFamily();
  const source = changes && typeof changes === "object" && !Array.isArray(changes) ? changes : {};
  const payload = { familyId: familyId, memberId: String(memberId || "") };
  ["nickname", "relation", "status"].forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(source, key)) payload[key] = source[key];
  });
  const result = await callFamilyApi("updateMember", payload);
  acceptFamily(result);
  persistLocal();
  emit();
  return getSyncStatus();
}

async function setBackupAdmin(memberId) {
  requireCloudFamily();
  const result = await callFamilyApi("setBackupAdmin", {
    familyId: familyId,
    memberId: memberId === null ? null : String(memberId || ""),
  });
  acceptFamily(result);
  persistLocal();
  emit();
  return getSyncStatus();
}

async function getProtectedMediaReferences() {
  requireCloudFamily();
  const result = await callFamilyApi("getProtectedMediaReferences", { familyId: familyId });
  if (!Array.isArray(result.references) || result.references.some(function (ref) {
    return typeof ref !== "string" || !/^cloud:\/\//.test(ref);
  })) {
    throw invalidFamilyApiResponse("getProtectedMediaReferences");
  }
  return Array.from(new Set(result.references));
}

module.exports = {
  init, getData, subscribe, mutate, upsert, remove, restoreFromTrash, syncNow, getSyncStatus, createFamily, joinFamily,
  updateFamilyMember, setBackupAdmin,
  getProtectedMediaReferences,
  createBackup, listBackups, exportFamily, restoreBackup, pruneExpiredRecoveryData,
  __test: { prepareSnapshot, mergeSnapshotData, resolveFamilySnapshot },
};
