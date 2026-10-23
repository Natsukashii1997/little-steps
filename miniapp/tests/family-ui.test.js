"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createSeedData } = require("../miniprogram/lib/model");

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

function loadHome(store, mediaOverrides) {
  const pagePath = path.resolve(__dirname, "../miniprogram/pages/home/index.js");
  const restoreStore = replaceModule("../miniprogram/lib/store", store);
  const restoreLayout = replaceModule("../miniprogram/lib/layout", { getHeaderLayout: function () { return { totalHeight: 88 }; } });
  const restoreMedia = replaceModule("../miniprogram/lib/media", Object.assign({}, mediaOverrides || {}));
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
  return page;
}

const toasts = [];
global.wx = {
  showLoading: function () {},
  hideLoading: function () {},
  showToast: function (options) { toasts.push(options || {}); },
  showModal: function (options) {
    if (options && typeof options.success === "function") options.success({ confirm: true, cancel: false });
  },
  setClipboardData: function () {},
};

function localStatus() {
  return { mode: "local", pending: false, error: "", family: null };
}

function connectedStatus() {
  return {
    mode: "cloud",
    pending: false,
    error: "",
    family: {
      familyId: "family-1",
      owner: true,
      role: "owner",
      inviteCode: "ABC234",
      memberCount: 3,
      maxMembers: 6,
      me: { memberId: "owner", nickname: "爸爸", relation: "父亲", role: "owner", status: "active" },
      members: [
        { memberId: "owner", nickname: "爸爸", relation: "父亲", role: "owner", status: "active" },
        { memberId: "mother", nickname: "妈妈", relation: "母亲", role: "member", status: "active" },
        { memberId: "grandma", nickname: "姥姥", relation: "外婆", role: "backup-admin", status: "active" },
      ],
    },
  };
}

