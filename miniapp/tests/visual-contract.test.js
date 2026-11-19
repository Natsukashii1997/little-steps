"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const pageNames = ["growth", "health", "memory"];
const requiredComponents = ["app-header", "app-tabbar", "add-pill"];
const tests = [];

function test(name, fn) { tests.push({ name, fn }); }
function read(relativePath) { return fs.readFileSync(path.join(root, relativePath), "utf8"); }
function readBuffer(relativePath) { return fs.readFileSync(path.join(root, relativePath)); }

function decodeRgbaPng(relativePath) {
  const input = readBuffer(relativePath);
  assert.strictEqual(input.toString("hex", 0, 8), "89504e470d0a1a0a", `${relativePath} 不是 PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString("ascii", offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  assert.strictEqual(bitDepth, 8, `${relativePath} 必须是 8-bit PNG`);
  assert.strictEqual(colorType, 6, `${relativePath} 必须是 RGBA PNG，不能再带不透明方形纸底`);
  assert.strictEqual(interlace, 0, `${relativePath} 不应使用交错 PNG`);
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const row = inflated.subarray(sourceOffset, sourceOffset + stride);
    sourceOffset += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0;
      const up = y > 0 ? rgba[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[(y - 1) * stride + x - 4] : 0;
      let value = row[x];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upperLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upperLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft)) & 255;
      } else assert.strictEqual(filter, 0, `${relativePath} 使用了未知 PNG 滤镜 ${filter}`);
      rgba[y * stride + x] = value;
    }
  }
  return { width, height, rgba };
}

function assertTransparentSafety(relativePath, minimumInset) {
  const image = decodeRgbaPng(relativePath);
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = image.rgba[(y * image.width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  assert.ok(maxX >= 0, `${relativePath} 没有可见内容`);
  assert.ok(minX >= minimumInset, `${relativePath} 左侧没有安全留白`);
  assert.ok(minY >= minimumInset, `${relativePath} 顶部没有安全留白`);
  assert.ok(image.width - 1 - maxX >= minimumInset, `${relativePath} 右侧仍被裁切`);
  assert.ok(image.height - 1 - maxY >= minimumInset, `${relativePath} 底部仍被裁切`);
}

test("三个业务页统一关闭原生导航栏并只使用共享页头", function () {
  pageNames.forEach(function (pageName) {
    const config = JSON.parse(read(`miniprogram/pages/${pageName}/index.json`));
    assert.strictEqual(config.navigationStyle, "custom", `${pageName} 未关闭微信原生导航栏，会与共享页头叠加`);
    assert.ok(config.usingComponents && config.usingComponents["app-header"], `${pageName} 未注册共享页头`);
  });
});

test("三个业务页统一继承首页同款纸张页面壳与共享底栏、Add 按钮", function () {
  pageNames.forEach(function (pageName) {
    const wxml = read(`miniprogram/pages/${pageName}/index.wxml`);
    assert.match(wxml, /^<view class="[^"]*\bpage-shell\b[^"]*">/, `${pageName} 根节点未继承共享纸张页面壳`);
    requiredComponents.forEach(function (componentName) {
      assert.ok(wxml.includes(`<${componentName}`), `${pageName} 未复用共享 ${componentName}`);
    });
  });
});

test("健康页动态主标题和统计文案可在窄屏换行，不会压住插画和 Add", function () {
  const wxss = read("miniprogram/pages/health/index.wxss");
  ["hero-title", "hero-subtitle", "hero-count"].forEach(function (className) {
    const rule = wxss.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `缺少 .${className} 样式`);
    assert.ok(!/white-space\s*:\s*nowrap/.test(rule[1]), `.${className} 禁止换行，动态中文会在 320px 窄屏侵入插画区`);
    assert.match(rule[1], /overflow-wrap\s*:\s*(?:anywhere|break-word)/, `.${className} 缺少长内容断行保护`);
  });
});

test("健康页复用三等分切换组件，固定区与内容占位共用同一高度", function () {
  const config = JSON.parse(read("miniprogram/pages/health/index.json"));
  const wxml = read("miniprogram/pages/health/index.wxml");
  const healthStyle = read("miniprogram/pages/health/index.wxss");
  const componentTemplate = read("miniprogram/components/segmented-tabs/index.wxml");
  const componentStyle = read("miniprogram/components/segmented-tabs/index.wxss");

  assert.strictEqual(
    config.usingComponents["segmented-tabs"],
    "../../components/segmented-tabs/index",
    "健康页未注册共享切换组件",
  );
  assert.match(wxml, /<segmented-tabs[^>]*items="\{\{healthTabs\}\}"[^>]*active="\{\{tab\}\}"[^>]*bind:change="switchTab"/s);
  assert.match(componentTemplate, /wx:for="\{\{items\}\}"/);
  assert.match(componentTemplate, /aria-label="\{\{ariaLabelText\}\}"/);
  assert.match(componentTemplate, /count-\{\{items\.length\}\}/, "共享切换组件必须按项目数量选择等分列数");

  assert.match(componentStyle, /\.segmented-tabs\s*\{[^}]*display\s*:\s*grid[^}]*grid-template-columns\s*:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*height\s*:\s*100rpx[^}]*padding\s*:\s*4rpx[^}]*border\s*:\s*4rpx\s+solid\s+#292724/s);
  assert.match(componentStyle, /\.segmented-tabs\.count-2\s*\{[^}]*grid-template-columns\s*:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "两项切换必须严格二等分，不能遗留空白第三列");
  assert.match(componentStyle, /\.segmented-tab\s*\{[^}]*height\s*:\s*100%[^}]*margin\s*:\s*0[^}]*border\s*:\s*0/s);
  assert.doesNotMatch(componentStyle, /border(?:-right|-left|-top|-bottom)?\s*:[^;}]*dashed/, "切换组件内部不应出现虚线");
  assert.doesNotMatch(healthStyle, /\.health-tabs\s*\{|\.health-tab\s*\{/, "Health 页仍保留了一套私有切换样式");

  assert.match(healthStyle, /\.health-page\s*\{[^}]*--health-tabs-region-height\s*:\s*119rpx/s);
  assert.match(healthStyle, /\.tabs-wrap\s*\{[^}]*height\s*:\s*var\(--health-tabs-region-height\)/s);
  assert.match(healthStyle, /\.tabs-spacer\s*\{[^}]*height\s*:\s*var\(--health-tabs-region-height\)/s);
  assert.match(wxml, /class="page-scroll"\s+style="padding-top:\s*\{\{headerHeight\}\}px;"/);
  assert.doesNotMatch(wxml, /headerHeight\s*\+\s*64/, "Health 内容仍使用与切换区实际高度脱节的 64px 偏移");
});

test("共享页头、底栏和 Add 按钮满足统一触控尺寸与底部安全区", function () {
  const header = read("miniprogram/components/app-header/index.wxss");
  const tabbar = read("miniprogram/components/app-tabbar/index.wxss");
  const add = read("miniprogram/components/add-pill/index.wxss");
  assert.match(header, /\.header-row\s*\{[^}]*min-height\s*:\s*44px/s, "共享页头行必须使用与布局计算一致的固定像素高度");
  assert.match(header, /\.header-icon-button\s*\{[^}]*width\s*:\s*44px[^}]*height\s*:\s*44px[^}]*min-height\s*:\s*44px/s);
  assert.match(tabbar, /\.tab-item\s*\{[^}]*min-height\s*:\s*116rpx/s);
  assert.match(tabbar, /safe-area-inset-bottom/);
  assert.match(add, /\.add-pill\s*\{[^}]*min-height\s*:\s*88rpx/s);
  assert.match(add, /border-radius\s*:\s*999rpx/);
});

test("共享页头整行避开微信系统胶囊，并用真实提醒与分享操作", function () {
  const layout = read("miniprogram/lib/layout.js");
  const script = read("miniprogram/components/app-header/index.js");
  const template = read("miniprogram/components/app-header/index.wxml");
  const style = read("miniprogram/components/app-header/index.wxss");
  const homeScript = read("miniprogram/pages/home/index.js");
  const reportTemplate = read("miniprogram/pages/report/index.wxml");

  assert.match(layout, /const contentTop = menuHeight && menuBottom[\s\S]*menuBottom \+ 4/, "共享页头没有以微信胶囊底边计算自定义内容起点");
  assert.match(layout, /:\s*statusBarHeight \+ 44/, "读取不到胶囊尺寸时没有提供安全的胶囊避让兜底");
  assert.match(layout, /totalHeight:\s*contentTop \+ barHeight/, "页面内容偏移没有计入胶囊下方的整行页头");
  assert.match(template, /padding-top:\s*\{\{contentTop\}\}px/, "自定义页头仍与微信胶囊处于同一行");
  assert.doesNotMatch(template, /rightInset/, "页头已位于胶囊下方，不应再为同一行胶囊挤出右侧空间");
  assert.match(template, /class="header-weather"[^>]*src="\/assets\/ui\/weather\.png"/, "首页页头没有复用真实天气图标资产");
  assert.match(template, /aria-label="返回上一页"/, "返回按钮的无障碍名称应与实际 navigateBack 行为一致");
  assert.match(style, /\.header-row\s*\{[^}]*grid-template-columns\s*:\s*176rpx\s+minmax\(0,\s*1fr\)\s+176rpx/s, "业务页标题两侧没有保留等宽操作区，标题无法稳定居中");
  assert.match(style, /\.header-row\.is-home\s*\{[^}]*grid-template-columns\s*:\s*104rpx\s+minmax\(0,\s*1fr\)\s+176rpx/s, "首页未形成天气—日期—提醒/分享的单行布局");
  assert.match(script, /showNotice:\s*\{\s*type:\s*Boolean,\s*value:\s*true\s*\}/, "业务页没有默认提供提醒入口");
  assert.match(script, /if \(this\.properties\.home\)[\s\S]*triggerEvent\("notice"\)[\s\S]*wx\.reLaunch\(\{ url: "\/pages\/home\/index\?openNotices=1" \}\)/, "提醒按钮没有连接到首页真实提醒面板");
  assert.match(homeScript, /async onLoad\(options\)[\s\S]*String\(options\.openNotices\) === "1"[\s\S]*noticeOpen:\s*true/, "首页没有识别跨页提醒参数并打开提醒面板");
  assert.match(reportTemplate, /show-share="\{\{false\}\}"/, "成长摘要页必须继续尊重显式关闭分享按钮的产品约束");
});

test("首页直接点击整张圆形头像更换照片，不显示额外加号按钮", function () {
  const wxml = read("miniprogram/pages/home/index.wxml");
  const wxss = read("miniprogram/pages/home/index.wxss");
  assert.match(
    wxml,
    /<button class="avatar-button[^\"]*"\s+bindtap="changeAvatar"[\s\S]*?<image class="baby-avatar"[\s\S]*?<\/button>/,
    "可编辑头像必须让整张圆形照片成为更换入口",
  );
  assert.match(wxml, /aria-label="点击圆形照片更换硕之的头像"/);
  assert.doesNotMatch(wxml, /avatar-action|avatar-add-icon/, "首页不应继续渲染独立加号按钮");
  assert.doesNotMatch(wxss, /\.avatar-action\b|\.avatar-add-icon\b/, "首页不应残留独立加号按钮样式");
  assert.match(wxss, /\.avatar-stage\s*\{[^}]*overflow\s*:\s*hidden[^}]*z-index\s*:\s*2/s);
  assert.match(wxss, /\.avatar-button\s*\{[^}]*width\s*:\s*100%[^}]*height\s*:\s*100%[^}]*overflow\s*:\s*hidden[^}]*border-radius\s*:\s*50%/s);
});

test("共享页头在 320px 窄屏仍保持天气、标题和操作区互不重叠", function () {
  const header = read("miniprogram/components/app-header/index.wxss");
  const narrow = header.match(/@media\s*\(max-width:\s*360px\)\s*\{([\s\S]*)\}\s*$/);
  assert.ok(narrow, "共享页头缺少覆盖 320px 的窄屏样式");
  assert.match(narrow[1], /\.header-title\s*\{[^}]*position\s*:\s*static[^}]*width\s*:\s*auto[^}]*transform\s*:\s*none/s, "320px 下标题仍使用绝对定位，可能与右侧操作按钮重叠");
  assert.match(narrow[1], /\.header-row\.is-home\s*\{[^}]*grid-template-columns\s*:\s*92rpx\s+minmax\(0,\s*1fr\)\s+176rpx/s, "320px 下首页天气、日期和双操作区没有各自获得稳定空间");
  assert.match(narrow[1], /\.header-title\.is-home\s*\{[^}]*max-width\s*:\s*none[^}]*font-size\s*:\s*26rpx/s, "320px 下首页日期字号没有收敛");
  assert.match(narrow[1], /\.header-weather\s*\{[^}]*width\s*:\s*33px[^}]*height\s*:\s*26px/s, "320px 下天气图标没有稳定尺寸");
});

test("共享底栏精确保留四项并等宽重排，图标透明且激活态只保留扁平黄色笔刷", function () {
  const tabbarScript = read("miniprogram/components/app-tabbar/index.js");
  const tabbarStyle = read("miniprogram/components/app-tabbar/index.wxss");
  const itemsMatch = tabbarScript.match(/const ITEMS\s*=\s*(\[[\s\S]*?\]);/);
  assert.ok(itemsMatch, "共享底栏缺少可验证的 ITEMS 唯一事实源");
  const items = Function('"use strict"; return (' + itemsMatch[1] + ');')();
  assert.deepStrictEqual(items, [
    { id: "home", label: "Home", path: "/pages/home/index", icon: "/assets/nav/nav-home.png" },
    { id: "memory", label: "Memory", path: "/pages/memory/index", icon: "/assets/nav/nav-memory.png" },
    { id: "growth", label: "Growth", path: "/pages/growth/index", icon: "/assets/nav/nav-growth.png" },
    { id: "health", label: "Health", path: "/pages/health/index", icon: "/assets/nav/nav-health.png" },
  ], "共享底栏必须严格按 Home / Memory / Growth / Health 四项排列");
  ["home", "memory", "growth", "health"].forEach(function (name) {
    const assetPath = `miniprogram/assets/nav/nav-${name}.png`;
    const image = readBuffer(assetPath);
    assert.strictEqual(image.toString("hex", 0, 8), "89504e470d0a1a0a", `${name} 底栏图标不是 PNG`);
    assert.strictEqual(image[25], 6, `${name} 底栏 PNG 不是 RGBA，仍可能带不透明方形底`);
  });
  assert.match(tabbarStyle, /grid-template-columns\s*:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, "四项底栏没有严格等宽重排");
  assert.doesNotMatch(tabbarStyle, /repeat\(6,/, "底栏仍残留六列布局假设");
  assert.doesNotMatch(tabbarStyle, /\.is-active\s+\.icon-wrap\s*\{/, "激活态仍在图标外绘制方形底块");
  assert.match(tabbarStyle, /\.tab-item\.is-active::before\s*\{[^}]*border-radius\s*:\s*999rpx[^}]*background\s*:\s*rgba\(247,\s*197,\s*78,/s, "激活态缺少扁平黄色笔刷");
});

test("S1 只注册七个当前页面，旧页面保留为资产，已退役功能零残留", function () {
  const appConfig = JSON.parse(read("miniprogram/app.json"));
  assert.deepStrictEqual(appConfig.pages, [
    "pages/v5/today/index",
    "pages/v5/stage/index",
    "pages/v5/growth/index",
    "pages/v5/album/index",
    "pages/v5/setup/index",
    "pages/v5/records/index",
    "pages/v5/notice/index",
  ], "app.json 必须匹配常浩已批准的 S1 路由");
  [
    "miniprogram/pages/education",
    "miniprogram/pages/study",
    "miniprogram/assets/education",
    "miniprogram/assets/study",
    "miniprogram/assets/nav/nav-education.png",
    "miniprogram/assets/nav/nav-study.png",
  ].forEach(function (relativePath) {
    assert.strictEqual(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} 属于已下线功能，不得残留`);
  });
});

