# Design QA · 婴儿成长工作台

## 当前页面架构

- Home：`public/assets/baby/final-screens/zh-CN/01-home-dynamic-add-clean.png` 作为手绘数据底图，实时叠加日期、英文月龄、当前成长与照护数据；原图仅局部清除了烘焙 Add 按钮，其他像素布局保持不变。
- Memory：`public/assets/baby/final-screens/zh-CN/02-memory-book-home-paper-v1.png` 完整主视觉层；只将纸色机械匹配到 Home 基准，原始线稿、文字、照片和排版不变。
- Growth：真实可滚动的动态页面；`03-growth-curve.png` 仅保留为视觉参考，曲线与历史均由真实成长记录生成。
- Health：真实可滚动的动态页面；`04-health-record.png` 仅保留为视觉参考，不进入当前运行路径。
- Education：`public/assets/baby/final-screens/zh-CN/05-early-education-add-clean-home-paper-v1.png` 完整主视觉层。
- Study：`public/assets/baby/final-screens/zh-CN/06-study-record-add-clean-home-paper-v1.png` 完整主视觉层。

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
- 疫苗 Hero 已按本轮标注收口为三个互不侵入的区域：左侧 `疫苗接种 / 宝宝疫苗接种指南 / 已记录 X 条接种记录`，中间批准稿白熊素材，右下共享 `+ Add`。已经删除 `X 条时间参考`，不再出现双行统计与插画 / 按钮堆叠。
- 发育 Hero 继续复用批准稿中的白熊与爬行宝宝，未重新生成。`health-development-hero-bear-reference-v3.png` 与 `health-development-hero-baby-reference-v3.png` 仅机械清除了 v2 裁图外缘误带的相邻页面线条；插画组整体响应式左移，与真实 `+ Add` 胶囊保持清晰间距，同时不改变标题、副标题、统计信息或 Add 的交互。

## 全局纸色与纸纹 · Home 基准

- 唯一纸张基准是 Home 的 `01-home-dynamic-add-clean.png`。没有重新生图，也没有用全屏半透明色块覆盖插画；所有静态页调整均为保留原尺寸的机械纸色映射，原始 PNG 继续保留。
- Memory / Education / Study 分别使用 `02-memory-book-home-paper-v1.png`、`05-early-education-add-clean-home-paper-v1.png`、`06-study-record-add-clean-home-paper-v1.png`。源尺寸保持 862 × 1824、853 × 1843、853 × 1844，照片、黑墨线稿、彩色插画、文字和卡片边界未裁切或拉伸。
- 动态 Growth、动态 Health、六页共享顶部栏、六页共享底栏以及图片比例留白统一使用 `public/assets/baby/paper-texture-home-v1.png`；卡片层与黄色 `+ Add` 的既有层级纸纹保持不变，避免把全页压成同一平面。
- Service Worker 缓存版本提升为 `v8-home-paper-system`，新纸纹与三张 Home-paper 页面资产均加入离线清单；本地构建后不会继续读取旧缓存版本。

## 其他真实功能

- Home：顶部为本机当前日期 `YYYY.MM.DD 星期X`；固定出生日期为 2026-08-04，姓名下方英文月龄实时计算。当前体重与身高来自最新成长记录，出生值固定为 2.4 kg / 48 cm。
- Home：喂养显示最新记录相对当前时间；睡眠合并重叠区间后计算今日总时长；便便快速勾选会记录当前时间并增加今日次数；Vitamin D 可确认或取消今日状态；`Today's To-do` 保持英文并支持完整管理。
- Memory：All / Moments / Photos / Notes 管理；照片真实上传，记录可新增、编辑和删除。
- Growth：成长记录可新增、编辑和删除；双轴曲线使用全部真实记录并在数据变化后即时重绘，固定出生记录不可删除。
- Education：音乐上传、播放、暂停、续播和进度拖动；故事封面上传、预览和外链打开。
- Study：English / Chinese 学习卡管理，图片上传与系统发音可用。
- 结构化数据使用 `localStorage`；图片、封面和音频使用 IndexedDB。

