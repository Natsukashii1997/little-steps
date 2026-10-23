"use strict";

const assert = require("assert");

const mediaPath = require.resolve("../miniprogram/lib/media");

function createWxMock() {
  const storage = new Map();
  const calls = { uploads: [], cloudDeletes: [], localDeletes: [] };
  const api = {
    saveFile(options) {
      options.success({ savedFilePath: "wxfile://usr/saved-" + String(options.tempFilePath).split("/").pop() });
    },
    removeSavedFile(options) {
      calls.localDeletes.push(options.filePath);
      options.success({});
    },
    getStorageSync(key) { return storage.get(key); },
    setStorageSync(key, value) { storage.set(key, JSON.parse(JSON.stringify(value))); },
    cloud: {
      callFunction(options) {
        options.success({ result: { ok: true, openId: "test-openid" } });
      },
      uploadFile(options) {
        calls.uploads.push({ cloudPath: options.cloudPath, filePath: options.filePath });
        options.success({ fileID: "cloud://test/" + calls.uploads.length });
      },
      deleteFile(options) {
        calls.cloudDeletes.push(...options.fileList);
        options.success({ fileList: options.fileList.map((fileID) => ({ fileID, status: 0 })) });
      },
    },
  };
  return { api, calls, storage };
}

function freshMedia(wxMock) {
  delete require.cache[mediaPath];
  global.wx = wxMock;
  return require(mediaPath);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("云文件和本机文件使用对应的删除接口", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  await media.deleteMedia("cloud://test/photo-1");
  await media.deleteMedia("wxfile://usr/photo-2.jpg");
  assert.deepStrictEqual(mock.calls.cloudDeletes, ["cloud://test/photo-1"]);
  assert.deepStrictEqual(mock.calls.localDeletes, ["wxfile://usr/photo-2.jpg"]);
});

test("媒体删除失败会进入重试队列，恢复后可清空", async function () {
  const mock = createWxMock();
  let shouldFail = true;
  mock.api.cloud.deleteFile = function (options) {
    if (shouldFail) return options.fail(new Error("offline"));
    mock.calls.cloudDeletes.push(...options.fileList);
    options.success({ fileList: [] });
  };
  const media = freshMedia(mock.api);
  const first = await media.deleteMedia("cloud://test/retry-1");
  assert.strictEqual(first.deleted, false);
  assert.deepStrictEqual(media.getCleanupQueue(), ["cloud://test/retry-1"]);
  shouldFail = false;
  const result = await media.flushCleanupQueue();
  assert.strictEqual(result.remaining, 0);
  assert.deepStrictEqual(media.getCleanupQueue(), []);
  assert.deepStrictEqual(mock.calls.cloudDeletes, ["cloud://test/retry-1"]);
});

test("重试清理前会再次核对引用，已重新使用的媒体不会被误删", async function () {
  const mock = createWxMock();
  let shouldFail = true;
  mock.api.cloud.deleteFile = function (options) {
    if (shouldFail) return options.fail(new Error("offline"));
    mock.calls.cloudDeletes.push(...options.fileList);
    options.success({ fileList: [] });
  };
  const media = freshMedia(mock.api);
  const ref = "cloud://test/reused-after-offline";
  await media.deleteMedia(ref);
  shouldFail = false;

  const result = await media.flushCleanupQueue({
    memories: [{ id: "memory-restored", assetId: ref }],
  });

  assert.deepStrictEqual(mock.calls.cloudDeletes, [], "重新被记录引用的媒体不得继续执行旧清理任务");
  assert.strictEqual(result.protected, 1);
  assert.deepStrictEqual(media.getCleanupQueue(), [ref], "有引用时应延后清理，待恢复期结束后再次核对");
});

test("记录保存失败时清理新上传文件，不删旧文件", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  await assert.rejects(function () {
    return media.commitChange({
      originalRefs: ["cloud://test/old"],
      currentRefs: ["cloud://test/new"],
      persist: async function () { throw new Error("save failed"); },
    });
  }, /save failed/);
  assert.deepStrictEqual(mock.calls.cloudDeletes, ["cloud://test/new"]);
});

