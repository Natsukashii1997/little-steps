# 现有实现盘点独立证据

2026-08-25 只读盘点结论（历史基线）：

- 当时已有 Home、Memory、Growth、Health、Education、Study 六个原生小程序页面。
- 已有共享 app-header、app-tabbar、add-pill，原生 input、textarea、picker 与 checkbox。
- 已有本机真实持久化、可选 CloudBase 家庭快照、滚动备份与 owner 恢复。
- 已有 43 条疫苗数据、成长图表真实派生、媒体选择与本机/云端保存。
- 当前缺口：家庭上限为 5；便便与换尿布混用 `diapers`；删除不可恢复；同步为整包快照；没有独立提醒/报告；测试聚合器可能掩盖异步失败。
- 审计过程没有修改业务文件和真实数据。

## 2026-08-27 产品决策更新

- Education 与 Study 已决定彻底退出产品范围；上面的六页描述只用于说明删除前基线，不代表当前实现。
- 当前产品只保留 Home、Memory、Growth、Health 四个主页面，底栏四项等宽排列。
- 现行规格以同目录的 `00-project-brief.md`、`01-outcome-contract.md`、`02-product-contract.md`、`03-interaction-contract.md` 为准。
