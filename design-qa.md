# Design QA · 婴儿成长工作台

## 当前页面架构

- Home：`public/assets/baby/final-screens/zh-CN/01-home-dynamic.png` 作为手绘数据底图，实时叠加日期、英文月龄、当前成长与照护数据。
- Memory：`public/assets/baby/final-screens/zh-CN/02-memory-book.png` 完整主视觉层。
- Growth：`public/assets/baby/final-screens/zh-CN/03-growth-curve.png` 完整主视觉层。
- Health：真实可滚动的动态页面；`04-health-record.png` 仅保留为视觉参考，不进入当前运行路径。
- Education：`public/assets/baby/final-screens/zh-CN/05-early-education.png` 完整主视觉层。
- Study：`public/assets/baby/final-screens/zh-CN/06-study-record.png` 完整主视觉层。

底部导航始终保持 Home / Memory / Growth / Health / Education / Study 英文标签。主产品语言为中文；功能词按上下文保留英文。

## Health · 唯一视觉基准与素材来源

- 三个 Health Tab 只以三张已批准的 v2 设计稿为视觉基准：`design/health-record-vaccine-interactive-v2.png`、`design/health-record-development-interactive-v2.png`、`design/health-record-checkups-interactive-v2.png`；不再混用旧版 Health 截图或另行生成的视觉方案。
- 页面复用的 8 个 `reference-v2` PNG 均从上述批准设计稿精确裁切、抠图取得，未重新生成：`health-vaccine-hero-reference-v2.png`、`health-development-hero-bear-reference-v2.png`、`health-development-hero-baby-reference-v2.png`、`health-checkup-hero-bear-reference-v2.png`、`health-checkup-hero-stethoscope-reference-v2.png`、`health-development-tummy-time-reference-v2.png`、`health-development-rollover-reference-v2.png`、`health-development-sitting-reference-v2.png`。
- 8 个素材均保存于 `public/assets/baby/`，并已加入离线缓存清单；没有用 CSS、占位图或新生成图片替代批准稿中的插画。

## Health · 三页真实实现与功能验收

- 疫苗、发育、儿保均为真实 DOM 组件，不是整张截图覆盖；三页共享固定顶部标题栏、固定三段 Tab 与固定英文底部导航，中间内容区域独立滚动。
- 疫苗页完整转录 43 条参考记录，按 16 个年龄段从“24小时内”到“6周岁”依次分组；每条展示年龄、疫苗名称、针次、完成状态与实际/计划接种日期，不展示价格。
- 每一针均有不小于 44 × 44 像素的点击区域。勾选后显示完成标记和实际接种日期；完成状态、日期及自定义记录持久化到本机，刷新后恢复。
- 4 组替代接种路径保留互斥保护；预置计划与用户新增记录分开处理，`+ Add`、编辑、删除均为真实交互。
- 发育页使用批准稿中的纵向里程碑日记结构，支持里程碑新增、编辑、删除、图片上传及同步到成长回忆；结构化数据与上传素材均持久化。
- 儿保页使用批准稿中的纵向儿保手册结构，支持儿保记录新增、编辑、删除、计划/已完成状态及完成日期；日期校验不会接受出生日期以前的记录。
- 数据迁移版本已落地：旧数据会一次性迁移到当前 Health 数据结构；两条出生当日的演示接种记录可安全清除，不会误删其余 43 条计划或用户真实记录；未来儿保预约不会被错误迁移为已完成。
- 发育记录同步到 Memory 前会校验来源、日期范围及同日同名重复项，避免生成无来源、出生日前或重复的成长回忆。

## Health · 本轮视觉与滚动复核

- 已在内置浏览器以 393 × 852 和 430 × 932 两种手机尺寸逐页截图，并把当前实现与对应批准 v2 设计稿同屏对照。
- 疫苗、发育、儿保三页的字体、标题与 Tab 层级、暖象牙纸色、手绘边框、卡片节奏、固定导航及插画位置均与统一设计系统协调；对照未发现阻断级视觉差异。
- 两种尺寸均未发现横向溢出、重复 Header/底栏或导航遮挡。疫苗页已实际滚动至“6周岁”末组，最后一条记录可完整查看与操作。
- 指针点击 Tab 和底部导航后不会残留与设计不一致的蓝色焦点框；键盘访问所需的焦点能力仍保留。

## 其他真实功能

- Home：顶部为本机当前日期 `YYYY.MM.DD 星期X`；固定出生日期为 2026-08-04，姓名下方英文月龄实时计算。当前体重与身高来自最新成长记录，出生值固定为 2.4 kg / 48 cm。
- Home：喂养显示最新记录相对当前时间；睡眠合并重叠区间后计算今日总时长；便便快速勾选会记录当前时间并增加今日次数；Vitamin D 可确认或取消今日状态；`Today's To-do` 保持英文并支持完整管理。
- Memory：All / Moments / Photos / Notes 管理；照片真实上传，记录可新增、编辑和删除。
- Growth：成长记录可新增、编辑和删除。
- Education：音乐上传、播放、暂停、续播和进度拖动；故事封面上传、预览和外链打开。
- Study：English / Chinese 学习卡管理，图片上传与系统发音可用。
- 结构化数据使用 `localStorage`；图片、封面和音频使用 IndexedDB。

## 响应式与交互检查

- iPhone 393 × 852：Health 疫苗页 43 条、16 组完整渲染，无横向溢出，滚动可到 6 周岁最后一条；固定导航不遮挡内容。
- 430 × 932：三个 Health Tab 均无横向溢出；标题、Tab、`+ Add`、复选框和日期输入保持合理触控尺寸与卡片间距。
- 内置浏览器实测：接种勾选/取消、三个 Health Tab、发育与儿保新增入口、六个底部主导航均为真实可交互元素。
- 动态 Health 页面在真实手机和 standalone 模式隐藏桌面预览机框与相机装饰；桌面预览继续保持居中设备预览。

## 构建与测试

- `npm run check:runtime`：通过，28 个受保护运行时文件完整。
- `npm run build`：通过，TypeScript、Vite 与 Sites 产物生成成功。
- `npm run test:runtime`：8 / 8 通过。
- `npm run test:sites`：4 / 4 通过。
- 项目没有独立 Lint 命令；未为本次修改引入新工具。
- 构建仅保留 Vite 大体积 chunk 提示，不影响当前功能。

final result: passed