test("取消编辑时只清理本次新上传文件并保留原文件", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  await media.discardDraft({
    originalRefs: ["cloud://test/original"],
    currentRefs: ["cloud://test/original", "cloud://test/draft-only"],
  });
  assert.deepStrictEqual(mock.calls.cloudDeletes, ["cloud://test/draft-only"]);
});

test("记录保存成功后清理已被替换的旧文件", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  const value = await media.commitChange({
    originalRefs: ["cloud://test/old"],
    currentRefs: ["cloud://test/new"],
    persist: async function () {
      assert.deepStrictEqual(mock.calls.cloudDeletes, [], "新记录确认保存前不得删除旧文件");
      return { ok: true };
    },
  });
  assert.deepStrictEqual(value, { ok: true });
  assert.deepStrictEqual(mock.calls.cloudDeletes, ["cloud://test/old"]);
});

test("仍被其他记录引用的共享媒体不会被误删", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  const remainingSnapshot = {
    baby: { avatarId: "" },
    memories: [{ id: "m2", assetId: "cloud://test/shared" }],
    abilities: [],
  };
  await media.commitChange({
    originalRefs: ["cloud://test/shared"],
    currentRefs: ["cloud://test/new"],
    persist: async function () { return remainingSnapshot; },
  });
  await media.removeWithMedia({
    refs: ["cloud://test/shared"],
    persist: async function () { return remainingSnapshot; },
  });
  assert.deepStrictEqual(mock.calls.cloudDeletes, [], "共享文件仍有引用时必须保留");
});

test("回收站和历史版本仍引用的媒体在恢复期内不会被物理删除", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  const protectedRef = "cloud://test/recoverable-photo";
  const recoverableSnapshot = {
    memories: [],
    trashEntries: [{
      id: "trash-1",
      expiresAt: "2026-09-25T00:00:00.000Z",
      record: { id: "memory-1", assetId: protectedRef },
    }],
    recordHistory: [{
      id: "history-1",
      before: { id: "memory-1", assetId: protectedRef },
      after: null,
    }],
  };

  await media.commitChange({
    originalRefs: [protectedRef],
    currentRefs: ["cloud://test/replacement"],
    persist: async function () { return recoverableSnapshot; },
  });

  assert.deepStrictEqual(mock.calls.cloudDeletes, [], "仍可撤销或恢复的媒体必须继续保留");
  assert.deepStrictEqual(media.getCleanupQueue(), [protectedRef], "应保留延后清理候选，避免过期后永久遗留");
});

test("仅被家庭云备份引用的媒体也必须延后清理", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  const protectedRef = "cloud://test/backup-only-photo";

  await media.removeWithMedia({
    refs: [protectedRef],
    protectedRefs: [protectedRef],
    persist: async function () { return { memories: [], trashEntries: [], recordHistory: [] }; },
  });

  assert.deepStrictEqual(mock.calls.cloudDeletes, [], "云备份仍引用文件时不得物理删除");
  assert.deepStrictEqual(media.getCleanupQueue(), [protectedRef], "备份引用解除前应继续保留清理候选");

  const result = await media.flushCleanupQueue(
    { memories: [], trashEntries: [], recordHistory: [] },
    { protectedRefs: [protectedRef] },
  );
  assert.strictEqual(result.protected, 1);
  assert.deepStrictEqual(mock.calls.cloudDeletes, [], "重试清理也必须重新核对云备份引用");
});

test("删除记录成功后才删媒体，数据删除失败时保留文件", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  await assert.rejects(function () {
    return media.removeWithMedia({
      refs: ["cloud://test/keep"],
      persist: async function () { throw new Error("remove failed"); },
    });
  }, /remove failed/);
  assert.deepStrictEqual(mock.calls.cloudDeletes, []);
  await media.removeWithMedia({
    refs: ["cloud://test/remove"],
    persist: async function () { return "removed"; },
  });
  assert.deepStrictEqual(mock.calls.cloudDeletes, ["cloud://test/remove"]);
});