## Home · 四张照护卡排版复核

- 以 `design/home-system-visual-v3.png` 的 2 × 2 卡片节奏为排版基准，继续使用 `public/assets/baby/final-screens/zh-CN/01-home-dynamic-add-clean.png` 的中文标题、图标、手绘边框与纸张质感；除旧 Add 按钮的局部无痕清理外，没有重绘底图。
- 喂养、睡眠、便便、健康不再由九块互不关联的全页坐标叠加，而是各自使用与卡片外框同尺寸的局部布局容器。左右列宽、标题右侧安全区、数据基线和下排行为区统一。
- 喂养相对时间使用紧凑的中文日 / 小时 / 分钟表达并固定单行；三条明细使用等距网格与红、蓝、黄识别点。睡眠的最近区间与今日总时长共用同一左基线。
- 便便与健康卡使用相同的上下两层信息结构：上层为最新状态，下层为统计 / 确认操作。视觉复选框保持克制，但真实按钮命中高度不小于 44 px。
- 卡片背景空白区域仍打开对应记录列表；便便快速记录与 Vitamin D 确认按钮继续使用原有实时数据、持久化及无障碍状态，视觉重排没有改写业务逻辑。
- 内置浏览器在 iPhone 393 × 852 与 Pixel 10（427 × 952，覆盖 430 级宽屏）检查均无动态文字溢出、孤字换行或横向滚动；四卡与下方 `Today's To-do` 未发生遮挡。
- 用户在本轮复核中进一步发现下排短卡仍沿用了上排长卡的百分比纵向坐标，导致动态“最新记录 / Vitamin D”压到背景图自带的“便便 / 健康”标题。问题证据保存在 `qa/home-cards-2026-08-09/user-reported-overlap.png`。
- 本轮只调整动态覆盖层，不改底图和业务数据：便便摘要改为标题下方的单行双列区，健康摘要改为标题与虚线之间的两行区，两张卡的操作区统一下移并保留不小于 44 px 的真实触控高度；喂养与睡眠布局保持不变。
- 修复后的精确 393 × 852 运行截图为 `qa/home-cards-2026-08-09/393-home-after.png`；重点截图为 `qa/home-cards-2026-08-09/home-cards-after.jpg`，完整桌面运行截图为 `qa/home-cards-2026-08-09/full-after.png`，Pixel 宽屏截图为 `qa/home-cards-2026-08-09/pixel-full-after.png`。393 与 430 两档均测得摘要区、详情 / 操作区重叠面积为 0，所有动态块完整包含在卡片内，无截断或横向滚动。
- 交互回归：卡片空白区域仍可打开便便 / 补剂记录列表；便便“记录”与 Vitamin D“点击确认”仍由独立真实按钮处理，不会误触卡片详情。浏览器控制台无新增 warning / error。
- 第二轮按用户标注完成内容基线统一：`Vitamin D` 与便便“最新记录”首行在 393 / 430 两档均为 0 px 高差；睡眠“今日总时长”、便便“今日 X 次 / 记录”全部左对齐；健康的“今天已 / 未服用”和“已确认 / 点击确认”均移到虚线下，并作为同一个 44 px 高真实按钮的两行内容左对齐。
- 第二轮精确截图：`qa/home-cards-2026-08-09/393-home-aligned-v2.png`、`qa/home-cards-2026-08-09/430-home-aligned-v2.png`。两档页面宽高严格等于视口，四卡无裁字、重叠或横纵溢出，console / pageerror 均为 0。
- 第三轮按用户提供的两列样式调整虚线下内容：便便为左列“今日 X 次”、右列“记录 + 方框”，健康为左列“今天已 / 未服用”、右列“确认 + 方框”；两列间距 6 px，文字均位于复选框之前。393 / 430 两档无重叠与溢出，对照截图为 `qa/home-cards-2026-08-09/393-home-aligned-v4.png`、`qa/home-cards-2026-08-09/430-home-aligned-v4.png`。
- 第四轮将姓名下方英文月龄、喂养相对时间和睡眠最近时段统一为低饱和暖红 `#c96050`、透明度 `0.9`；喂养与睡眠信息使用较轻的 `font-weight: 400`，与黑色标签形成清晰但克制的主次层级。最终 393 / 430 对照截图分别为 `qa/home-cards-2026-08-09/393-home-final-v5.png`、`qa/home-cards-2026-08-09/430-home-final-v5.png`。

