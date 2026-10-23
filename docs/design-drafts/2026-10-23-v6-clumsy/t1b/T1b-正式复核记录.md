# T1b 正式复核：视觉权威包 v6-authority-v1

2026-10-23 晚，Claude（接手会话）用 `$design-taste-frontend` 的视角，按 `visual-app-development-sop` 的 T1b 执行。对象是第 7、25 张重画交回、预审问题处理完之后的整份权威包。预审记录见同目录 `T1b-预审记录.md`。

## 方法

- 逐个打开清单里的核心成员看：标准屏修正版、组件板修正版、组件板·补充、`tokens.json`、`组件规范.md`、`assets.json` 和它登记的 22 个素材文件（素材另有三种底色的检查图）。
- 核对规范与图是否一致：凡是核心成员（标准屏、组件板、补充板）和规范冲突，要么改图，要么改规范；参考屏的偏差在规范第 7 节列明，以规范为准。
- 第 7、25 张重画逐字核对文字，并与 `../GPT重画提示词.md` 的要求对照。
- 对比度沿用预审的计算，改动后的值重算。
- 用脚本从原图重做全部派生，哈希与清单一致（复现方法见组件规范第 9 节）。
- 限制：
  - 整理权威包和复核是同一个会话做的，不是独立审查。
  - `$design-taste-frontend` 面向落地页，这里只用了它的通用规则（同预审）。
  - 字体渲染、触控、真机要到实现后的 T2 才能验证。

## 记录

```
Review stage: T1b implementation-readiness
Status: current
Reviewer: design-taste-frontend（由 Claude 接手会话执行）
Artifact evidence: authority/manifest.json（67 个成员）
Reviewed version/hash: v6-authority-v1，清单 sha256 dfb9ed84891d0f08a6e897b69bc27949ebc7969336bcafb19482119878b3bd26
Artifact maturity: high-fidelity（GPT 生成图 + 机械派生 + 规范）
Authority package manifest/version/hash: 同上；成员包括标准屏 derived/screen-1-home.fixed.png、组件板 derived/sheet-components.fixed.png 与 derived/sheet-components-supplement.png、tokens.json、组件规范.md、assets.json 及 22 个登记素材
Protected concerns: 技术栈、功能、数据规则、信息结构、内容含义、无障碍、QA 门；本次只处理视觉和规范层面
Design Read: 婴儿期家庭记录的微信小程序界面，给常浩自己用；拙趣手写语言，纸面、黑墨、淡蓝表示选中和进行中、浅绿表示唯一主动作，静态为主
Preserve:
- 一纸一墨两点缀，每种颜色只有一种含义
- 不用卡片、边框、阴影，靠留白分组；圆角有明文规则
- 状态写成字加纯黑记号；三种「没有」分开显示
- 出错不用红色、不打断，并说明写的东西还在
- 每一处派生都可追溯、可复现，没有新生成
```

### 预审发现的去向

| # | 发现 | 决定 | 状态 | 证据 |
|---|---|---|---|---|
| P1 | 占位字对比度 3.4:1 | accepted | resolved | 规范改用 ink-2；核心成员上的占位字也已改深（见下表 T2） |
| P2 | 深色时长标签 55% 时白字 4.2:1 | accepted | resolved | 改黑 60%（4.9:1），组件板已按 60% 重算 |
| P3 | 缺加载状态 | accepted | resolved | 规范 5.15，token photo-placeholder |
| P4 | 成长页还没测量时的写法 | accepted | resolved | 规范 5.10 |
| P5 | 圆按钮和记号在 3 倍屏上约放大 1.1–1.25 倍 | rejected（本阶段） | N/A | 放大幅度小；T2 真机上看，如果发虚再请 GPT 出高清版 |
| P6 | 实现时字用霞鹜文楷，手写味会变淡 | rejected（已有决定） | N/A | 常浩 10-23 的决定；T2 对比后再议区块标题 |
| P7 | 淡蓝小点也表示「正在留意」 | accepted | resolved | 常浩 10-23 原话「确认：淡蓝小点表示进行中的状态，『已约』和『正在留意』都用」，已写进规范 5.1 |
| P8 | 没有深色模式 | N/A（DEFERRED） | N/A | 规范第 8 节 |

### 本次新发现

| # | 发现 | 证据 | 处理 | 决定 | 状态 | 处理证据 |
|---|---|---|---|---|---|---|
| T1 | 照片比例不一致：组件板 235×222px、回顾页 235×245px 近正方，相册页 227×168px 是 4:3；规范原先照相册页写了 4:3，和更高一级的组件板冲突。原提示词写的也是正方 | 量测 | 规范和 token 改为正方 1:1；相册页列为参考屏偏差 | accepted | resolved | `tokens.json` photo-aspect；规范 5.9、第 7 节 |
| T2 | P1 只改了规范，组件板和补充板第 5 块上的占位字还是浅灰，核心成员与规范不一致 | 组件板「输入」、补充板第 5 块 | 按每个像素的墨量，把浅灰字换成同样墨量的 ink-2 | accepted | resolved | `derived/fix-log.json`、`derived/compose-log.json`、`evidence/placeholder-compare.png` |
| T3 | 组件板色点的颜色和 token 不同（灰点 #959595、白点偏暖） | 组件板「颜色」 | 不改图，规范第 2 节写明色点是水彩示意，色值以 token 为准 | accepted | resolved | 规范第 2 节 |
| T4 | 补充板第 1 块顶部截到半行被遮罩的字，看着像裁坏了 | 补充板第 1 块 | 裁切上沿移到 y=370，露出完整的被遮罩页面 | accepted | resolved | `derived/compose-log.json` |
| T5 | 第 7 张重画时，第三张照片也被换了（宝宝握着大人的手指），提示词要求保持不变 | screen-7 新版 | 不再重画：画面无风险，没有东西靠近嘴，不影响任何规则 | rejected（无需改） | N/A | `gpt-assets/生成记录.md` 重画一节 |
| T6 | 第 7、25 张交付的是对话附件 webp，有损压缩，比之前的 PNG 糊一些 | `gpt-assets/redraw-delivered/` | 不换：这两张只是参考屏，不是标准屏或组件板；如果以后要换原 PNG，清单哈希会变，需要重新批准 | rejected（本阶段） | N/A | 生成记录 |

对第 7、25 张重画本身的复核：
- 第 7 张：G1 已解决，时长标签深色、在左下。
- 第 25 张：G9、G3 已解决，五个类型名逐字正确，软尺淡蓝，只有一处浅绿。
- 两张的其他文字都和提示词逐字一致。

```
Deferred dimensions: 深色模式、成员与权限、早产两种月龄、满周岁后、照护细节、提醒方式（等路线问题）
Recommendation: READY_FOR_USER_APPROVAL
Next owner: 常浩 approval（批准清单 sha256 dfb9ed84891d0f08a6e897b69bc27949ebc7969336bcafb19482119878b3bd26）
Freshness: CURRENT for v6-authority-v1 / dfb9ed84891d0f08a6e897b69bc27949ebc7969336bcafb19482119878b3bd26
```

复核过程中最后一处改动是规范第 0 节的状态说明（把会过时的「还缺第 7、25 张」改成「状态以 manifest.json 和 HANDOFF.md 为准」，以及成员表里组件板一行的说明），不涉及视觉；清单哈希由 `2c441dad528d…` 变为上面的 `dfb9ed84891d…`，本记录对新哈希有效。

清单里任何成员一变，清单哈希就变，本记录随即失效，需要重新复核。
