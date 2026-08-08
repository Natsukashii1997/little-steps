# Design QA · 六张最终页面图与真实功能验收

## 唯一视觉来源

- Home：`public/assets/baby/final-screens/01-home.png`（853 × 1844）
- Memory：`public/assets/baby/final-screens/02-memory-book.png`（862 × 1824）
- Growth：`public/assets/baby/final-screens/03-growth-curve.png`（853 × 1844）
- Health：`public/assets/baby/final-screens/04-health-record.png`（853 × 1844）
- Education：`public/assets/baby/final-screens/05-early-education.png`（853 × 1843）
- Study：`public/assets/baby/final-screens/06-study-record.png`（853 × 1844）

六张文件从 `baby-app-ui-final-6-screens.zip` 原样复制，保留 PNG 格式；源文件与项目副本逐一通过 SHA-256 一致性校验。旧 DOM 页面和旧素材未删除，但已退出六个主页面的运行时视觉路径。

## 实现范围

- 六个主页面统一渲染为完整页面 PNG，不再叠加旧 Header、卡片或可见底部导航。
- 图片水平居中、顶部对齐、保持原始宽高比，并使用 `object-fit: contain`；未使用 `cover`、裁切、拉伸、圆角、阴影或设备外框。
- 页面底色为暖象牙色 `#f6f0e2`；图片禁止拖拽和选择。
- 底部六个透明热区按 Home、Memory、Growth、Health、Education、Study 固定顺序复用原页面状态切换；每个入口含正确的 `aria-label` 与 `aria-current`。
- Memory、Growth、Health、Education、Study 的左上返回热区可回到 Home。六张图中具备明确操作含义的按钮、卡片、Tab、播放键、复选框和编辑入口均已覆盖真实点击热区，并复用项目现有业务数据与处理逻辑。
- 受保护的 Mobile Runtime 文件未修改；仅在最终图片页面作用域内隐藏额外系统栏、Home Indicator 和设备边框，避免重复视觉。桌面预览保留运行时模拟光标，便于看清移动位置和点击反馈。

## 真实功能范围

- Home：通知、宝宝基本报告预览/分享/下载、宝宝资料和照片上传、喂养/睡眠/尿布/补剂记录的新增编辑删除、补剂打卡，以及待办的新增、完成、编辑、删除。
- Memory：All / Moments / Photos / Notes 分类管理；新增、详情、编辑、删除；Photos 支持真实本地照片选择与上传。
- Growth：完整生长记录管理；新增、编辑、删除体重、身高和备注，不再只绑定图片中前三条示例记录。
- Health：Vaccines / Development / Checkups 三类资料管理；新增、编辑、删除；能力记录继续同步到 Memory 里程碑。
- Education：Music / Stories 两个资料库；音乐支持本地音频上传、播放、暂停、原位置续播和进度拖动；故事支持封面上传、资料库封面预览与真实外部链接跳转。
- Study：English / Chinese 两个学习库，每页可管理 15+ 张学习卡；支持图例上传、增删改和系统语音朗读/停止。
- 数据保存在浏览器本机：结构化记录使用 `localStorage`，上传的图片与音频使用 IndexedDB；刷新后仍可读取。
- 本地持久化数据按记录类型逐条校验；日期与日期时间做严格日历语义校验，异常或旧损坏记录会被安全忽略，所有日期展示函数另有不可解析值回退，不会导致白屏。
- 正在播放或暂停的音乐被重新上传替换时，旧播放器与进度会立即重置，下一次播放必定使用新音源。
- 弹层编辑、删除确认和资料库管理之间保留返回上下文；关闭弹层后键盘焦点恢复到原操作入口。

## 尺寸与视觉对照

已在真实运行页面逐页检查：

- iPhone：393 × 852。
- 精确响应式检查：430 × 932（临时 QA 尺寸覆盖，检查后已移除，不进入生产代码）。
- 项目生产 Android 预设：427 × 952。
- 桌面移动端预览：1280 × 720 浏览器画布，设备页面居中且不向宽屏拉伸。

六页在以上尺寸均无横向滚动、图片裁切、比例变形、异常白边、双重 Header、双重底栏或旧页面残留。Memory 与 Education 因原图纵横比不同，底部少量剩余区域使用同色纸张背景承接，不裁切、不放大。

参考图与运行页使用同尺寸并排检查；静态交付截图在指针移出页面后采集，因此不包含动态光标。实际操作态保留运行时模拟光标，不改变底图布局、比例或视觉内容。最终复核无 P0 / P1 / P2 布局问题。

## 交互与运行检查

- 六个底部入口全部实测可双向切换，当前页高亮完全由图片自身呈现，不生成第二套可见导航。
- 五个非 Home 页面返回热区均实测可回到 Home。
- 每页恰好存在六个透明主导航按钮和一个 `aria-current` 入口。
- 每次切换均加载正确文件路径及正确 PNG 原始尺寸。
- 使用真实文件完成 Memory 照片上传、Education 音频上传与播放/暂停；测试数据随后已删除。
- 实测完成 Todo、Growth、Health、Memory、Education、Study 的新增、编辑、删除闭环；管理器分类切换和关闭返回行为正确。
- 实测故事外链打开正确目标，Study 英文发音可开始并停止。
- 实测通知弹层关闭后焦点回到通知入口，主页面切换后焦点落在当前导航入口。
- 控制台最终检查无新增 error 或 warn。
- 桌面预览中模拟光标已实测可随鼠标在页面内移动；六个透明底部入口在光标恢复后仍全部切换成功。
- QA 证据目录：`qa/final-six-screen-delivery-2026-08-08/`，包括 393 × 852、430 × 932、六页联系表及逐页参考图并排对照。

## 构建与测试

- `npm run check:runtime`：受保护运行时完整性通过。
- `npm run build`：TypeScript 与 Vite 生产构建通过。
- `npm run test:runtime`：8 / 8 通过。
- `npm run test:sites`：4 / 4 通过。
- 项目没有独立 Lint 命令；未为本任务新增工具。类型检查由 `npm run build` 中的 `tsc` 完成。

## 手机安装与离线交付

- 已加入正式 Web App Manifest、180 / 192 / 512 像素应用图标、iOS 主屏幕元信息和 Service Worker。
- iPhone Safari 与 Android Chrome 均可从生产地址“添加到主屏幕 / 安装应用”，以独立应用窗口和竖屏模式运行。
- 首次联网完整打开后，应用壳、六张正式页面图、字体与构建资源进入离线缓存；后续可在断网时重新打开主页面。
- 真实手机与 standalone 模式移除桌面预览外壳，使用 `100dvh` 铺满屏幕；桌面预览仍保留设备框、选择器和模拟光标。
- 393 × 852 应用内浏览器实测：页面尺寸与视口一致，页面滚动宽高均无溢出，六个主导航逐一切换成功，真实待办管理器可打开，控制台 error / warn 为 0。
- `dist/client/manifest.webmanifest`、`dist/client/sw.js`、主屏图标、六张页面图、`dist/server/index.js` 和 `dist/.openai/hosting.json` 均已进入生产构建。

final result: passed
