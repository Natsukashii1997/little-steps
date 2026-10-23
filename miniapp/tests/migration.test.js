"use strict";

const assert = require("node:assert/strict");
const { createSeedData, migrateSnapshot, CURRENT_SCHEMA_VERSION } = require("../miniprogram/lib/model");

function legacySnapshot() {
  const snapshot = createSeedData("2026-08-10T12:00:00+08:00");
  snapshot.schemaVersion = 1;
  snapshot.updatedAt = "2026-08-10T12:00:00+08:00";
  snapshot.feedings = [
    { id: "demo-feeding-recent", time: "2026-08-10T09:45", amount: 180, milkType: "混合喂养", note: "状态很好" },
    { id: "demo-feeding-mid", time: "2026-08-10T06:00", amount: 150, milkType: "母乳", note: "" },
    { id: "demo-feeding-early", time: "2026-08-10T00:30", amount: 170, milkType: "配方奶", note: "" },
  ];
  snapshot.sleeps = [
    { id: "demo-sleep-nap", start: "2026-08-10T08:35", end: "2026-08-10T10:10", note: "午睡" },
    { id: "demo-sleep-night", start: "2026-08-09T21:10", end: "2026-08-10T03:00", note: "夜间睡眠" },
  ];
  snapshot.diapers = [
    { id: "demo-poop-recent", time: "2026-08-10T09:20", status: "正常软便", note: "黄色软便" },
    { id: "demo-poop-early", time: "2026-08-10T04:00", status: "偏稀", note: "" },
  ];
  snapshot.supplements = [{ id: "demo-supplement-vitamin-d", name: "维生素 D", date: "2026-08-10", completed: true }];
  snapshot.todos = [
    { id: "demo-todo-vitamin-d", title: "Vitamin D check-in", completed: false },
    { id: "demo-todo-bath", title: "Bath time", completed: false },
    { id: "demo-todo-photo", title: "Upload today's photo", completed: false },
  ];
  snapshot.memories = [
    { id: "demo-memory-hug", type: "photo", title: "午睡前的温暖抱抱", date: "2026-08-06", description: "午睡前的温暖抱抱。", assetId: "" },
    { id: "demo-memory-smile", type: "moment", title: "第一次微笑", date: "2026-08-07", description: "你第一次对我笑了。", assetId: "" },
    { id: "demo-memory-head-lift", type: "moment", title: "第一次抬头", date: "2026-08-05", description: "俯卧时短暂抬起了小脑袋。", sourceAbilityId: "demo-ability-head-lift" },
  ];
  snapshot.abilities = [
    { id: "demo-ability-head-lift", date: "2026-08-05", name: "短暂抬头", description: "俯卧时能短暂抬起小脑袋。", imageId: "" },
    { id: "demo-ability-face-focus", date: "2026-08-06", name: "注视人脸", description: "能短暂注视爸爸妈妈的脸。", imageId: "" },
    { id: "demo-ability-limb-movement", date: "2026-08-08", name: "四肢活动", description: "清醒时会有力地挥动手脚。", imageId: "" },
  ];
  snapshot.checkups = [
    { id: "demo-checkup-newborn", date: "2026-08-08", name: "新生儿访视", tips: "观察喂养、睡眠和黄疸变化。", completedDate: "2026-08-08" },
    { id: "demo-checkup-one-month", date: "2026-09-04", name: "满月儿保", tips: "记录体重、身长与头围变化。", completedDate: "" },
    { id: "demo-checkup-four-month", date: "2026-12-04", name: "4月龄儿保", tips: "多练习俯趴，并关注追视和抬头。", completedDate: "" },
  ];
  snapshot.musicTracks = [
    { id: "demo-music-lullaby", name: "摇篮曲", artist: "睡前旋律", description: "柔和音乐，陪宝宝安心入睡。", durationSeconds: 222, assetId: "" },
    { id: "demo-music-white-noise", name: "白噪音", artist: "轻柔环境声", description: "帮助宝宝深度休息。", durationSeconds: 1800, assetId: "" },
    { id: "demo-music-nursery-rhyme", name: "英文童谣", artist: "亲子跟唱合集", description: "一起唱、一起动、一起学。", durationSeconds: 738, assetId: "" },
  ];
  snapshot.stories = [
    { id: "demo-story-caterpillar", name: "好饿的毛毛虫", link: "https://en.wikipedia.org/wiki/The_Very_Hungry_Caterpillar", coverId: "" },
    { id: "demo-story-goodnight-moon", name: "晚安，月亮", link: "https://en.wikipedia.org/wiki/Goodnight_Moon", coverId: "" },
  ];
  snapshot.learningItems = [
    { id: "learn-english-apple", language: "english", word: "Apple", translation: "苹果", imageId: "/assets/study/apple.webp" },
  ];
  snapshot.studySeedVersion = 1;
  snapshot.vaccines.find(function (item) { return item.scheduleKey === "birth-bcg-1"; }).completedDate = "2026-08-04";
  snapshot.vaccines.find(function (item) { return item.scheduleKey === "birth-hepb-1"; }).completedDate = "2026-08-04";
  return snapshot;
}