test("首页五个照护图标统一使用带透明安全区的批准稿圆形资产", function () {
  const home = read("miniprogram/pages/home/index.wxml");
  ["feeding", "sleep", "diaper", "poop", "health"].forEach(function (name) {
    const assetPath = `miniprogram/assets/care/icon-${name}.png`;
    assert.ok(home.includes(`/assets/care/icon-${name}.png`), `${name} 没有引用透明统一图标资产`);
    assertTransparentSafety(assetPath, 4);
  });
  assert.ok(!home.includes("💩"), "首页仍在使用系统 Emoji");
  assert.ok(!home.includes("care-icon-badge"), "首页仍保留临时 Emoji 徽章结构");
});

test("独立装饰插画全部使用透明素材且四周保留安全区，不再出现截图色块", function () {
  const home = read("miniprogram/pages/home/index.wxml");
  const memory = read("miniprogram/pages/memory/index.wxml");
  const growth = read("miniprogram/pages/growth/index.wxml");
  assert.ok(home.includes('/assets/home/todo-bear.png'), "首页待办小熊仍引用带纸色方块的截图素材");
  assert.ok(memory.includes('/assets/memory/note-bear.png'), "回忆册主视觉仍引用带纸色方块的截图素材");
  assert.ok(growth.includes('/assets/growth/profile-bear.png'), "成长页主视觉仍误用带色块的学习卡片素材");
  [
    "miniprogram/assets/home/todo-bear.png",
    "miniprogram/assets/memory/note-bear.png",
    "miniprogram/assets/growth/profile-bear.png"
  ].forEach(function (assetPath) { assertTransparentSafety(assetPath, 4); });
});

