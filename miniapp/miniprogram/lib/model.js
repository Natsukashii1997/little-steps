"use strict";

const { BABY, VACCINE_SCHEDULE } = require("./constants");

const CURRENT_SCHEMA_VERSION = 4;
const RETIRED_FEATURE_KEYS = ["musicTracks", "stories", "learningItems", "studySeedVersion"];
const RETIRED_COLLECTIONS = new Set(RETIRED_FEATURE_KEYS.slice(0, 3));

function pad(value) { return String(value).padStart(2, "0"); }
function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
function dateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return dateKey(date) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}
function addMonths(dateString, months) {
  const parts = dateString.split("-").map(Number);
  return dateKey(new Date(parts[0], parts[1] - 1 + months, parts[2], 12));
}
function makeId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
function createVaccineScheduleSeed() {
  return VACCINE_SCHEDULE.map(function (definition, scheduleOrder) {
    return {
      id: "vaccine-schedule-" + definition.key,
      scheduleKey: definition.key,
      scheduleOrder: scheduleOrder,
      ageLabel: definition.ageLabel,
      name: definition.name,
      dose: definition.dose,
      dueDate: addMonths(BABY.birthDate, definition.ageMonths),
      completedDate: "",
      protects: "按当地接种门诊安排",
      note: definition.note,
      choiceGroup: definition.choiceGroup,
    };
  });
}

const LEGACY_STATIC_DEMO_RECORDS = {
  todos: [
    { id: "demo-todo-vitamin-d", title: "Vitamin D check-in", completed: false },
    { id: "demo-todo-bath", title: "Bath time", completed: false },
    { id: "demo-todo-photo", title: "Upload today's photo", completed: false },
  ],
  memories: [
    { id: "demo-memory-hug", type: "photo", title: "午睡前的温暖抱抱", date: "2026-08-06", description: "午睡前的温暖抱抱。", assetId: "" },
    { id: "demo-memory-smile", type: "moment", title: "第一次微笑", date: "2026-08-07", description: "你第一次对我笑了。", assetId: "" },
    { id: "demo-memory-head-lift", type: "moment", title: "第一次抬头", date: "2026-08-05", description: "俯卧时短暂抬起了小脑袋。", sourceAbilityId: "demo-ability-head-lift" },
  ],
  abilities: [
    { id: "demo-ability-head-lift", date: "2026-08-05", name: "短暂抬头", description: "俯卧时能短暂抬起小脑袋。", imageId: "" },
    { id: "demo-ability-face-focus", date: "2026-08-06", name: "注视人脸", description: "能短暂注视爸爸妈妈的脸。", imageId: "" },
    { id: "demo-ability-limb-movement", date: "2026-08-08", name: "四肢活动", description: "清醒时会有力地挥动手脚。", imageId: "" },
  ],
  checkups: [
    { id: "demo-checkup-newborn", date: "2026-08-08", name: "新生儿访视", tips: "观察喂养、睡眠和黄疸变化。", completedDate: "2026-08-08" },
    { id: "demo-checkup-one-month", date: "2026-09-04", name: "满月儿保", tips: "记录体重、身长与头围变化。", completedDate: "" },
    { id: "demo-checkup-four-month", date: "2026-12-04", name: "4月龄儿保", tips: "多练习俯趴，并关注追视和抬头。", completedDate: "" },
  ],
};

const LEGACY_DYNAMIC_DEMO_RECORDS = {
  feedings: [
    { seedOffset: -135, timeField: "time", record: { id: "demo-feeding-recent", amount: 180, milkType: "混合喂养", note: "状态很好" } },
    { seedOffset: -360, timeField: "time", record: { id: "demo-feeding-mid", amount: 150, milkType: "母乳", note: "" } },
    { seedOffset: -690, timeField: "time", record: { id: "demo-feeding-early", amount: 170, milkType: "配方奶", note: "" } },
  ],
  sleeps: [
    { seedOffsets: { start: -205, end: -110 }, record: { id: "demo-sleep-nap", note: "午睡" } },
    { seedOffsets: { start: -890, end: -540 }, record: { id: "demo-sleep-night", note: "夜间睡眠" } },
  ],
  diapers: [
    { seedOffset: -160, timeField: "time", record: { id: "demo-poop-recent", status: "正常软便", note: "黄色软便" } },
    { seedOffset: -480, timeField: "time", record: { id: "demo-poop-early", status: "偏稀", note: "" } },
  ],
};

