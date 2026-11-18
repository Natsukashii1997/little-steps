#!/usr/bin/env node

// 离线自检：不需要 AppID、微信开发者工具或云环境。
// 任何一项失败都会明确指出文件或原因，避免把不可用的体验版上传给家人。
import { access, readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const miniprogramRoot = resolve(root, "miniprogram");
const require = createRequire(import.meta.url);
const { BABY, VACCINE_SCHEDULE, VACCINE_AGE_ORDER } = require("../miniprogram/lib/constants.js");

const PAGES = ["v5/today", "v5/stage", "v5/growth", "v5/album", "v5/setup", "v5/records", "v5/notice"];
const EXPECTED_ROUTES = PAGES.map(page => "pages/" + page + "/index");
const EXPECTED_TAB_ITEMS = [
  { id: "today", label: "今天", path: "/pages/v5/today/index" },
  { id: "stage", label: "这个月", path: "/pages/v5/stage/index" },
  { id: "growth", label: "成长", path: "/pages/v5/growth/index" },
  { id: "album", label: "相册", path: "/pages/v5/album/index" },
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
  "v5-topbar", "v5-tabbar", "v5-action", "v5-quick-sheet", "add-pill", "app-header", "app-tabbar", "segmented-tabs", "undo-bar", "block", "button", "canvas", "checkbox", "checkbox-group",
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

async function checkPages(files) {
  const appConfig = JSON.parse(await readFile(resolve(miniprogramRoot, "app.json"), "utf8"));
  const configured = appConfig.pages || [];
  if (JSON.stringify(configured) !== JSON.stringify(EXPECTED_ROUTES)) {
    fail("app.json 路由必须匹配已批准的 S1 七个页面，当前为：" + configured.join(", "));
  }
  for (const page of PAGES) {
    const pagePath = "pages/" + page + "/index";
    if (!configured.includes(pagePath)) fail("app.json 缺少主页面：" + pagePath);
    for (const file of PAGE_FILES) {
      const fullPath = resolve(miniprogramRoot, pagePath + "." + file.split(".").pop());
      if (!await fileExists(fullPath)) fail("主页面文件缺失：" + relative(root, fullPath));
      if (!files.includes(fullPath)) fail("注册页面被打包配置排除：" + relative(root, fullPath));
    }
  }
  for (const removedPath of REMOVED_FEATURE_PATHS) {
    const fullPath = resolve(miniprogramRoot, removedPath);
    if (await fileExists(fullPath)) fail("已移除功能仍有页面或素材残留：" + relative(root, fullPath));
  }

  const tabbarSource = await readFile(resolve(miniprogramRoot, "components/v5/tabbar/index.js"), "utf8");
  const itemBlock = tabbarSource.match(/const ITEMS\s*=\s*\[([\s\S]*?)\];/);
  if (!itemBlock) fail("共享底栏缺少 ITEMS 配置");
  const itemCount = (itemBlock[1].match(/\{\s*id:/g) || []).length;
  if (itemCount !== EXPECTED_TAB_ITEMS.length) fail("共享底栏必须精确为 4 项，当前为 " + itemCount + " 项");
  let previousIndex = -1;
  for (const item of EXPECTED_TAB_ITEMS) {
    const fragment = `{ id: "${item.id}", label: "${item.label}", path: "${item.path}" }`;
    const index = itemBlock[1].indexOf(fragment);
    if (index <= previousIndex) fail("S1 共享底栏必须按 今天 / 这个月 / 成长 / 相册 的精确顺序配置");
    previousIndex = index;
  }
  const tabbarStyle = await readFile(resolve(miniprogramRoot, "components/v5/tabbar/index.wxss"), "utf8");
  if (!/grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/.test(tabbarStyle)) {
    fail("共享底栏必须使用 4 列等宽布局");
  }
  ok("S1 七个页面、四项等宽底栏和已退役功能零残留检查通过");
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

async function checkSharedRuntime(files) {
  // HANDOFF 2026-10-23 已批准 S1：本机新存储键，旧页面与云同步不进入启动路径。
  const appSource = await readFile(resolve(miniprogramRoot, "app.js"), "utf8");
  if (!appSource.includes('require("./lib/v5/repo")') ||
      !appSource.includes("repo.load()") || !appSource.includes("repo.purgeDeleted()")) {
    fail("S1 启动必须读取当前记录并清理到期的本地软删除记录");
  }
  if (/wx\.cloud|require\(["']\.\/lib\/(?:store|media)["']\)/.test(appSource)) {
    fail("S1 启动不得连接旧家庭存储、媒体清理或云环境");
  }
  const repoSource = await readFile(resolve(miniprogramRoot, "lib/v5/repo.js"), "utf8");
  if (!/const STORAGE_KEY = "baby-workbench-v5"/.test(repoSource)) fail("S1 必须使用独立的 v5 存储键");
  const config = JSON.parse(await readFile(resolve(miniprogramRoot, "app.json"), "utf8"));
  for (const component of ["topbar", "tabbar", "action", "quick-sheet"]) {
    const base = "/components/v5/" + component + "/index";
    if (config.usingComponents?.["v5-" + component] !== base) fail("S1 共享组件登记不正确：" + component);
    for (const extension of ["js", "json", "wxml", "wxss"]) {
      const componentFile = resolve(miniprogramRoot, "." + base + "." + extension);
      if (!await fileExists(componentFile)) fail("S1 共享组件缺失：" + base + "." + extension);
      if (!files.includes(componentFile)) fail("S1 共享组件被打包配置排除：" + base + "." + extension);
    }
  }
  ok("S1 启动、独立存储键与四个共享组件检查通过");
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

function formatBytes(bytes) { return (bytes / 1024 / 1024).toFixed(2) + " MB"; }

async function checkMainPackageSize(files) {
  let bytes = 0;
  for (const file of files) bytes += (await stat(file)).size;
  if (bytes > MAX_MAIN_PACKAGE_BYTES) {
    fail("主包超出 2MB：当前 " + formatBytes(bytes) + "，上限 2.00 MB。请压缩或移出 miniprogram/assets 中的大资源后再上传体验版。");
  }
  ok("主包体积 " + formatBytes(bytes) + "，未超过 2MB");
}

async function main() {
  console.log("Little Steps 小程序离线自检");
  const project = JSON.parse(await readFile(resolve(root, "project.config.json"), "utf8"));
  const ignored = project.packOptions?.ignore ?? [];
  for (const entry of ignored) {
    if (!["folder", "file"].includes(entry.type)) fail("自检暂不识别此打包排除类型：" + entry.type);
  }
  const files = (await walk(miniprogramRoot)).filter(file => {
    const name = relative(root, file).split(sep).join("/");
    return !ignored.some(entry => name === entry.value || (entry.type === "folder" && name.startsWith(entry.value + "/")));
  });
  for (const entry of ["app.js", "app.json", "app.wxss"]) {
    if (!files.includes(resolve(miniprogramRoot, entry))) fail("小程序入口被打包配置排除：" + entry);
  }
  await checkPages(files);
  checkDomainData();
  await checkJson(files);
  await checkLocalAssets(files);
  await checkWxmlAndWxss(files);
  await checkSharedRuntime(files);
  checkJavaScript(files);
  await checkMainPackageSize(files);
  console.log("S1 离线自检完成；实际预览与发布按单独授权执行。");
}

main().catch((error) => {
  console.error("\n自检未通过：" + error.message);
  process.exitCode = 1;
});