test("全 App 所有独立插画均通过透明通道与四边安全留白检查", function () {
  [
    "miniprogram/assets/care/icon-age.png",
    "miniprogram/assets/care/icon-diaper.png",
    "miniprogram/assets/care/icon-feeding.png",
    "miniprogram/assets/care/icon-health.png",
    "miniprogram/assets/care/icon-height.png",
    "miniprogram/assets/care/icon-poop.png",
    "miniprogram/assets/care/icon-sleep.png",
    "miniprogram/assets/care/icon-weight.png",
    "miniprogram/assets/ui/heart.png",
    "miniprogram/assets/ui/weather.png",
    "miniprogram/assets/home/todo-bear.png",
    "miniprogram/assets/memory/note-bear.png",
    "miniprogram/assets/memory/rollover.png",
    "miniprogram/assets/memory/smile.png",
    "miniprogram/assets/growth/profile-bear.png",
    "miniprogram/assets/health/checkup-four-month.png",
    "miniprogram/assets/health/checkup-hero-bear.png",
    "miniprogram/assets/health/checkup-hero-stethoscope.png",
    "miniprogram/assets/health/checkup-newborn.png",
    "miniprogram/assets/health/checkup-one-month.png",
    "miniprogram/assets/health/development-hero-baby.png",
    "miniprogram/assets/health/development-hero-bear.png",
    "miniprogram/assets/health/development-rollover.png",
    "miniprogram/assets/health/development-sitting.png",
    "miniprogram/assets/health/development-tummy-time.png",
    "miniprogram/assets/health/vaccine-five-in-one.png",
    "miniprogram/assets/health/vaccine-hepb.png",
    "miniprogram/assets/health/vaccine-hero.png",
    "miniprogram/assets/health/vaccine-mmr.png"
  ].forEach(function (assetPath) { assertTransparentSafety(assetPath, 4); });
});

