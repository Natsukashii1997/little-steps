# Design QA · 婴儿成长工作台

## 当前页面架构

- Home：`public/assets/baby/final-screens/zh-CN/01-home-dynamic.png` 作为手绘数据底图，实时叠加日期、英文月龄、当前成长与照护数据。
- Memory：`public/assets/baby/final-screens/zh-CN/02-memory-book.png` 完整主视觉层。
- Growth：`public/assets/baby/final-screens/zh-CN/03-growth-curve.png` 完整主视觉层。
- Health：真实可滚动的动态页面；`04-health-record.png` 仅保留为视觉参考，不进入当前运行路径。
- Education：`public/assets/baby/final-screens/zh-CN/05-early-education.png` 完整主视觉层。
- Study：`public/assets/baby/final-screens/zh-CN/06-study-record.png` 完整主视觉层。

底部导航始终保持 Home / Memory / Growth / Health / Education / Study 英文标签。主产品语言为中文；功能词按上下文保留英文。

## Health · 疫苗页验收

- 已将用户提供的三张 2026 接种表完整转录为 43 条参考记录，按 16 个年龄段从“24小时内”到“6周岁”依次分组。
- 每条只展示年龄、疫苗名称和针次，不展示价格。
- 疫苗列表位于 `MobileScroll` 中，顶部标题、三个 Tab 与底部主导航固定；长内容可连续上下滚动，末条记录不会被底栏遮挡。
- 每一针均有 44 × 44 像素可点击勾选区。勾选后显示完成标记和实际接种日期；日期限制在出生日期至今天之间。
- 完成状态、实际接种日期与自定义疫苗记录保存在本机 `localStorage`，刷新页面或重新打开应用后仍会恢复。
- 4 组替代接种路径不会被误判为全部必打；当家庭已记录其中一种路径时，直接勾选冲突方案会被阻止并给出清晰提示。
- 预置 43 条计划作为时间参考，不允许误删或改坏；用户仍可通过 `+ Add` 新增、编辑和删除自己的补充记录。
- 到期提醒优先展示逾期项目，并排除未选择的替代路径；不存在用“43 条全部完成”误导家庭的百分比进度。
- 页面明确提示：计划仅作家庭记录参考，不含价格，实际接种以接种门诊评估与当地安排为准。
- Vaccines / Development / Checkups 三个 Tab 均为真实可切换页面；发育与儿保记录继续支持新增、编辑和删除。

## Health · 发育与儿保页验收

- Development 与 Checkups 已按 Vaccines 的同一设计系统重构：暖象牙再生纸底、手绘不规则墨线边框、低饱和黄/鼠尾草绿/蓝色点缀、统一 `var(--app-font)` 字体，以及一致的固定标题栏、Tab 和英文底部导航。
- Development 使用纵向里程碑日记结构，不再混入旧版横向摘要。每条展示日期、能力名称、说明、手绘示意图与“已同步到成长回忆”状态；点击整卡可编辑，`+ Add` 可新增，上传图片使用正常色彩与裁切，不套丝网混合效果。
- Development 的新增、编辑、删除及“同步到成长回忆”均复用真实数据链路；上传 JPG / PNG / WebP 后写入 IndexedDB，刷新后可恢复，资源缺失时回退到内置绘本插画。
- Checkups 使用纵向儿保手册结构，每条展示日期、项目名、计划/已记录状态和两行 Tips；点击整卡可编辑，`+ Add` 可新增，编辑器保留删除与持久化。
- 两页的介绍卡复用经内置 gpt-image-2 清理后的坐姿白熊、鸭子与植物素材；儿保记录的三张圆形示意图来自已选定的中文儿保视觉稿裁切，未用 CSS 或占位符临摹。
- 演示发育记录已调整为固定出生日期 2026-08-04 后、当前日期 2026-08-08 前的真实已发生里程碑；未来儿保项目明确显示“计划日期”，避免把预约当成已完成记录。
- 393 × 852 与 427 × 952 均完成同尺寸截图复核；页面无横向溢出、无双重系统栏、内容可滚动到末项，卡片与固定底栏不互相遮挡。
- 三页最终对比图位于 `qa/health-record-redesign-2026-08-08/`：`comparison-vaccine-393x852-final.png`、`comparison-development-393x852-final-v2.png`、`comparison-checkups-393x852-final-v3.png`。三张均将参考视觉与实现截图并排后再检查，未发现阻断级视觉差异。
- 发育与儿保卡片区域已用真实触控拖动复测：手指从整张记录卡起手仍可顺畅滚动，不会因卡片点击行为形成滚动死区。
- 儿保日期在表单与保存逻辑中均限制不得早于 2026-08-04；演示回忆也全部迁移到出生日期之后，避免出现出生前记录。

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
- Pixel 427 × 952：同样无横向溢出；标题、Tab、`+ Add`、复选框和日期输入均满足 44 像素触控高度。
- 真实浏览器实测：接种勾选、刷新后持久化、取消勾选、替代方案冲突保护、三个 Health Tab、六个底部主导航均正常。
- 动态 Health 页面在真实手机和 standalone 模式隐藏桌面预览机框与相机装饰；桌面预览继续保持居中设备预览。
- 最终控制台无新增 error 或 warning。

## 构建与测试

- `npm run check:runtime`：通过，28 个受保护运行时文件完整。
- `npm run build`：通过，TypeScript、Vite 与 Sites 产物生成成功。
- `npm run test:runtime`：8 / 8 通过。
- `npm run test:sites`：4 / 4 通过。
- 项目没有独立 Lint 命令；未为本次修改引入新工具。
- 构建仅保留 Vite 大体积 chunk 提示，不影响当前功能。

final result: passed
