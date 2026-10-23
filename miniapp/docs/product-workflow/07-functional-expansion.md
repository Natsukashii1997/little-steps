# P0 扩展结果｜婴儿工作台微信小程序

## 本阶段边界

- 本次 P0 能力：真实日常照护记录；换尿布与便便分离；成长、健康与回忆内容；6 人家庭、权限、本地优先与分区同步；软删除、撤销、回收站、备份/恢复/导出；真实原生表单与统一 App Shell。
- 已完成但仍需真机验收的 P1：首页提醒、Canvas 成长摘要长图、320/375/393/430 等效宽度、媒体和系统权限。
- 明确不进入本阶段的 P2：医学百分位、复杂统计、多宝宝、多家庭切换、公众用户、支付、正式提审和网页端继续开发。
- 复用模式：共享 Store + 分区同步 + `familyApi` 服务端权威 + 共享 `app-header/app-tabbar/add-pill/undo-bar` 组件。

## P0 完成矩阵

| 结果/能力 | 实现位置 | 正向场景 | 负向/边界场景 | 跨页面一致 | 回归证据 | 状态 |
|---|---|---|---|---|---|---|
| 日常照护与真实统计 | `pages/home`、`lib/model.js`、`lib/derive.js`、`lib/store.js` | 新增/编辑喂养、睡眠、换尿布、便便、Vitamin D、待办 | 无效日期、重复点击、跨午夜睡眠、重叠时段 | 首页卡片、编辑器和报告读取同一记录 | `core`、`page-data-rules`、`store-public` | 代码完成；真机待验 |
| 成长曲线与健康记录 | `pages/growth`、`pages/health`、`lib/validation.js` | 成长记录驱动折线图；疫苗、发育、儿保真实保存 | 同日重复、越界数值/日期、取消接种确认 | Home、Growth、Health 使用唯一宝宝资料和业务集合 | `growth-health`、`core` | 代码完成；真机待验 |
| 回忆与媒体 | `pages/memory`、`lib/media.js` | 文字/最多 9 图/单音频的真实新增与编辑 | 空内容、超大文件、取消、上传失败、无用临时媒体 | 媒体引用、删除和保留规则由共享服务处理 | `memory-content`、媒体保护、`page-undo` | 代码完成；真实相册/音频待验 |
| 6 人家庭、权限和同步 | `lib/store.js`、`cloudfunctions/familyApi/index.js`、七个云集合合同 | 创建/加入、离线写入、联网同步、备用管理员 | 第 7 人、非成员、停用成员、降权旧会话、重放操作、同字段冲突 | 四页共享 Store，云端 manifest/partitions 是权威 | `family-ui`、`store-public`、`family-api`、`family-partition-api` | 代码完成；真实云/双账号待验 |
| 删除、迁移、保留、备份和恢复 | `lib/retention.js`、`lib/store.js`、`familyApi` | 5 秒撤销、30 天回收站、90 天历史、手动备份、保护备份和恢复 | 旧 schema、旧 `diapers`、损坏/跨家庭/旧版备份、恢复中断 | 所有页面删除和撤销使用同一保留规则 | `migration`、`home-trash`、`retention*`、`runtime-retention`、`family-api` | 代码完成；真实云恢复待验 |
| 统一原生 UI 与真实交互 | `components/**`、`app.wxss`、四个主页+报告页 | 统一顶/底栏、Add 胶囊、撤销条、原生表单和 Canvas | 无假键盘、无透明热点、无动态数据整屏烘焙 | 四个主页使用共享 App Shell | `visual-contract`、`scripts/check-miniapp.mjs`、`report-page` | 静态通过；真机渲染待验 |

## 共享实现与一致性

- 复用的共享组件/服务/规则：`app-header`、`app-tabbar`、`add-pill`、`undo-bar`；`store/model/derive/validation/media/retention/report/layout`；`familyApi` 和分区同步合同。
- 未建立平行数据真值：首页摘要、成长图、健康统计、提醒和报告都从共享 Store 中的实际记录派生；云协作以 manifest + partitions 为权威。
- 真实权限与事务边界：代码上的服务端重验、停用成员拦截、幂等、备份校验和原子恢复已通过内存云测试；真实 CloudBase 事务尚未运行。
- 备份语义：手动备份包含全部家庭记录和媒体引用；照片/音频文件本体仍在云存储，需另行保全。
- 媒体清理保护：`getProtectedMediaReferences` 会汇总当前家庭数据和所有可恢复备份中的 `cloud://` 引用；核对失败时本次延后物理删除，避免误删备份仍需的文件。
- 当前剩余代码层 P0：0（以当前自动化范围计）。
- 当前剩余外部验收阻塞：真实 AppID、云环境、开发者工具编译、双账号、iPhone/Android 以及真实媒体权限。

## 当前版本与确认

- 版本或哈希：`working-tree-code-candidate-2026-08-26`
- 需求基线确认人：常浩。
- 代码候选版验收确认：尚未完成。
- 当前状态：P0 代码扩展完成，等待微信侧验收；不宣称 COMPLETE。