{
  const legacy = legacySnapshot();
  const migrated = migrateSnapshot(legacy, "2026-08-24T12:00:00+08:00");
  assert.equal(migrated.changed, true, "v1 旧快照应执行一次迁移");
  assert.equal(migrated.data.schemaVersion, CURRENT_SCHEMA_VERSION);
  [
    "feedings", "sleeps", "diapers", "diaperChanges", "poops", "supplements", "todos", "memories",
    "abilities", "checkups",
  ].forEach(function (collection) {
    assert.deepEqual(migrated.data[collection], [], collection + " 的旧演示记录应被清理");
  });
  ["musicTracks", "stories", "learningItems", "studySeedVersion"].forEach(function (field) {
    assert.equal(Object.prototype.hasOwnProperty.call(migrated.data, field), false, field + " 已下线，旧快照迁移后必须彻底移除");
  });
  assert.equal(migrated.data._deletedRecords.length, 20, "仍在使用的业务集合中，每条安全清理的旧记录都应留删除标记");
  assert.deepEqual(migrated.data.growthRecords, legacy.growthRecords, "固定出生记录必须保留");
  assert.equal(migrated.data.vaccines.find(function (item) { return item.scheduleKey === "birth-bcg-1"; }).completedDate, "2026-08-04");
  assert.equal(migrated.data.vaccines.find(function (item) { return item.scheduleKey === "birth-hepb-1"; }).completedDate, "2026-08-04");
}

{
  const legacy = createSeedData("2026-08-12T12:00:00+08:00");
  legacy.schemaVersion = 2;
  delete legacy.diaperChanges;
  delete legacy.poops;
  const legacyPoops = [
    {
      id: "family-poop-1",
      time: "2026-08-12T08:20",
      status: "正常软便",
      note: "黄色软便",
      createdBy: "member-mum",
      createdAt: "2026-08-12T08:21:00.000Z",
      _updatedAt: "2026-08-12T08:22:00.000Z",
      revision: 3,
      deleted: false,
    },
    {
      id: "family-poop-2",
      time: "2026-08-12T11:40",
      status: "偏稀",
      note: "",
      linkedDiaperChangeId: "family-diaper-change-1",
    },
  ];
  legacy.diapers = JSON.parse(JSON.stringify(legacyPoops));

  const migrated = migrateSnapshot(legacy, "2026-08-24T12:00:00+08:00");
  assert.equal(migrated.data.schemaVersion, 4, "旧快照应升级为 schema v4");
  assert.deepEqual(migrated.data.diapers, [], "旧 diapers 只作迁移入口，迁移后必须清空");
  assert.deepEqual(migrated.data.diaperChanges, [], "历史 diapers 语义是便便，不能误迁为换尿布");
  assert.deepEqual(migrated.data.poops, legacyPoops, "历史便便的全部业务字段必须无损保留");

  const repeated = migrateSnapshot(migrated.data, "2026-08-25T12:00:00+08:00");
  assert.equal(repeated.changed, false, "schema v4 迁移重复执行不得改写快照");
  assert.deepEqual(repeated.data.poops, legacyPoops, "重复迁移不得生成重复便便");
}

{
  const partial = createSeedData("2026-08-12T12:00:00+08:00");
  partial.schemaVersion = 2;
  const canonicalPoop = {
    id: "shared-poop-id",
    time: "2026-08-12T09:00",
    status: "正常软便",
    note: "已在新集合修改",
    _updatedAt: "2026-08-12T09:10:00.000Z",
  };
  partial.poops = [canonicalPoop, { id: "new-only-poop", time: "2026-08-12T10:00", status: "偏干", note: "" }];
  partial.diapers = [
    { id: "shared-poop-id", time: "2026-08-12T09:00", status: "正常软便", note: "旧值", _updatedAt: "2026-08-12T09:05:00.000Z" },
    { id: "legacy-only-poop", time: "2026-08-12T11:00", status: "正常软便", note: "" },
  ];
  partial.diaperChanges = [{ id: "real-diaper-change", time: "2026-08-12T10:30", status: "湿尿布" }];

  const migrated = migrateSnapshot(partial, "2026-08-24T12:00:00+08:00");
  assert.deepEqual(migrated.data.diaperChanges, partial.diaperChanges, "真实换尿布集合必须原样保留");
  assert.equal(migrated.data.poops.filter(function (item) { return item.id === "shared-poop-id"; }).length, 1, "部分迁移快照中的同 ID 便便不得重复");
  assert.deepEqual(migrated.data.poops.find(function (item) { return item.id === "shared-poop-id"; }), canonicalPoop, "同 ID 时保留更新时间较新的记录");
  assert.equal(migrated.data.poops.some(function (item) { return item.id === "legacy-only-poop"; }), true, "旧集合中未迁过的便便必须补迁");
  assert.equal(migrated.data.poops.some(function (item) { return item.id === "new-only-poop"; }), true, "新集合已有便便不得丢失");
}