## 全局顶部栏与底部导航 · 最终统一验收

- 视觉基准：`design/home-system-visual-v3.png` 的顶部日期 / 操作区与底部 Home / Memory / Growth / Health / Education / Study 导航；Health 页面继续以 `design/health-record-vaccine-interactive-v2.png`、`design/health-record-development-interactive-v2.png`、`design/health-record-checkups-interactive-v2.png` 校验内容区。
- 浏览器实现截图：`qa/unified-chrome-2026-08-09/393-home.png`、`393-memory.png`、`393-growth.png`、`393-health.png`、`393-education.png`、`393-study.png`。截图均为内置浏览器直接捕获的 393 × 852 PNG，CSS 视口 393 × 852、deviceScaleFactor 1；`[data-testid="device-screen"]` 实测同为 393 × 852，没有浏览器外框或密度缩放干扰。
- 全页与重点区域对照：已把 Home 源视觉与 `393-home.png`、Health 疫苗源视觉与 `393-health.png` 同轮并排复核；并分别放大检查六页标题栏、左右操作区、底栏图标、英文标签、选中态和分隔线。视觉源与实现的暖象牙纸色、手绘线条、图标资产、字体气质和留白节奏一致。
- 六页只渲染一套真实顶部栏和一套真实底栏。393 × 852 下顶部栏统一为 64 px、底栏统一为 70 px；430 × 932 下顶部栏统一为 66 px、底栏统一为 80 px。393 下页面 `scrollHeight = 852`、`scrollTop = 0`，不存在此前底栏按钮溢出导致的 4 px 页面上移或底部空白。
- 非首页标题均使用同一字体、字重、行高和等宽左右栏：393 下标题槽几何中心为 x = 196.5，430 下为 x = 215；Growth / Health / Education / Study / Memory 的字号和中心线一致。Home 日期沿用较小字号以容纳 `YYYY.MM.DD 星期X`，但与天气、通知和分享保持同一水平线。
- 底栏六个入口统一复用同一组 `nav-*.png` 图标、英文标签、虚线分隔和黄色选中底纹；393 与 430 两种尺寸均未出现旧图片底栏泄漏、双导航、选中态偏移或点击后蓝色焦点残留。Memory 的特殊原图比例由同一暖纸色遮罩完整收口。
- 顶部交互为真实控件：返回、通知、分享 / 报告均可操作；Memory 保留唯一一个真实 `+ Add` 入口，原图中的旧透明新增热区已取消，键盘顺序中不会出现重复按钮。
- 比较历史：首轮发现 393 宽度下底栏按钮高于容器 4 px，切页后页面上移且留白；已改为按钮继承底栏实际高度并复测。首轮还发现点击后焦点框残留；已只在指针操作后释放焦点，同时保留键盘 `:focus-visible`。修复后六页 393 / 430 / 桌面居中预览均无 P0 / P1 / P2 问题。
- 当前代码与截图仅保留在本地验收版，尚未提交、推送或更新公开分享地址，符合本轮“先检查、后同步”的交付边界。

## 响应式与交互检查

- iPhone 393 × 852：Health 疫苗页 43 条、16 组完整渲染，无横向溢出，滚动可到 6 周岁最后一条；固定导航不遮挡内容。
- 430 × 932：三个 Health Tab 均无横向溢出；标题、Tab、`+ Add`、复选框和日期输入保持合理触控尺寸与卡片间距。
- 内置浏览器实测：接种勾选/取消、三个 Health Tab、发育与儿保新增入口、六个底部主导航均为真实可交互元素。
- 动态 Health 页面在真实手机和 standalone 模式隐藏桌面预览机框与相机装饰；桌面预览继续保持居中设备预览。

