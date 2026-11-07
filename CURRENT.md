# 当前状态

更新：2026-11-07。Little Steps 育儿记录已转为活跃项目（数字分身名册 v1.3）：目录挪进正式项目目录，补了协作骨架，建了 GitHub 私有仓库。产品停在 10-24「内容表 2–3、3–4 月龄转正式」之后（见 [HANDOFF.md](HANDOFF.md)）。唯一下一步：常浩定下一个切片做什么，再按 HANDOFF 接着做。

## AGENTS 补「AI 接入」一节（2026-11-07，Claude，常浩定全局规则 P-13 后母会话派来，常浩看过计划说「按计划开工」；已提交到 `claude/1-ai-access`、PR 待合并、无需发布）

- 时间：开工 `2026-11-07 23:33`（`date '+%F %H:%M'` 记录）。★ 来由：全局规则 P-13 要求每个应用在设置里讲清 AI 接入；本应用没有 AI 功能，按例外只在 AGENTS.md 写声明（issue #1）。
- 改了哪些文件：`AGENTS.md`（文末加「AI 接入」一节：本应用当前不调用 AI；数据对象无；对外开放无；`.openai/hosting.json` 和 `gpt-assets/` 不算 AI 接入；第一次加 AI 功能时按 P-13 补设置栏）；本文件。
- 测试：`npx tsc --noEmit` 无输出、退出 0；`node --test tests/*.test.mjs` 原样结果 `ℹ pass 8` / `ℹ fail 0`；`node scripts/check-rules.mjs` 输出 `通用规则检查通过`。新 worktree 里第一次跑是 `ℹ fail 1`（`sites-worker` 找不到 `dist/client/index.html`），先 `npm run build` 再跑才全过。
- 验证：只读核实了 `src/`、`worker/`、`miniapp/miniprogram/`、`miniapp/cloudfunctions/familyApi`（只依赖 `wx-server-sdk`）、`scripts/`，没有 AI 调用。
- 截图：无。
- 发布与回读：无需发布。
- 与授权不一致之处、遗留问题、范围外发现：① 全新 worktree 要先 `npm run build` 测试才能全过，AGENTS 的测试命令里没写这一步，本轮没改。② 主目录那批没跟踪的文件照旧没动。
- 本轮新坑：无。

## 转为活跃：挪目录、补协作骨架、建私有远端（2026-11-07，Claude，常浩说「Little Steps 调为活跃、建 GitHub 仓库」，选「照原样推私有库」「挪到 work/little-steps」；已提交并推送、无需发布）

- 时间：开工 `2026-11-07 19:55`（`date '+%F %H:%M'` 记录）。来由：常浩看过全量项目盘点后，把 Little Steps 从「只登记」调为活跃。
- 改了哪些文件：
  - 目录从 `~/Documents/AI 项目/baby-care-workbench` 挪到 `~/Documents/ChatGPT/个人/work/little-steps`（挪前查过：没有 launchd 任务和别的配置引用旧路径，只有数字分身名册，已在名册 v1.3 改掉）。
  - `AGENTS.md`：issue 看板改为 GitHub；末尾加「协作骨架」一节（目录、远端、私有约束、测试命令）。`docs/agents/issue-tracker.md` 换成 GitHub 版。
  - 用「项目起步」补铺：`CURRENT.md`（本文件）、`docs/LESSONS.md`、`docs/OPERATIONS.md`、`docs/templates/handoff.md`、`tests/handoff-format.test.mjs`、`scripts/check-rules.mjs`（扫 `src`、`server`、`worker`、`miniapp`，`server` 留给自测样本；`ALLOWED_DEPS` 列入项目已有的全部依赖）与 `tests/check-rules.test.mjs`、`.github/pull_request_template.md`。
- 测试：`npx tsc --noEmit` 无输出、退出 0；`node --test tests/*.test.mjs` 原样结果 `ℹ pass 8` / `ℹ fail 0`；`node scripts/check-rules.mjs` 输出 `通用规则检查通过`。端到端 `npx playwright test` 未跑通：本机没装 Playwright 的 chromium（`Executable doesn't exist … chromium_headless_shell-1228`），装浏览器要下载，本轮没做。
- 验证：推送后 `gh repo view` 回读为私有，远端 main 与本地一致。
- 截图：无。
- 发布与回读：无需发布。
- 与授权不一致之处、遗留问题、范围外发现：工作区里原有一批没跟踪的文件没动、没入库：6 个打包 zip 与 sha256、两份复盘文档（《视觉与真实应用开发错误清单-52条-v1》《视觉驱动移动应用开发复盘与SOP-v1》）、`public/assets/baby/icon-poop.png`、`docs/handoff/slice-1/batch-1/`、`docs/handoff/slice-1/batch-3/console.json`，要不要入库由常浩定。GitHub 上旧的 `little-steps-private` 是 8 月的打包成品，不是源码，仍在可删清单里。微信开发者工具里如果按旧路径导入过 `miniapp`，要重新导入。
- 本轮新坑：无。