{
  const legacy = createSeedData("2026-08-12T12:00:00+08:00");
  legacy.schemaVersion = 2;
  legacy._updatedSections = { diapers: "2026-08-12T11:00:00.000Z" };
  legacy._deletedRecords = [
    { collection: "diapers", id: "deleted-legacy-poop", deletedAt: "2026-08-12T10:00:00.000Z", reason: "user-delete" },
  ];
  const migrated = migrateSnapshot(legacy, "2026-08-24T12:00:00+08:00");
  assert.equal(migrated.data._updatedSections.poops, legacy._updatedSections.diapers, "旧便便集合的同步时间戳必须传给新集合");
  assert.equal(migrated.data._deletedRecords.some(function (item) {
    return item.collection === "poops" && item.id === "deleted-legacy-poop" && item.reason === "user-delete";
  }), true, "旧集合的删除标记必须同步迁移，避免跨设备复活");
  const repeated = migrateSnapshot(migrated.data, "2026-08-25T12:00:00+08:00");
  assert.equal(repeated.changed, false, "删除标记与分区时间戳迁移也必须幂等");
}

{
  const legacy = legacySnapshot();
  legacy.feedings[0]._updatedAt = "2026-08-11T08:00:00.000Z";
  legacy.todos[0].title = "家人自己的 Vitamin D 任务";
  legacy.memories[0].assetId = "cloud://family/photo.jpg";
  legacy.abilities[0].imageId = "cloud://family/ability.jpg";
  legacy.stories.push({ id: "family-story-1", name: "家人添加的故事", link: "", coverId: "" });
  const migrated = migrateSnapshot(legacy, "2026-08-24T12:00:00+08:00");
  assert.ok(migrated.data.feedings.some(function (item) { return item.id === "demo-feeding-recent"; }), "带 _updatedAt 的同名记录属于用户数据，必须保留");
  assert.ok(migrated.data.todos.some(function (item) { return item.id === "demo-todo-vitamin-d"; }), "字段被修改的同名记录必须保留");
  assert.ok(migrated.data.memories.some(function (item) { return item.id === "demo-memory-hug"; }), "带用户媒体的同名记录必须保留");
  assert.ok(migrated.data.abilities.some(function (item) { return item.id === "demo-ability-head-lift"; }), "带用户图片的同名记录必须保留");
  ["musicTracks", "stories", "learningItems", "studySeedVersion"].forEach(function (field) {
    assert.equal(Object.prototype.hasOwnProperty.call(migrated.data, field), false, field + " 属于已下线功能，用户旧值也不应残留");
  });
  assert.equal(migrated.data._deletedRecords.length, 16, "只为仍在使用的集合中确实清理的旧记录写删除标记");
}

{
  const first = migrateSnapshot(legacySnapshot(), "2026-08-24T12:00:00+08:00");
  const second = migrateSnapshot(first.data, "2026-08-25T12:00:00+08:00");
  assert.equal(second.changed, false, "迁移必须幂等，重复启动不能改写数据");
  assert.deepEqual(second.data, first.data);
  assert.deepEqual(second.removed, []);
}

{
  const legacy = legacySnapshot();
  legacy.updatedAt = "2026-08-22T18:30:00.000Z";
  legacy.memories.push({ id: "family-real-memory", title: "家人后来新增的真实记录", _updatedAt: "2026-08-22T18:30:00.000Z" });
  legacy.feedings[0].time = "2026-08-10T09:46";
  const migrated = migrateSnapshot(legacy, "2026-08-24T12:00:00+08:00");
  assert.equal(migrated.data.feedings.some(function (item) { return item.id === "demo-feeding-recent"; }), true, "动态时间字段只要不完全匹配旧种子就必须保留");
  assert.equal(migrated.data.memories.some(function (item) { return item.id === "family-real-memory"; }), true, "旧快照后来新增的真实记录必须保留");
  assert.equal(migrated.data._deletedRecords.length, 19, "快照 updatedAt 改变后仍应识别其余精确旧种子，但不得误删已变更记录");
}

console.log("Legacy data migration tests passed");

module.exports = { legacySnapshot };