test("软删除返回回收站快照时只延后清理，不物理删除媒体", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  const ref = "cloud://test/in-trash";
  await media.removeWithMedia({
    refs: [ref],
    persist: async function () {
      return {
        trashId: "trash-memory-1",
        data: { trashEntries: [{ record: { id: "memory-1", assetId: ref } }] },
      };
    },
  });
  assert.deepStrictEqual(mock.calls.cloudDeletes, []);
  assert.deepStrictEqual(media.getCleanupQueue(), [ref]);
});

test("图片和音频上传都返回可持久化的云 fileID", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  media.configure({ useCloud: true, envId: "test-env" });
  const image = await media.uploadImage({ path: "/tmp/photo.jpg", name: "photo.jpg", size: 1024 });
  const audio = await media.uploadAudio({ path: "/tmp/voice.m4a", name: "voice.m4a", size: 2048 });
  assert.strictEqual(image.fileID, "cloud://test/1");
  assert.strictEqual(audio.fileID, "cloud://test/2");
  assert.deepStrictEqual(mock.calls.uploads.map(function (item) { return item.filePath; }), [
    "/tmp/photo.jpg", "/tmp/voice.m4a",
  ]);
});

test("开启云端后会把历史本机媒体迁移为跨设备可用的云文件", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  media.configure({ useCloud: true, envId: "test-env" });
  const snapshot = {
    baby: { avatarId: "wxfile://usr/avatar.jpg" },
    memories: [{ id: "m1", assetId: "wxfile://usr/memory.jpg" }],
    abilities: [{ id: "a1", imageId: "wxfile://usr/memory.jpg" }],
  };
  const result = await media.migrateSnapshotMedia(snapshot);
  assert.strictEqual(result.changed, true);
  assert.strictEqual(mock.calls.uploads.length, 2, "重复的本地图片应只上传一次");
  assert.ok(result.data.baby.avatarId.startsWith("cloud://"));
  assert.strictEqual(result.data.memories[0].assetId, result.data.abilities[0].imageId);
  assert.deepStrictEqual(result.originalRefs.sort(), [
    "wxfile://usr/avatar.jpg", "wxfile://usr/memory.jpg",
  ].sort());
  assert.strictEqual(result.currentRefs.length, 2);
});

test("回收站和历史版本中的本机媒体也会迁移，恢复后仍可跨设备读取", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  media.configure({ useCloud: true, envId: "test-env" });
  const localRef = "wxfile://usr/recoverable.jpg";
  const snapshot = {
    memories: [],
    trashEntries: [{ id: "trash-1", record: { id: "memory-1", assetId: localRef } }],
    recordHistory: [{ id: "history-1", before: { id: "memory-1", assetId: localRef }, after: null }],
  };

  const result = await media.migrateSnapshotMedia(snapshot);

  assert.strictEqual(result.changed, true);
  assert.strictEqual(mock.calls.uploads.length, 1, "同一可恢复文件只应上传一次");
  const migratedRef = result.data.trashEntries[0].record.assetId;
  assert.ok(migratedRef.startsWith("cloud://"));
  assert.strictEqual(result.data.recordHistory[0].before.assetId, migratedRef);
  assert.deepStrictEqual(result.originalRefs, [localRef]);
  assert.deepStrictEqual(result.currentRefs, [migratedRef]);
});

test("能从已过期的回收站和历史版本中提取待清理媒体", async function () {
  const mock = createWxMock();
  const media = freshMedia(mock.api);
  const refs = media.mediaReferences({
    trashEntries: [{ record: { photoIds: ["cloud://test/trash-photo"] } }],
    recordHistory: [{ before: { audioId: "cloud://test/history-audio" } }],
    duplicate: "cloud://test/trash-photo",
    bundledAsset: "/assets/illustration.png",
  });

  assert.deepStrictEqual(refs.sort(), [
    "cloud://test/history-audio",
    "cloud://test/trash-photo",
  ]);
});

(async function run() {
  for (const item of tests) {
    try {
      await item.fn();
      process.stdout.write("✓ " + item.name + "\n");
    } catch (error) {
      process.stderr.write("✗ " + item.name + "\n" + error.stack + "\n");
      process.exitCode = 1;
    }
  }
  delete global.wx;
  if (process.exitCode) process.exit(process.exitCode);
})().catch(function (error) {
  delete global.wx;
  console.error(error);
  process.exit(1);
});