## Growth · 真实曲线与统一 Add 验收

- Growth 已退出静态整页 PNG 运行路径，改用真实 DOM + Recharts 双轴曲线；共享顶部栏、共享英文底部导航与 Health 的固定 chrome 结构保持一致，没有旧图片热点或双层导航残留。
- Profile 与 Home 共用固定出生源：2026-08-04、2.4 kg、48 cm；当前月龄按本机日期实时计算。历史演示数据若早于出生日期会在 demo 迁移中被清理，不覆盖用户真实记录。
- 曲线绘制全部有效 `growthRecords`，仅横轴文字按最多 5 个日期稀疏显示；新增、编辑后曲线点、路径、历史行和记录数均即时变化，删除后同样回算。固定出生记录保持不可删除。
- 成长记录按钮已从 `+ Add Record` 收口为严格的 `+ Add`。Home、Memory、Growth、Health 三个 Tab、Education 与 Study 的主页面新增入口全部共用 `.app-add-button`：393 宽下 68 × 44 px 真实触控框、约 60 × 27 px 可见规则胶囊，胶囊宽高比约 2.2:1，Gaegu 14/400、1.5 px 黑色墨线、低饱和黄色纸纹；430 宽下按同一比例轻微放大。Home、Education、Study 使用仅移除原图旧按钮的 `*-add-clean.png` 底图，再绘制同一个真实组件，因此没有双轮廓、底线残影、纸色遮罩或光晕接缝。
- 内置浏览器 393 × 852 与 430 × 932 均验证通过：每页只有一套 Header / Footer，无横向溢出；2 条记录对应 4 个曲线点，新增第 3 条后即时变为 6 点，编辑后两条曲线路径同步变化。截图位于 `qa/growth-live-2026-08-09/393-growth-live.png`、`qa/growth-live-2026-08-09/430-growth-live.png`；同屏参考对照为 `qa/growth-live-2026-08-09/reference-vs-live.png`。
- 当前 Growth、Home 与统一 Add 的改动只保存在本地验收版，尚未提交、推送或更新公开分享地址。

## 2026-08-09 · 本地最终回归

- 运行证据保存在 `qa/final-regression-2026-08-09/`：393 × 852 与 430 × 932 两档均包含 Home / Memory / Growth / Health / Education / Study 六页实机截图及 `computed.json`。
- 疫苗 Hero 的主标题、副标题、单行统计、批准稿白熊素材、完整 `+ Add` 触控区与可见胶囊两两交叠面积均为 0；统计严格只显示 `已记录 X 条接种记录`，点击新增入口会打开唯一的“新增疫苗记录”表单。
- 发育 Hero 严格复用批准稿中的白熊和爬行宝宝：v3 资产仅机械移除原裁图右侧误带的相邻页面残片，主体可见像素与 v2 逐像素一致。插画按批准稿比例响应式排为“白熊左下、宝宝右上、真实 `+ Add` 右下”，393 / 430 两档均无可见压叠；点击新增入口会打开唯一的“新增能力里程碑”表单。最终截图位于 `qa/development-hero-2026-08-09/393-development-hero-final-v10.png` 与 `qa/development-hero-2026-08-09/430-development-hero-final-v10.png`。
- 六页主体、共享顶部栏和共享底部栏均命中 Home 纸张基准；393 / 430 两档未见色块、纹理断层、旧按钮露边、双线、光晕或纸色接缝。
- 六页两档均满足 `document.scrollWidth === clientWidth`，无横向溢出；应用 console warning / error 与 pageerror 均为 0。
- 本轮仅完成本地验收版，没有提交、推送或更新现有公开分享地址。

## 构建与测试

- `npm run check:runtime`：通过，28 个受保护运行时文件完整。
- `npm run build`：通过，TypeScript、Vite 与 Sites 产物生成成功。
- `npm run test:runtime`：8 / 8 通过。
- `npm run test:sites`：4 / 4 通过。
- 项目没有独立 Lint 命令；未为本次修改引入新工具。
- 构建仅保留 Vite 大体积 chunk 提示，不影响当前功能。

final result: passed