test("健康页独立插画不再依赖方形纸底或额外绿色贴片", function () {
  const healthScript = read("miniprogram/pages/health/index.js");
  const healthStyle = read("miniprogram/pages/health/index.wxss");
  ["newborn", "one-month", "four-month"].forEach(function (name) {
    const assetPath = `miniprogram/assets/health/checkup-${name}.png`;
    assert.ok(healthScript.includes(`/assets/health/checkup-${name}.png`), `${name} 儿保插画仍未使用透明资产`);
    assertTransparentSafety(assetPath, 4);
  });
  const abilityRule = healthStyle.match(/\.ability-image\s*\{([^}]*)\}/s);
  assert.ok(abilityRule, "缺少发育里程碑插画样式");
  assert.doesNotMatch(abilityRule[1], /background\s*:/, "发育里程碑插画后仍有独立绿色方块");
});

test("健康页发育与儿保恢复大插画卡片，插画完整显示且不再挤成摘要行", function () {
  const healthTemplate = read("miniprogram/pages/health/index.wxml");
  const healthStyle = read("miniprogram/pages/health/index.wxss");
  const sharedCards = healthStyle.match(/\.ability-card\s*,\s*\.checkup-card\s*\{([^}]*)\}/s);
  const abilityImage = healthStyle.match(/\.ability-image\s*\{([^}]*)\}/s);
  const checkupImage = healthStyle.match(/\.calendar-mark\s*\{([^}]*)\}/s);

  assert.match(healthTemplate, /class="ability-image"\s+src="\{\{item\.artSrc\}\}"\s+mode="\{\{item\.artMode\}\}"/, "发育卡片必须使用格式化后的稳定素材与无裁切模式");
  assert.match(healthTemplate, /class="calendar-mark"\s+src="\{\{item\.artSrc\}\}"\s+mode="\{\{item\.artMode\}\}"/, "儿保卡片必须使用格式化后的稳定素材与无裁切模式");
  assert.ok(sharedCards, "发育和儿保卡片必须共用同一空间规格");
  assert.match(sharedCards[1], /min-height\s*:\s*276rpx/, "发育和儿保卡片必须恢复参考图中的纵向呼吸空间");
  assert.ok(abilityImage, "缺少发育插画尺寸规则");
  assert.match(abilityImage[1], /width\s*:\s*210rpx/);
  assert.match(abilityImage[1], /height\s*:\s*166rpx/);
  assert.ok(checkupImage, "缺少儿保日历插画尺寸规则");
  assert.match(checkupImage[1], /width\s*:\s*210rpx/);
  assert.match(checkupImage[1], /height\s*:\s*210rpx/);
});

