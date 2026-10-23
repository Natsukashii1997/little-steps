# 变更记录｜婴儿工作台微信小程序

变更级别口径：L0 仅证据/文档，L1 局部样式，L2 交互/视觉结构，L3 产品规则/数据，L4 用户结果/范围。L2–L4 必须同步更新对应上游合同和旧证据状态。

| 日期 | 请求/事实 | 实际级别 | 影响的合同/代码/证据 | 失效或需更新的产物 | 重开门禁 | 决策人 | 状态 |
|---|---|---|---|---|---|---|---|
| 2026-08-25 | 初始化产品工作流 | L0 | 建立 `docs/product-workflow` | 无 | boundary | 系统 | 已记录 |
| 2026-08-25 | 冻结 Q1–Q205 需求：只做微信家庭体验版、固定单宝宝、6 位家人、不继续网页 | L4 | `00-project-brief`、结果/产品/交互合同 | 以前将网页、公众上架或复杂扩展视为本轮目标的描述失效 | outcome → acceptance | 常浩 | 已冻结 |
| 2026-08-25 | 固定宝宝为“硕之”，2026-08-04 出生，2.4 kg / 48 cm；换尿布与便便分离 | L3 | schema v3、迁移、首页、成长/健康、报告、自动化证据 | 旧 `diapers` 作为便便真值的假设失效 | product → acceptance | 常浩 | 代码/自动化完成，真机待验 |
| 2026-08-25 | 确立本地优先、分区同步、operationId 幂等、冲突证据、回收站/历史/墓碑 | L3 | `store/model/retention`、`familyApi`、七个集合合同、测试 | 整包快照作为新家庭的唯一权威方案失效，仅保留旧版兼容 | technical → acceptance | 常浩 | 代码/自动化完成，真实云待验 |
| 2026-08-25 | 确立 6 人上限、所有者/备用管理员/普通成员权限、停用成员服务端拦截 | L3 | `familyApi`、家庭面板、权限合同、Family API 测试 | “仅靠页面隐藏按钮就算验权”的证据无效 | product → vertical_slice → acceptance | 常浩 | Family API 16/16；真实 OPENID 待验 |
| 2026-08-25 | 确立备份/恢复/导出、最多 30 份、恢复前保护备份 | L3 | `familyApi`、保留服务、家庭面板、使用说明 | “JSON 可一键导入”和“备份包含媒体文件本体”的描述失效 | product → technical → acceptance | 常浩 | 代码通过；真实云媒体恢复待验 |
| 2026-08-25 | 手动备份口径收口：包含全部家庭记录和媒体引用，照片/音频本体仍在云存储 | L0（事实校正） | 产品、交互、技术、验收和交付文档 | 任何将备份描述为复制媒体文件本体的文字 | acceptance | Codex 根据真实实现校对 | 已更正 |
| 2026-08-25 | 将可重复控件收口为共享顶栏、底栏、Add 胶囊、撤销条，动态数据不烘焙进整屏图 | L2 | 六页共享组件、`app.wxss`、视觉合同与测试 | 各页重画同类控件与假输入法方案失效 | interaction → visual → acceptance | 常浩 | 静态通过，真机待验 |
| 2026-08-25 | 视觉权威冻结为已确认暖色纸张手绘体系，不重新生成方向 | L2 | 已有资产、共享组件、`06-visual-authority` | 再次用整屏生成图代替可交互页面的方案失效 | visual → acceptance | 常浩 | code-pass / device-check-pending |
| 2026-08-26 | 首页 14 天提醒和 Canvas 成长摘要长图纳入 P1 代码 | L3 | `pages/home`、`pages/report`、`lib/report.js`、对应测试 | “已有微信系统推送”的表述无效；只有应用内红点 | product → interaction → acceptance | 常浩 | 代码通过，真机保存/分享待验 |
| 2026-08-26 | 媒体物理清理前核对当前数据和全部可恢复备份引用；核对失败延后删除 | L3 | `getProtectedMediaReferences`、媒体保留、云接口与验收说明 | “当前页面没有引用即可直接删云文件”的假设失效 | technical → acceptance | 常浩 | 媒体 15 项、分区 API 10/10；真实云待验 |
| 2026-08-26 | 本机一键验证、非技术交付和微信侧边界收口 | L0 | `npm run verify`、`05`–`09`工作流文档、`design-qa.md`、体验版使用说明 | 任何将本机测试通过写成“真实云/真机已通过”的证据失效 | acceptance | Codex | 代码候选版；external_pending |
| 2026-08-27 | 彻底移除 Education／Study，主页面与底栏收口为 Home／Memory／Growth／Health 四项；数据合同升级为 schema v4 | L4 | `app.json`、共享底栏、页面/资产、Store/Model/Media、测试及 `00`–`09` 工作流文档 | 任何仍声称存在六页、早教音乐/绘本或中英学习卡的当前规格与验收证据失效；旧截图只保留为历史证据 | boundary → outcome → product → interaction → technical → visual → expansion → acceptance | 常浩 | 四页候选版开发中；旧数据字段不主动清空 |

## 当前变更冻结

- 代码候选版：`working-tree-code-candidate-2026-08-26`。
- 当前只接受：微信侧验收中可稳定复现的 P0/P1 修复。
- 当前停止：网页端、P2/P3 视觉打磨、公众上架、多宝宝/多家庭和复杂统计。
- 状态变更条件：完成真实 AppID、CloudBase、双账号、iPhone/Android 与媒体验收后，才能将 `RELEASE_CANDIDATE / external_pending` 改为家庭体验可用。