async function run() {
  const data = createSeedData("2026-08-24T10:00:00+08:00");
  let status = localStatus();
  const calls = [];
  const store = {
    getData: function () { return data; },
    getSyncStatus: function () { return status; },
    createFamily: async function (profile) { calls.push(["create", profile]); status = connectedStatus(); },
    joinFamily: async function (code, profile) { calls.push(["join", code, profile]); status = connectedStatus(); },
    syncNow: async function () { calls.push(["sync"]); return { ok: true, synced: true }; },
    updateFamilyMember: async function (memberId, changes) { calls.push(["update", memberId, changes]); },
    setBackupAdmin: async function (memberId) { calls.push(["backup", memberId]); },
    createBackup: async function () {
      calls.push(["create-backup"]);
      return { backup: { backupId: "backup-manual", version: 3 } };
    },
    listBackups: async function () { return { backups: [], retentionLimit: 30 }; },
  };

  const page = loadHome(store);
  await page.enablePersonalCloudSync();
  assert.deepEqual(calls.shift(), ["create", { nickname: "我", relation: "" }], "首次开启个人云同步应一键创建私密空间，不要求填写资料");

  toasts.length = 0;
  const failedPage = loadHome(Object.assign({}, store, {
    createFamily: async function () { throw new Error("家庭邀请码创建失败"); },
    getSyncStatus: localStatus,
  }));
  await failedPage.enablePersonalCloudSync();
  assert.ok(toasts.some(function (item) { return item.title === "开启云同步失败"; }), "底层协作协议失败时不得向个人版用户泄露家庭或邀请概念");

  status = localStatus();
  page.openSync();
  page.handleFamilyNicknameInput({ detail: { value: "妈妈" } });
  page.handleFamilyRelationChange({ detail: { value: "1" } });
  await page.createFamily();
  assert.deepEqual(calls.shift(), ["create", { nickname: "妈妈", relation: "母亲" }], "创建家庭必须保存昵称与六种基础关系之一");

  status = localStatus();
  page.setData({ inviteCodeInput: "abc234" });
  await page.joinFamily();
  assert.deepEqual(calls.shift(), ["join", "ABC234", { nickname: "妈妈", relation: "母亲" }], "加入家庭必须同时提交邀请码、昵称与关系");

  status = connectedStatus();
  page.openSync();
  assert.equal(page.data.familyMembers.length, 3, "家庭面板必须显示所有成员");
  assert.deepEqual(page.data.familyMembers.map(function (member) { return member.roleLabel; }), ["家庭所有者", "家庭成员", "备用管理员"]);
  assert.equal(page.data.familyMembers[1].canSetBackupAdmin, true, "所有者可以指定一位普通成员为备用管理员");
  assert.equal(page.data.familyMembers[2].canRevokeBackupAdmin, true, "现有备用管理员可以被所有者撤销");

  await page.setFamilyBackupAdmin({ currentTarget: { dataset: { id: "mother" } } });
  assert.deepEqual(calls.shift(), ["backup", "mother"]);

  page.openFamilyMemberEditor({ currentTarget: { dataset: { id: "mother" } } });
  page.handleMemberNicknameInput({ detail: { value: "硕之妈妈" } });
  page.handleMemberRelationChange({ detail: { value: "1" } });
  await page.saveFamilyMember();
  assert.deepEqual(calls.shift(), ["update", "mother", { nickname: "硕之妈妈", relation: "母亲" }]);

  await page.createManualBackup();
  assert.deepEqual(calls.shift(), ["create-backup"], "家庭所有者必须能从界面明确创建一份手动云备份");
  assert.ok(toasts.some(function (item) { return item.title === "个人记录备份已创建"; }), "手动备份成功后只显示个人版文案");

  status = connectedStatus();
  status.conflicts = [{
    conflictId: "conflict-1",
    collection: "todos",
    recordId: "todo-1",
    field: "title",
    losingValue: "晚间洗澡",
    winningValue: "上午洗澡",
  }];
  const conflictPage = loadHome(store);
  conflictPage.openSync();
  assert.equal(conflictPage.data.syncConflict.count, 1, "家庭同步区必须显示当前冲突数量");
  assert.match(conflictPage.data.syncConflict.items[0].result, /上午洗澡/, "必须说明最终保留的结果");
  assert.match(conflictPage.data.syncConflict.items[0].overwritten, /晚间洗澡/, "必须说明被覆盖的结果");
  toasts.length = 0;
  await conflictPage.syncNow();
  assert.deepEqual(calls.shift(), ["sync"]);
  assert.ok(toasts.some(function (item) { return /1 项冲突/.test(item.title); }), "同步遇到冲突时必须明确提示冲突数量");
  assert.equal(toasts.some(function (item) { return item.title === "已同步到家庭云端"; }), false, "存在冲突时不得显示普通同步成功反馈");

  status = connectedStatus();
  const cleanSyncPage = loadHome(store);
  toasts.length = 0;
  await cleanSyncPage.syncNow();
  assert.deepEqual(calls.shift(), ["sync"]);
  assert.ok(toasts.some(function (item) { return item.title === "已同步到个人云端"; }), "没有冲突时必须给出个人云同步成功反馈");

  status = connectedStatus();
  const ownerStatusPage = loadHome(store);
  ownerStatusPage.openSync();
  assert.equal(ownerStatusPage.data.familyMembers[0].canChangeStatus, false, "家庭所有者不能停用自己");
  assert.equal(ownerStatusPage.data.familyMembers[1].canChangeStatus, true, "家庭所有者必须能管理非所有者的启用状态");
  ownerStatusPage.openFamilyMemberEditor({ currentTarget: { dataset: { id: "mother" } } });
  assert.equal(ownerStatusPage.data.memberEditorCanChangeStatus, true, "所有者编辑其他成员时必须看到状态操作");
  await ownerStatusPage.toggleFamilyMemberStatus();
  assert.deepEqual(calls.shift(), ["update", "mother", { status: "inactive" }], "停用必须调用现有成员状态接口");

  status = connectedStatus();
  status.family.members[1].status = "inactive";
  const reactivatePage = loadHome(store);
  reactivatePage.openSync();
  reactivatePage.openFamilyMemberEditor({ currentTarget: { dataset: { id: "mother" } } });
  assert.equal(reactivatePage.data.memberEditorStatus, "inactive");
  await reactivatePage.toggleFamilyMemberStatus();
  assert.deepEqual(calls.shift(), ["update", "mother", { status: "active" }], "重新启用必须调用同一成员状态接口");

  status = connectedStatus();
  status.family.owner = false;
  status.family.role = "backup-admin";
  status.family.me = status.family.members[2];
  const backupAdminPage = loadHome(store);
  backupAdminPage.openSync();
  assert.equal(backupAdminPage.data.familyMembers[1].canChangeStatus, false, "备用管理员不得看到成员状态操作");
  backupAdminPage.openFamilyMemberEditor({ currentTarget: { dataset: { id: "mother" } } });
  toasts.length = 0;
  await backupAdminPage.toggleFamilyMemberStatus();
  assert.equal(calls.length, 0, "备用管理员绕过界面调用时也不得改变成员状态");
  assert.ok(toasts.some(function (item) { return /家庭所有者/.test(item.title); }), "越权调用必须给出明确权限提示");

  status = connectedStatus();
  status.family.owner = false;
  status.family.role = "member";
  status.family.me = status.family.members[1];
  const memberStatusPage = loadHome(store);
  memberStatusPage.openSync();
  memberStatusPage.openFamilyMemberEditor({ currentTarget: { dataset: { id: "mother" } } });
  toasts.length = 0;
  await memberStatusPage.toggleFamilyMemberStatus();
  assert.equal(calls.length, 0, "普通成员不得改变自己或其他成员的状态");
  assert.ok(toasts.some(function (item) { return /家庭所有者/.test(item.title); }));

  status = connectedStatus();
  page.refresh();
  assert.equal(page.data.canChangeAvatar, true, "家庭所有者必须能更换宝宝头像");

  let chooseImageCalls = 0;
  status = connectedStatus();
  status.family.owner = false;
  status.family.role = "member";
  const memberPage = loadHome(store, {
    chooseImage: async function () { chooseImageCalls += 1; return []; },
  });
  memberPage.refresh();
  assert.equal(memberPage.data.canChangeAvatar, false, "非家庭所有者必须隐藏头像更换入口");
  await memberPage.changeAvatar();
  assert.equal(chooseImageCalls, 0, "即使绕过界面调用方法，非所有者也不得打开图片选择器");
  assert.ok(toasts.some(function (item) { return String(item.title || "").includes("家庭所有者"); }), "权限拦截后必须给出明确提示");

  const template = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages/home/index.wxml"), "utf8");
  assert.ok(template.includes("个人云同步"), "首页必须只以个人云同步呈现底层云空间");
  assert.ok(template.includes('bindtap="enablePersonalCloudSync"'), "未开启时必须提供一键开启入口");
  assert.doesNotMatch(template, /家庭|邀请码|邀请|加入|成员/, "首页不得出现家庭、邀请、加入或成员管理文案");
  assert.equal(template.includes("syncInfo.error ||"), false, "页面不得直接暴露底层协作协议的错误文案");
  ["joinFamily", "copyInviteCode", "openFamilyMemberEditor", "setFamilyBackupAdmin", "toggleFamilyMemberStatus", "handleFamilyRelationChange"].forEach(function (handler) {
    assert.equal(template.includes('bindtap="' + handler + '"') || template.includes('bindchange="' + handler + '"'), false, "首页不得绑定隐藏的协作入口：" + handler);
  });
  assert.ok(template.includes('bindtap="createManualBackup"'), "个人云同步仍必须提供立即备份");
  assert.ok(template.includes('bindtap="exportFamilyData"'), "个人云同步仍必须提供离线导出");
  assert.ok(template.includes('bindtap="restoreFamilyBackup"'), "个人云同步仍必须提供备份恢复");
  assert.ok(template.includes('wx:if="{{syncConflict.count}}"'), "个人云同步面板必须持续展示冲突说明和核对入口");
  assert.ok(template.includes("全部个人记录和照片、音频的引用"), "界面必须准确说明个人备份覆盖范围");
  assert.ok(template.includes("实际照片和音频文件仍保存在云存储"), "界面不能把只保存媒体引用的备份误称为包含媒体文件本体");
  assert.ok(template.includes("成长摘要长图只包含你当次勾选的内容"), "界面必须区分个人备份与所选摘要分享长图");
  assert.ok(template.includes('wx:if="{{canChangeAvatar}}"'), "头像更换入口权限必须继续生效");
  ["report", "memory", "growth", "health"].forEach(function (pageName) {
    const pageTemplate = fs.readFileSync(path.resolve(__dirname, "../miniprogram/pages", pageName, "index.wxml"), "utf8");
    assert.doesNotMatch(pageTemplate, /家庭|邀请码|邀请|加入|成员/, "个人版可见页面不得残留协作语义：" + pageName);
  });
  console.log("Personal cloud UI tests: 1/1 passed");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