test("首页长图入口和家庭备份面板在 320px 窄屏改为不互相挤压的单列布局", function () {
  const home = read("miniprogram/pages/home/index.wxss");
  const narrow = home.match(/@media\s*\(max-width:\s*360px\)\s*\{([\s\S]*)\}\s*$/);
  assert.ok(narrow, "首页缺少覆盖 320px 的窄屏样式");
  assert.match(narrow[1], /\.report-entry\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)[^}]*\}/s, "320px 下长图入口必须上下排列，避免标题和按钮互相挤压");
  const reportAction = narrow[1].match(/\.report-entry-action\s*\{([^}]*)\}/s);
  assert.ok(reportAction, "320px 下缺少长图入口按钮约束");
  assert.match(reportAction[1], /justify-self\s*:\s*start/, "长图入口按钮必须从左侧开始排列");
  assert.match(reportAction[1], /max-width\s*:\s*100%/, "长图入口按钮必须保持在容器内");
  assert.match(narrow[1], /\.family-member-item\s*\{[^}]*grid-template-columns\s*:\s*54rpx\s+minmax\(0,\s*1fr\)[^}]*\}/s, "320px 下家庭成员姓名区不能被操作按钮压缩");
  const memberActions = narrow[1].match(/\.family-member-actions\s*\{([^}]*)\}/s);
  assert.ok(memberActions, "320px 下缺少家庭成员操作区约束");
  assert.match(memberActions[1], /grid-column\s*:\s*2/, "家庭成员操作应换到姓名下方");
  assert.match(memberActions[1], /max-width\s*:\s*none/, "家庭成员操作区不能被旧的固定宽度压缩");
  assert.match(memberActions[1], /justify-content\s*:\s*flex-start/, "家庭成员操作应从姓名左侧对齐");
  assert.match(narrow[1], /\.data-tool-row\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)[^}]*\}/s, "三个备份工具按钮必须在 320px 下逐行显示");
});

