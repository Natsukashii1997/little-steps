# 01: 建立可信质量门禁与唯一契约

**What to build:** 修复会掩盖异步失败的测试入口，冻结领域术语、需求、视觉权威与公共测试 seam，让后续每个切片都能用一个可靠命令判定红绿。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `npm test` 会等待所有异步测试并在任何失败时返回非零。
- [ ] 日期边界测试使用可注入/明确时钟，不随自然日期失效。
- [ ] 规格、术语、视觉来源和测试 seam 在仓库中只有一份权威说明。
