#!/usr/bin/env node

// 离线自检：不需要 AppID、微信开发者工具或云环境。
// 任何一项失败都会明确指出文件或原因，避免把不可用的体验版上传给家人。
import { access, readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const miniprogramRoot = resolve(root, "miniprogram");
const require = createRequire(import.meta.url);
const { BABY, VACCINE_SCHEDULE, VACCINE_AGE_ORDER } = require("../miniprogram/lib/constants.js");

const PAGES = ["home", "memory", "growth", "health"];
const EXPECTED_ROUTES = [
  "pages/home/index",
  "pages/report/index",
  "pages/memory/index",
  "pages/growth/index",
  "pages/health/index",
];
const EXPECTED_TAB_ITEMS = [
  { id: "home", label: "Home", path: "/pages/home/index", icon: "/assets/nav/nav-home.png" },
  { id: "memory", label: "Memory", path: "/pages/memory/index", icon: "/assets/nav/nav-memory.png" },
  { id: "growth", label: "Growth", path: "/pages/growth/index", icon: "/assets/nav/nav-growth.png" },
  { id: "health", label: "Health", path: "/pages/health/index", icon: "/assets/nav/nav-health.png" },
];
const REMOVED_FEATURE_PATHS = [
  "pages/education",
  "pages/study",
  "assets/education",
  "assets/study",
  "assets/nav/nav-education.png",
  "assets/nav/nav-study.png",
];
const PAGE_FILES = ["index.js", "index.json", "index.wxml", "index.wxss"];
const MAX_MAIN_PACKAGE_BYTES = 2 * 1024 * 1024;
const ASSET_PATTERN = /(?:\/assets\/|\.\.\/assets\/|\.\/assets\/)([A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|svg|mp3|m4a|aac|ogg|wav|mp4))/g;
const ALLOWED_WXML_TAGS = new Set([
  "add-pill", "app-header", "app-tabbar", "segmented-tabs", "undo-bar", "block", "button", "canvas", "checkbox", "checkbox-group",
  "image", "input", "label", "picker", "scroll-view", "slider", "text", "textarea", "view",
]);

function fail(message) { throw new Error(message); }
function ok(message) { console.log("✓ " + message); }

async function fileExists(path) {
  try { await access(path); return true; } catch (error) { return false; }
}

async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(folder, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function checkPages() {
  const appConfig = JSON.parse(await readFile(resolve(miniprogramRoot, "app.json"), "utf8"));
  const configured = appConfig.pages || [];
  if (JSON.stringify(configured) !== JSON.stringify(EXPECTED_ROUTES)) {
    fail("app.json 路由必须精确为 Home / 成长摘要 / Memory / Growth / Health，当前为：" + configured.join(", "));
  }
  for (const page of PAGES) {
    const pagePath = "pages/" + page + "/index";
    if (!configured.includes(pagePath)) fail("app.json 缺少主页面：" + pagePath);
    for (const file of PAGE_FILES) {
      const fullPath = resolve(miniprogramRoot, pagePath + "." + file.split(".").pop());
      if (!await fileExists(fullPath)) fail("主页面文件缺失：" + relative(root, fullPath));
    }
  }
  for (const removedPath of REMOVED_FEATURE_PATHS) {
    const fullPath = resolve(miniprogramRoot, removedPath);
    if (await fileExists(fullPath)) fail("已移除功能仍有页面或素材残留：" + relative(root, fullPath));
  }

  const tabbarSource = await readFile(resolve(miniprogramRoot, "components/app-tabbar/index.js"), "utf8");
  const itemBlock = tabbarSource.match(/const ITEMS\s*=\s*\[([\s\S]*?)\];/);
  if (!itemBlock) fail("共享底栏缺少 ITEMS 配置");
  const itemCount = (itemBlock[1].match(/\{\s*id:/g) || []).length;
  if (itemCount !== EXPECTED_TAB_ITEMS.length) fail("共享底栏必须精确为 4 项，当前为 " + itemCount + " 项");
  let previousIndex = -1;
  for (const item of EXPECTED_TAB_ITEMS) {
    const fragment = `{ id: "${item.id}", label: "${item.label}", path: "${item.path}", icon: "${item.icon}" }`;
    const index = itemBlock[1].indexOf(fragment);
    if (index <= previousIndex) fail("共享底栏必须按 Home / Memory / Growth / Health 的精确顺序配置");
    previousIndex = index;
  }
  const tabbarStyle = await readFile(resolve(miniprogramRoot, "components/app-tabbar/index.wxss"), "utf8");
  if (!/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/.test(tabbarStyle)) {
    fail("共享底栏必须使用 4 列等宽布局");
  }
  ok("4 个主页面、成长摘要路由、4 项等宽底栏和已移除功能零残留检查通过");
}

function checkDomainData() {
  if (VACCINE_SCHEDULE.length !== 43) fail("疫苗清单必须为 43 针，当前为 " + VACCINE_SCHEDULE.length + " 针");
  const groups = new Set(VACCINE_SCHEDULE.map((item) => item.ageLabel));
  if (groups.size !== 16 || VACCINE_AGE_ORDER.length !== 16) {
    fail("疫苗年龄分组必须为 16 组，当前为 " + groups.size + " 组");
  }
  ok("疫苗清单为 43 针、16 个年龄分组");

  const expectedBaby = { name: "硕之", birthDate: "2026-08-04", birthWeight: 2.4, birthHeight: 48 };
  for (const [key, value] of Object.entries(expectedBaby)) {
    if (BABY[key] !== value) fail("固定出生数据不正确：" + key + " 应为 " + value + "，当前为 " + BABY[key]);
  }
  ok("固定出生数据为 2026-08-04 / 2.4kg / 48cm");
}

async function checkLocalAssets(files) {
  const missing = [];
  for (const file of files) {
    if (!/\.(?:js|wxml|wxss)$/i.test(file)) continue;
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(ASSET_PATTERN)) {
      const rawPath = match[0];
      if (rawPath.includes("{{") || rawPath.startsWith("cloud://") || /^https?:\/\//.test(rawPath)) continue;
      const assetRelativePath = match[1];
      const assetPath = resolve(miniprogramRoot, "assets", assetRelativePath.replace(/^assets\//, ""));
      if (!await fileExists(assetPath)) missing.push(relative(miniprogramRoot, file) + " → " + rawPath);
    }
  }
  if (missing.length) fail("以下本地资源路径不存在：\n" + missing.join("\n"));
  ok("引用的本地图片、图标和音频路径均存在");
}

async function checkJson(files) {
  const failures = [];
  for (const file of files.filter((item) => extname(item) === ".json")) {
    try { JSON.parse(await readFile(file, "utf8")); }
    catch (error) { failures.push(relative(root, file) + "：" + error.message); }
  }
  if (failures.length) fail("JSON 格式检查失败：\n" + failures.join("\n"));
  ok("小程序 JSON 配置均可解析");
}

async function checkWxmlAndWxss(files) {
  const unexpected = [];
  const localBackgrounds = [];
  const fakeGlyphs = [];
  for (const file of files) {
    const extension = extname(file);
    if (extension !== ".wxml" && extension !== ".wxss") continue;
    const source = await readFile(file, "utf8");
    if (extension === ".wxml") {
      for (const match of source.matchAll(/<\/?([a-z][\w-]*)\b/g)) {
        if (!ALLOWED_WXML_TAGS.has(match[1])) unexpected.push(relative(root, file) + " → <" + match[1] + ">");
      }
      if (/[♥✓×›＋]/.test(source)) fakeGlyphs.push(relative(root, file));
    }
    if (extension === ".wxss" && /url\(\s*["']?\/assets\//.test(source)) {
      localBackgrounds.push(relative(root, file));
    }
  }
  if (unexpected.length) fail("WXML 含未声明或不支持的标签：\n" + unexpected.join("\n"));
  if (fakeGlyphs.length) fail("WXML 仍含用字符冒充的可见图标：\n" + fakeGlyphs.join("\n"));
  if (localBackgrounds.length) fail("WXSS 不能直接读取本地 /assets 背景图，请先嵌入纸纹：\n" + localBackgrounds.join("\n"));
  ok("WXML 标签、可见图标与 WXSS 本地背景规则检查通过");
}

async function checkSharedRuntime() {
  const header = await readFile(resolve(miniprogramRoot, "components/app-header/index.js"), "utf8");
  const sharedNoticeIsVisible = /showNotice:\s*\{[^}]*value:\s*true/.test(header);
  const sharedNoticeHasRealRoute = /if \(this\.properties\.home\)[\s\S]*triggerEvent\("notice"\)[\s\S]*wx\.reLaunch\(\{ url: "\/pages\/home\/index\?openNotices=1" \}\)/.test(header);
  if (!sharedNoticeIsVisible || !sharedNoticeHasRealRoute) {
    fail("共享页头提醒入口必须可见，并能打开首页真实提醒面板");
  }
  const store = await readFile(resolve(miniprogramRoot, "lib/store.js"), "utf8");
  const familyConnectCalls = (store.match(/await connectCurrentFamily\(hadLocalChanges\)/g) || []).length;
  const familyConnectKeepsLocalEdits = /async function connectCurrentFamily\(hadLocalChanges\)[\s\S]*?loadRemoteFamily\(\{ mergeLocal: Boolean\(hadLocalChanges\) \}\)/.test(store);
  if (familyConnectCalls < 2 || !familyConnectKeepsLocalEdits) {
    fail("创建或加入家庭必须只在有真实本机修改时合并，避免记录丢失或固定初始资料重复");
  }
  const appSource = await readFile(resolve(miniprogramRoot, "app.js"), "utf8");
  if (!/onShow\(\)[\s\S]*store\.init\(\{ config \}\)/.test(appSource)) {
    fail("小程序从后台恢复时必须重新拉取家庭云端数据");
  }
  const homeSource = await readFile(resolve(miniprogramRoot, "pages/home/index.js"), "utf8");
  const homeTemplate = await readFile(resolve(miniprogramRoot, "pages/home/index.wxml"), "utf8");
  const clientBackupRequirements = [
    [homeSource, /store\.listBackups\(/, "首页缺少家庭备份列表调用"],
    [homeSource, /store\.exportFamily\(/, "首页缺少家庭数据导出调用"],
    [homeSource, /store\.restoreBackup\(/, "首页缺少家庭备份恢复调用"],
    [homeSource, /wx\.getFileSystemManager\(\)/, "家庭数据导出没有写入真实文件"],
    [homeTemplate, /bindtap="exportFamilyData"/, "家庭数据导出按钮没有真实事件"],
    [homeTemplate, /bindtap="restoreFamilyBackup"/, "家庭备份恢复按钮没有真实事件"],
  ];
  for (const [source, pattern, message] of clientBackupRequirements) {
    if (!pattern.test(source)) fail(message);
  }
  ok("共享头部、家庭同步防丢与自助备份恢复约束存在");
}

function checkJavaScript(files) {
  const failures = [];
  for (const file of files.filter((item) => extname(item) === ".js")) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) failures.push(relative(root, file) + "\n" + (result.stderr || result.stdout));
  }
  if (failures.length) fail("JavaScript 语法检查失败：\n" + failures.join("\n"));
  ok("小程序 JavaScript 语法检查通过");
}

async function directorySize(folder) {
  const files = await walk(folder);
  let bytes = 0;
  for (const file of files) bytes += (await stat(file)).size;
  return bytes;
}

function formatBytes(bytes) { return (bytes / 1024 / 1024).toFixed(2) + " MB"; }

async function checkMainPackageSize() {
  const bytes = await directorySize(miniprogramRoot);
  if (bytes > MAX_MAIN_PACKAGE_BYTES) {
    fail("主包超出 2MB：当前 " + formatBytes(bytes) + "，上限 2.00 MB。请压缩或移出 miniprogram/assets 中的大资源后再上传体验版。");
  }
  ok("主包体积 " + formatBytes(bytes) + "，未超过 2MB");
}

async function main() {
  console.log("Little Steps 小程序离线自检");
  const files = await walk(miniprogramRoot);
  await checkPages();
  checkDomainData();
  await checkJson(files);
  await checkLocalAssets(files);
  await checkWxmlAndWxss(files);
  await checkSharedRuntime();
  checkJavaScript(files);
  await checkMainPackageSize();
  console.log("自检完成：可以继续在微信开发者工具中编译和上传体验版。");
}

main().catch((error) => {
  console.error("\n自检未通过：" + error.message);
  process.exitCode = 1;
});
