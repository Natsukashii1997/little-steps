"use strict";

const assert = require("node:assert");
const path = require("node:path");
const { createSeedData } = require("../miniprogram/lib/model");

let toasts = [];
global.wx = {
  showToast: function (options) { toasts.push(options || {}); },
  showLoading: function () {},
  hideLoading: function () {},
};

function replaceModule(modulePath, exportsValue) {
  const resolved = require.resolve(modulePath);
  const previous = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsValue };
  return function restore() {
    if (previous) require.cache[resolved] = previous;
    else delete require.cache[resolved];
  };
}

function setAtPath(target, key, value) {
  const parts = key.split(".");
  let cursor = target;
  parts.slice(0, -1).forEach(function (part) {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts[parts.length - 1]] = value;
}

function loadPage(data, mediaOverrides) {
  const writes = [];
  const store = {
    getData: function () { return data; },
    subscribe: function () { return function () {}; },
    upsert: function (collection, record) {
      writes.push({ collection: collection, record: record });
      return Promise.resolve(data);
    },
    remove: function () { return Promise.resolve({ trashId: "trash-memory" }); },
    restoreFromTrash: function () { return Promise.resolve(); },
  };
  const media = Object.assign({
    chooseImage: function () { return Promise.resolve([]); },
    uploadImage: function () { return Promise.resolve({ fileID: "" }); },
    chooseAudio: function () { return Promise.resolve([]); },
    uploadAudio: function () { return Promise.resolve({ fileID: "" }); },
    mediaPath: function (result) { return result && result.fileID || ""; },
    commitChange: function (options) { return options.persist(); },
    discardDraft: function () { return Promise.resolve([]); },
  }, mediaOverrides || {});
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", { getHeaderLayout: function () { return { totalHeight: 88 }; } });
  const restoreMedia = replaceModule("../miniprogram/lib/media", media);
  const pagePath = path.resolve(__dirname, "../miniprogram/pages/memory/index.js");
  let definition;
  global.Page = function (value) { definition = value; };
  delete require.cache[pagePath];
  require(pagePath);
  delete require.cache[pagePath];
  restoreStore(); restoreLayout(); restoreMedia();

  const page = {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData: function (updates, callback) {
      Object.keys(updates || {}).forEach((key) => setAtPath(this.data, key, updates[key]));
      if (callback) callback.call(this);
    },
  };
  Object.keys(definition).forEach(function (key) {
    if (typeof definition[key] === "function") page[key] = definition[key].bind(page);
  });
  return { page: page, writes: writes };
}

async function testLegacyPhotoCompatibility() {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  const item = { id: "legacy", type: "photo", date: "2026-08-10", title: "旧照片", description: "", assetId: "cloud://legacy.jpg" };
  data.memories = [item];
  const fixture = loadPage(data);
  fixture.page.openEditor(item, "photo");
  assert.deepStrictEqual(fixture.page.data.draft.photoIds, ["cloud://legacy.jpg"], "旧版单张照片必须自动成为照片数组");
  assert.deepStrictEqual(fixture.page.data.draft.originalPhotoIds, ["cloud://legacy.jpg"]);
}

async function testPhotoOnlyAndAudioOnlySave() {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.memories = [];
  let capturedRefs;
  const photoFixture = loadPage(data, {
    commitChange: function (options) {
      capturedRefs = { original: options.originalRefs, current: options.currentRefs };
      return options.persist();
    },
  });
  photoFixture.page.data.today = "2026-08-24";
  photoFixture.page.data.editorOpen = true;
  photoFixture.page.data.draft = {
    type: "photo", typeLabel: "照片", title: "", date: "2026-08-20", description: "",
    photoIds: ["cloud://one.jpg", "cloud://two.jpg"], originalPhotoIds: [],
    audioId: "", originalAudioId: "", audioName: "", originalAudioName: "",
  };
  await photoFixture.page.saveRecord();
  assert.strictEqual(photoFixture.writes.length, 1, "只有照片也必须允许保存");
  assert.deepStrictEqual(photoFixture.writes[0].record.photoIds, ["cloud://one.jpg", "cloud://two.jpg"]);
  assert.strictEqual(photoFixture.writes[0].record.assetId, "cloud://one.jpg", "必须保留旧版首图兼容字段");
  assert.ok(photoFixture.writes[0].record.title, "无标题照片必须生成可读的默认标题");
  assert.deepStrictEqual(capturedRefs.current, ["cloud://one.jpg", "cloud://two.jpg"]);

  const audioFixture = loadPage(data);
  audioFixture.page.data.today = "2026-08-24";
  audioFixture.page.data.editorOpen = true;
  audioFixture.page.data.draft = {
    type: "moment", typeLabel: "瞬间", title: "", date: "2026-08-21", description: "",
    photoIds: [], originalPhotoIds: [], audioId: "cloud://voice.m4a", originalAudioId: "",
    audioName: "宝宝笑声.m4a", originalAudioName: "",
  };
  await audioFixture.page.saveRecord();
  assert.strictEqual(audioFixture.writes.length, 1, "只有音频也必须允许保存");
  assert.strictEqual(audioFixture.writes[0].record.audioId, "cloud://voice.m4a");
  assert.deepStrictEqual(audioFixture.writes[0].record.photoIds, []);
}

async function testMutualExclusionAndNinePhotoLimit() {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  data.memories = [];
  let requestedCount = 0;
  const fixture = loadPage(data, {
    chooseImage: function (options) {
      requestedCount = options.count;
      return Promise.resolve([{ path: "/tmp/new.jpg", size: 100, name: "new.jpg" }]);
    },
    uploadImage: function () { return Promise.resolve({ fileID: "cloud://new.jpg" }); },
  });
  fixture.page.data.draft = {
    type: "moment", typeLabel: "瞬间", title: "", date: "2026-08-20", description: "",
    photoIds: ["cloud://1.jpg", "cloud://2.jpg"], originalPhotoIds: ["cloud://1.jpg"],
    audioId: "cloud://draft-audio.m4a", originalAudioId: "", audioName: "声音.m4a", originalAudioName: "",
  };
  await fixture.page.choosePhotos();
  assert.strictEqual(requestedCount, 7, "选择器数量必须等于 9 减去已有照片数");
  assert.strictEqual(fixture.page.data.draft.audioId, "", "选择照片后必须清空互斥的音频");
  assert.deepStrictEqual(fixture.page.data.draft.photoIds, ["cloud://1.jpg", "cloud://2.jpg", "cloud://new.jpg"]);

  fixture.page.setData({ "draft.photoIds": Array.from({ length: 9 }, (_, index) => "cloud://" + index + ".jpg") });
  toasts = [];
  await fixture.page.choosePhotos();
  assert.ok(toasts.some(function (item) { return /最多 9 张/.test(item.title); }), "达到九张后必须给出明确提示");
}

(async function run() {
  await testLegacyPhotoCompatibility();
  await testPhotoOnlyAndAudioOnlySave();
  await testMutualExclusionAndNinePhotoLimit();
  process.stdout.write("Memory content tests: 3/3 passed\n");
}()).catch(function (error) {
  process.stderr.write(error.stack + "\n");
  process.exit(1);
});