const LEGACY_SUPPLEMENT = { id: "demo-supplement-vitamin-d", name: "维生素 D", completed: true };

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sameRecord(actual, expected) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.length !== expectedKeys.length) return false;
  return actualKeys.every(function (key, index) {
    return key === expectedKeys[index] && JSON.stringify(actual[key]) === JSON.stringify(expected[key]);
  });
}
function hasUserMedia(record) {
  return ["assetId", "imageId", "coverId", "mediaId", "fileId", "cloudFileId"].some(function (key) {
    return Boolean(record && record[key]);
  });
}
function legacyCandidateSeedMinute(record, definition) {
  if (!record || record._updatedAt || hasUserMedia(record)) return null;
  const offsets = definition.seedOffsets || (definition.timeField ? { [definition.timeField]: definition.seedOffset } : {});
  const timeFields = Object.keys(offsets);
  const expectedKeys = Object.keys(definition.record).concat(timeFields).sort();
  if (Object.keys(record).sort().join("|") !== expectedKeys.join("|")) return null;
  if (!Object.keys(definition.record).every(function (key) {
    return JSON.stringify(record[key]) === JSON.stringify(definition.record[key]);
  })) return null;
  const candidates = timeFields.map(function (field) {
    const time = new Date(record[field]).getTime();
    return Number.isFinite(time) ? time - offsets[field] * 60000 : NaN;
  });
  if (!candidates.length || candidates.some(function (value) { return !Number.isFinite(value); })) return null;
  const minute = Math.floor(candidates[0] / 60000) * 60000;
  return candidates.every(function (value) { return Math.floor(value / 60000) * 60000 === minute; }) ? minute : null;
}
function findLegacySeedMinute(snapshot) {
  const counts = new Map();
  Object.keys(LEGACY_DYNAMIC_DEMO_RECORDS).forEach(function (collection) {
    const records = Array.isArray(snapshot[collection]) ? snapshot[collection] : [];
    LEGACY_DYNAMIC_DEMO_RECORDS[collection].forEach(function (definition) {
      const record = records.find(function (item) { return item && item.id === definition.record.id; });
      const candidate = legacyCandidateSeedMinute(record, definition);
      if (candidate !== null) counts.set(candidate, (counts.get(candidate) || 0) + 1);
    });
  });
  let best = null;
  let bestCount = 0;
  let tied = false;
  counts.forEach(function (count, candidate) {
    if (count > bestCount) { best = candidate; bestCount = count; tied = false; }
    else if (count === bestCount) tied = true;
  });
  if (bestCount >= 2 && !tied) return best;
  const updatedAt = new Date(snapshot.updatedAt || "").getTime();
  if (!Number.isFinite(updatedAt)) return null;
  const updatedMinute = Math.floor(updatedAt / 60000) * 60000;
  return counts.has(updatedMinute) ? updatedMinute : null;
}
function fullDynamicRecord(definition, seedMinute) {
  const offsets = definition.seedOffsets || { [definition.timeField]: definition.seedOffset };
  const record = Object.assign({}, definition.record);
  Object.keys(offsets).forEach(function (field) {
    record[field] = dateTime(new Date(seedMinute + offsets[field] * 60000));
  });
  return record;
}
function timeValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}
function recordUpdatedAt(record) {
  return timeValue(record && (record._updatedAt || record.updatedAt || record.createdAt));
}
function mergeLegacyPoops(currentPoops, legacyDiapers) {
  const merged = [];
  const indexById = new Map();
  const idlessRecords = new Set();

  function collect(record) {
    if (!record || typeof record !== "object" || Array.isArray(record)) return;
    if (!record.id) {
      const signature = JSON.stringify(record);
      if (!idlessRecords.has(signature)) {
        idlessRecords.add(signature);
        merged.push(record);
      }
      return;
    }
    if (!indexById.has(record.id)) {
      indexById.set(record.id, merged.length);
      merged.push(record);
      return;
    }
    const index = indexById.get(record.id);
    if (recordUpdatedAt(record) > recordUpdatedAt(merged[index])) merged[index] = record;
  }

  (Array.isArray(currentPoops) ? currentPoops : []).forEach(collect);
  (Array.isArray(legacyDiapers) ? legacyDiapers : []).forEach(collect);
  return merged;
}
function migrateCareCollections(snapshot) {
  snapshot.poops = mergeLegacyPoops(snapshot.poops, snapshot.diapers);
  snapshot.diaperChanges = Array.isArray(snapshot.diaperChanges) ? snapshot.diaperChanges : [];
  // `diapers` remains as an empty compatibility field while older snapshots
  // may still arrive. It is never a writable active business collection.
  snapshot.diapers = [];

  if (snapshot._updatedSections && typeof snapshot._updatedSections === "object" && !Array.isArray(snapshot._updatedSections)) {
    const legacyTime = snapshot._updatedSections.diapers;
    const currentTime = snapshot._updatedSections.poops;
    if (legacyTime && (!currentTime || timeValue(legacyTime) > timeValue(currentTime))) {
      snapshot._updatedSections.poops = legacyTime;
    }
  }
}
function retireRemovedFeatures(snapshot) {
  RETIRED_FEATURE_KEYS.forEach(function (key) { delete snapshot[key]; });
  if (snapshot._updatedSections && typeof snapshot._updatedSections === "object" && !Array.isArray(snapshot._updatedSections)) {
    RETIRED_FEATURE_KEYS.forEach(function (key) { delete snapshot._updatedSections[key]; });
  }
  if (Array.isArray(snapshot._deletedRecords)) {
    snapshot._deletedRecords = snapshot._deletedRecords.filter(function (item) {
      return !item || !RETIRED_COLLECTIONS.has(item.collection);
    });
  }
  if (Array.isArray(snapshot.trashEntries)) {
    snapshot.trashEntries = snapshot.trashEntries.filter(function (item) {
      return !item || !RETIRED_COLLECTIONS.has(item.collection);
    });
  }
  if (Array.isArray(snapshot.recordHistory)) {
    snapshot.recordHistory = snapshot.recordHistory.filter(function (item) {
      return !item || !RETIRED_COLLECTIONS.has(item.collection);
    });
  }
}
function migrateSnapshot(snapshot, nowValue) {
  const source = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : createSeedData(nowValue);
  const next = clone(source);
  const removed = [];
  const seedMinute = findLegacySeedMinute(source);

  // Education and Study were removed in schema v4. Keep any old cloud backup
  // untouched, but retire these fields from the active client snapshot so they
  // cannot reappear as core sync operations.
  retireRemovedFeatures(next);

  Object.keys(LEGACY_STATIC_DEMO_RECORDS).forEach(function (collection) {
    const definitions = new Map(LEGACY_STATIC_DEMO_RECORDS[collection].map(function (record) { return [record.id, record]; }));
    next[collection] = (Array.isArray(next[collection]) ? next[collection] : []).filter(function (record) {
      const expected = record && definitions.get(record.id);
      const remove = Boolean(expected && !record._updatedAt && !hasUserMedia(record) && sameRecord(record, expected));
      if (remove) removed.push({ collection: collection, id: record.id });
      return !remove;
    });
  });

  Object.keys(LEGACY_DYNAMIC_DEMO_RECORDS).forEach(function (collection) {
    const definitions = new Map(LEGACY_DYNAMIC_DEMO_RECORDS[collection].map(function (definition) { return [definition.record.id, definition]; }));
    next[collection] = (Array.isArray(next[collection]) ? next[collection] : []).filter(function (record) {
      const definition = record && definitions.get(record.id);
      const expected = definition && seedMinute !== null ? fullDynamicRecord(definition, seedMinute) : null;
      const remove = Boolean(expected && !record._updatedAt && !hasUserMedia(record) && sameRecord(record, expected));
      if (remove) removed.push({ collection: collection, id: record.id });
      return !remove;
    });
  });

  next.supplements = (Array.isArray(next.supplements) ? next.supplements : []).filter(function (record) {
    const expected = seedMinute === null ? null : Object.assign({}, LEGACY_SUPPLEMENT, { date: dateKey(new Date(seedMinute)) });
    const remove = Boolean(expected && record && record.id === expected.id && !record._updatedAt && !hasUserMedia(record) && sameRecord(record, expected));
    if (remove) removed.push({ collection: "supplements", id: record.id });
    return !remove;
  });

  // In schemas v1-v2 `diapers` actually contained bowel-movement records.
  // Remove known demo rows first, then migrate every surviving family record
  // into the canonical Poop collection. Running this normalization for all
  // versions also makes partially migrated/cross-version snapshots safe.
  migrateCareCollections(next);

  const deletedAt = new Date(nowValue || Date.now()).toISOString();
  const tombstones = new Map();
  (Array.isArray(next._deletedRecords) ? next._deletedRecords : []).forEach(function (item) {
    if (!item || !item.collection || !item.id) return;
    tombstones.set(item.collection + ":" + item.id, clone(item));
    // A pre-v3 user deletion targeted the legacy name. Keep that marker for
    // old clients and mirror it to `poops`, otherwise another device could
    // migrate its stale copy and resurrect the deleted bowel movement.
    if (item.collection === "diapers" && item.reason !== "legacy-demo-v1") {
      const migratedItem = Object.assign({}, clone(item), { collection: "poops" });
      const migratedKey = "poops:" + item.id;
      const current = tombstones.get(migratedKey);
      if (!current || timeValue(migratedItem.deletedAt) >= timeValue(current.deletedAt)) {
        tombstones.set(migratedKey, migratedItem);
      }
    }
  });
  removed.forEach(function (item) {
    const key = item.collection + ":" + item.id;
    if (!tombstones.has(key)) {
      tombstones.set(key, { collection: item.collection, id: item.id, deletedAt: deletedAt, reason: "legacy-demo-v1" });
    }
  });
  if (removed.length || next._deletedRecords) next._deletedRecords = Array.from(tombstones.values());
  next.schemaVersion = CURRENT_SCHEMA_VERSION;
  const changed = JSON.stringify(next) !== JSON.stringify(source);
  return { data: next, changed: changed, removed: removed };
}

function createSeedData(nowValue) {
  const now = nowValue ? new Date(nowValue) : new Date();
  const data = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    baby: Object.assign({}, BABY),
    feedings: [],
    sleeps: [],
    diapers: [],
    diaperChanges: [],
    poops: [],
    supplements: [],
    todos: [],
    memories: [],
    growthRecords: [
      { id: "birth-growth", date: BABY.birthDate, height: BABY.birthHeight, weight: BABY.birthWeight, note: "出生记录" },
    ],
    vaccines: createVaccineScheduleSeed(),
    abilities: [],
    checkups: [],
  };
  return data;
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  createSeedData,
  createVaccineScheduleSeed,
  migrateSnapshot,
  makeId,
  dateKey,
  dateTime,
  addMonths,
};
