# 首个切片 S1｜验证记录

授权：常浩 2026-10-23 23:37（原话见 HANDOFF.md 第 3 节）。隔离副本、虚构数据；不碰旧存储键和云端真实数据；不上传体验版、不发布；不改权威包成员。

截图放在本目录的 `batch-*/`，不进仓库（.gitignore 已排除 PNG）。

## 第 1 批：壳、底栏、首次启动、今天页头部（2026-10-23 23:37 开工，2026-10-24 00:08 记录）

### 改了什么

| 文件 | 做了什么 |
|---|---|
| `miniapp/miniprogram/app.json` | 注册 5 个新页面（today、stage、growth、album、setup），旧 5 页不再注册、文件保留；全局挂 v5 组件；背景改纸色 |
| `miniapp/miniprogram/app.js` | 只加载本机仓库和字体，不初始化云开发，不读旧存储键 |
| `miniapp/miniprogram/app.wxss` | 重写为 V6 token（颜色、三级字、间距、底栏留白）；旧样式在基线提交 be772db |
| `miniapp/miniprogram/config.js` | 加 `fontSources`（霞鹜文楷地址，留空用系统字体） |
| `lib/v5/age.js` | 月龄、月龄窗口、日期显示（出生日逐月推，短月取月末） |
| `lib/v5/repo.js` | 新存储键 `baby-workbench-v5`，写后回读，形状校验 |
| `lib/v5/font.js` | `wx.loadFontFace` 加载两个字重，失败回退系统字体 |
| `lib/v5/today-view.js` | 今天页头部显示规则（那句话、空状态、插画） |
| `components/v5/topbar` `tabbar` `action` | 页顶留白与返回；底栏「今天｜这个月｜成长｜相册」；主/次/选中动作与笔触 |
| `pages/v5/setup` `today` `stage` `growth` `album` | 首次启动；今天页头部＋记一笔圆按钮；其余三格只有页头（相册带空状态） |
| `assets/v5/` | 由 `scripts/v5-assets.py` 从权威包派生：插画缩到 3 倍屏尺寸并压成 256 色、标题字缩到墨迹高 168px、记号与圆按钮原样、笔触从 marks-highlight 切成 6 笔；来源哈希见 `assets/v5/derived.json`。合计 485 KB |
| `tests/v5-*.test.js` | 月龄、仓库、今天页视图的单元测试 |

### 测试（node 直接跑，不跑 npm run check / verify）

```
v5-age：通过 7，失败 0
v5-repo：通过 6，失败 0
v5-today-view：通过 4，失败 0
```

### 隔离运行

- 副本：`<scratchpad>/iso-miniapp`，`appid` 改为 `touristappid`（游客模式），去掉 `config.local.js` 和 `cloudfunctionRoot`；开发者工具 2.02.2608060，基础库 3.6.6，模拟器 iPhone 12/13 (Pro) 390×844，dpr 3。
- 自动化：`miniprogram-automator` 0.13.0（临时目录安装）走一遍：清空存储 → 首次启动 → 填名字「硕之」、出生 2026-08-04 → 开始 → 今天页 → 四格 → 改一改 → 重开。
- 结果（原样）：

```
存储回读 {"schemaVersion":5,"baby":{"name":"硕之","birthDate":"2026-08-04"},"records":[],"updatedAt":"2026-10-23T16:06:22.104Z"}
重开后 硕之 2 个月 20 天
控制台条目 0 错误 0
```

- 截图 `batch-1/`：01 首次启动空、02 填好、03 今天页空状态、04 名字 3 个字、05 月初、06 有那句话、07 这个月、08 成长、09 相册、10 改一改。04–06 是用 setData 换显示数据拍的版面，不是真实记录。
- 系统字体（PingFang）；霞鹜文楷还没加载（字体文件待常浩同意下载）。

### 发现与处理

- 页面进入时改为 `repo.load()` 从存储重读，不信任模块缓存（清空存储后仍显示旧数据，自动化里复现）。
- 今天页那句话的空状态文案改成两行「这个月，／还没有记录。」，和标准屏的两行节奏一致；插画宽 62%、文字最宽 52%。
- 隔离副本第一次打不开自动化：`project.config.json` 带 `cloudfunctionRoot` 而副本没有云函数目录，去掉后正常。

### 没做、没验

- 320 宽截图（自动化不能换模拟器机型，第 4 批用开发者工具手动切）。
- 霞鹜文楷的体积与加载时长。
- 真机。
- 记一笔弹层、这个月记的、成长·家里看到的（第 2、3 批）。