test("报告页在 320 至 430px 使用流式表单、统一触控高度和底部安全区", function () {
  const report = read("miniprogram/pages/report/index.wxss");
  assert.match(report, /\.report-content\s*\{[^}]*padding-bottom\s*:\s*calc\([^)]*var\(--safe-bottom\)[^)]*\)[^}]*\}/s);
  assert.match(report, /\.report-content\s*\{[^}]*padding-right\s*:\s*26rpx[^}]*padding-left\s*:\s*26rpx[^}]*\}/s, "成长摘要页应使用已确认视觉稿的统一紧凑页边距");
  assert.match(report, /\.hero-copy\s*\{[^}]*width\s*:\s*68%[^}]*\}/s, "常见手机宽度下标题信息与右侧小报插画必须稳定分栏");
  assert.match(report, /\.date-card\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)[^}]*minmax\(0,\s*1fr\)[^}]*\}/s, "日期区在常见手机宽度下必须弹性分栏");
  assert.match(report, /\.date-value\s*\{[^}]*min-height\s*:\s*88rpx[^}]*\}/s, "日期选择器必须达到统一触控高度");
  assert.match(report, /\.module-option\s*\{[^}]*min-height\s*:\s*120rpx[^}]*grid-template-columns\s*:\s*58rpx\s+minmax\(0,\s*1fr\)\s+64rpx[^}]*\}/s, "摘要选项必须保持清晰的勾选、说明、状态三列结构");
  assert.match(report, /\.result-action\s*\{[^}]*min-height\s*:\s*88rpx[^}]*\}/s, "生成后操作按钮必须达到统一触控高度");
  assert.match(report, /@media\s*\(max-width:\s*360px\)[\s\S]*\.hero-copy\s*\{[^}]*width\s*:\s*100%[^}]*\}[\s\S]*\.hero-note\s*\{[^}]*display\s*:\s*none[^}]*\}/s, "窄屏必须让正文占满并隐藏右侧装饰，避免标题重叠");
  assert.match(report, /@media\s*\(max-width:\s*360px\)[\s\S]*\.result-actions\s*\{[^}]*grid-template-columns\s*:\s*1fr[^}]*\}/s, "320px 下三个结果操作必须逐行显示");
  assert.match(report, /\.report-canvas\s*\{[^}]*position\s*:\s*fixed[^}]*left\s*:\s*-10000px[^}]*pointer-events\s*:\s*none[^}]*\}/s, "导出 Canvas 必须脱离可视布局且不能拦截点击");
});

(async function run() {
  let failed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      console.log("✓", item.name);
    } catch (error) {
      failed += 1;
      console.error("✗", item.name);
      console.error(error.stack || error);
    }
  }
  if (failed) process.exitCode = 1;
})();
