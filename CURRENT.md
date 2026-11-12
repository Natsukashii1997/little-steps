# 当前状态

当前阶段目标：暂停，等常浩定下一个切片。（2026-11-08 常浩确认，digital-twin#114）

更新：2026-11-07。Little Steps 育儿记录已转为活跃项目（数字分身名册 v1.3）：目录挪进正式项目目录，补了协作骨架，建了 GitHub 私有仓库。产品停在 10-24「内容表 2–3、3–4 月龄转正式」之后（见 [HANDOFF.md](HANDOFF.md)）。唯一下一步：常浩定下一个切片做什么，再按 HANDOFF 接着做。

## LESSONS 升级行补层级词、加规则检查（2026-11-19，Claude，跨项目复盘收尾子 agent，常浩批了「老项目接入 LESSONS 升级行检查：一次补齐」；已提交到 `claude/lessons-level`、PR 待合并、无需发布）

- 时间：开工 `2026-11-19 10:18`（`date '+%F %H:%M'` 记录）。来由：跨项目复盘 D 批，各项目 LESSONS 的「升级」行统一带层级词，并由规则检查守住。
- 改了哪些文件：`scripts/check-rules.mjs`（加 `lessons` 规则：每条 `## L-xx` 要有以〔结构〕〔机检〕〔体检〕〔文字〕〔提醒〕开头的「- 升级：」一行，写法照起步骨架）；`tests/check-rules.test.mjs`（加 1 条测试：缺升级行、升级行不带层级词各报一次，格式样例和合规条目不误报）；`docs/LESSONS.md`（「怎么升级」补一条层级词要求，格式样例改成「〔提醒〕未升级。」，与起步骨架一致）；本仓库 LESSONS 还没有真实条目，规则在真实文件上为绿。另修起步骨架带来的漏报：判断占位标题前先去掉反引号里的内容（标题里的 `<all_urls>` 之类原来会让整条不查），写法同 chatgpt-clipper#10（`cd80285`），并加 1 条测试；骨架本身由主会话另行处理。本节交接。
- 测试：`npx tsc --noEmit` 改前改后都无输出、退出码 0；`node --test tests/*.test.mjs` 改前在新 worktree 里 `ℹ pass 7` / `ℹ fail 1`（`sites-worker` 要先 `npm run build` 产出 `dist/`），build 后 `ℹ pass 8` / `ℹ fail 0`，改后 `ℹ pass 10` / `ℹ fail 0`；`node scripts/check-rules.mjs` 改前改后都输出 `通用规则检查通过`。`npx playwright test` 改前 `10 failed`，原因是本机缺 Playwright 要的 `chromium_headless_shell-1228`（装的是 1248），与本次改动无关，改后未跑。
- 验证：在 worktree `~/Sandbox/worktrees/little-steps-lessons-level` 里跑；改前改后日志在 `~/Library/Application Support/little-steps/evidence/2026-11-19-lessons-level/`。
- 截图：无。
- 发布与回读：无需发布。
- 与授权不一致之处、遗留问题、范围外发现：规则检查没有接进 CI 或提交前钩子，只在手动跑测试时生效。Playwright 浏览器版本对不上，端到端没跑通（见上）。

## 交叉审查返修（2026-11-12，Codex，常浩授权 PR #4 本 worktree 返修；未提交、未推送）

- 时间：开工 `2026-11-12 15:48`（本轮 `date '+%F %H:%M'` 首次记录）。start_head `4708286bfa93291f1384864f6a5addc60f1c9b0b`，分支 `codex/audit-fix-1112`，开工时工作区干净。业务切片暂停决定不变；只处理指定交叉审查报告。
- 改了哪些文件：`src/Prototype.tsx`（启动/刷新由同一原始字符串生成数据与快照；元数据与清理共享 Web Lock，纯文本不等媒体库；无 Web Locks 环境保留事务保护）；`miniapp/miniprogram/lib/v5/repo.js`（写入/回读结果不明后阻止旧缓存写入，成功重读再恢复）；`miniapp/tests/v5-repo.test.js`（抛错、不一致、重读再失败与草稿保留回归）；`tests/web-storage-safety.test.mjs`、`tests/helpers/storage-concurrency-worker.mjs`（单次读取、媒体库拒绝/阻塞、清理和独立线程交错，撤锁反证）；本文件。未顺手改产品其他功能，未改视觉、素材、CSS、数据格式或受保护运行时。
- 测试：`npm run build`、`node node_modules/typescript/bin/tsc --noEmit` 退出 0；全部根测试原样 `ℹ pass 21` / `ℹ fail 0`，其中网页存储 13/13；`v5-repo：通过 12，失败 0`。全部 27 个小程序测试入口逐个执行，24 个退出 0，3 个退出 1；`report-page`、`runtime-retention`、`visual-contract` 三项在 PR 基线 `4fcd120` 的原模块下复跑同样失败。`check-miniapp.mjs` 因旧四页路由契约失败，基线同样失败；不修或放宽旧契约来制造绿灯。规则、28 个受保护文件、Sites 四项测试、CloudBase 本地结构检查均通过。
- 验证：发现 1–3 均保留修前失败、修后通过；发现 4 复现旧六项撤锁仍通过，新增独立线程测试在 Web Lock / 事务等待各自被撤掉时均原样报 `2 !== 1`，保留锁后通过。仅合成数据、存储边界替身与 Node 独立线程；不等同真实多标签页浏览器的 Web Locks / IndexedDB 验收。
- 截图：无。Playwright 发现 `Total: 12 tests in 3 files`，执行因离线防护 `Error: AUDIT_OFFLINE: network disabled` 退出 1，未进入浏览器交互。本轮未监听端口或启动浏览器，未把历史 EPERM/SIGABRT 结果冒充本轮结果。
- 发布与回读：只改本 worktree 与指定证据目录；未提交、推送、联网、发布或读取真实家庭存储。记录为本地候选版，PR #4 远端未更新。证据入口：`/Users/nat/Library/Application Support/little-steps/evidence/2026-11-12-codex-fix/summary.md` 末尾「交叉审查返修」，本轮原样日志与变异副本在同目录 `rework/`。
- 与授权不一致之处、遗留问题、范围外发现：报告四项均成立；全部在本轮授权范围内处理。没有 Web Locks 的旧浏览器仍依赖媒体事务提供安全锁，媒体库同时不可用时不会降级为无锁保存；这一兼容边界须在沙箱外复验。三个旧测试失败和旧四页离线自检建议另开 issue；没有据此恢复旧页面或改已定内容。当前 AGENTS.md 未规定此次必须升版本/写 CHANGELOG，仓库无 CHANGELOG 文件，本轮未制造版本改动。需要常浩确认后才能实施的新行为：无。
- 唯一下一步：在允许监听本地端口、启动隔离 Chromium 的环境复跑本 worktree 全部 Playwright 测试，并重点验证媒体库故障下的纯文本保存、真实双窗口争锁与过期拒绝；验明前保持“待复验”，不得合并结论替代真机验收。
- 本轮新坑：无。

## 三项审计高危的限定修复（2026-11-12，Codex，常浩明确授权本 worktree 修复报告第 20/30/32 行；未提交、未发布）

- 时间：开工 `2026-11-12 10:56`（`date '+%F %H:%M'` 记录）。来由：先核实现状，再逐项保留失败测试、做最小修复；start_head 为 `4fcd1205af9b9551220225d593cdb34cc3c0e436`。
- 改了哪些文件：`miniapp/miniprogram/lib/v5/repo.js`（读取失败/坏结构不再初始化空档案，成功重读前禁止写入）；`miniapp/miniprogram/app.js`、`pages/v5/{today,setup,records,growth,stage,album}/index.js`（启动不中断，所有读取页面原生提示重试）；`src/Prototype.tsx`（事务串行保护元数据提交、拒绝过期快照、同步跨标签页状态；元数据保存回读成功后才清媒体，持久标记重试）；`miniapp/tests/v5-repo.test.js`、`tests/web-storage-safety.test.mjs`、`tests/storage-safety.spec.ts`（故障注入、并发回归及待运行的浏览器用例）；本文件。
- 测试：`npm run build` 退出 0；`npx --no-install tsc --noEmit` 无输出、退出 0；`node --test tests/*.test.mjs` 原样结果 `ℹ pass 14` / `ℹ fail 0`；`node scripts/check-rules.mjs` 输出 `通用规则检查通过`；`npm run check:runtime` 输出 `Mobile runtime integrity check passed (28 protected files).`；`node miniapp/scripts/check-cloudbase.mjs` 输出 `CloudBase family backend structure: OK`。逐个 `node miniapp/tests/*.test.js`：27 个入口，24 个退出 0、3 个退出 1；本轮 v5-repo 为 `v5-repo：通过 10，失败 0`。
- 验证：仅合成 wx、内存存储及原生产函数故障注入；三项均有修前失败与修后通过日志。失败的 `report-page`、`runtime-retention`、`visual-contract` 在本地 HEAD 原实现下复跑亦失败，属于审计已记录的旧契约问题；未改测试以掩盖失败。`npx --no-install playwright test` 受离线防护阻断；独立预览尝试为 `listen EPERM`，改用无服务器的资源拦截后 Chromium 启动 `SIGABRT`，两条新浏览器用例未实际进入交互。
- 截图：无。未修改视觉、素材、CSS 或受保护运行时；真实浏览器对照、微信开发者工具/真机验收未完成。
- 发布与回读：未提交、未推送、未发布；真实运行环境未采用。没有访问网络、真实业务数据、钥匙串或私人日志；旧云函数/store.js 四项高危未改。
- 与授权不一致之处、遗留问题、范围外发现：无范围外代码改动。证据与逐项总结见 `/Users/nat/Library/Application Support/little-steps/evidence/2026-11-12-codex-fix/summary.md`；唯一下一步是在可启动隔离浏览器的环境运行 `tests/storage-safety.spec.ts` 并检查原有浏览器套件。项目业务切片的暂停决定保持。
- 第 2 轮（2026-11-12）：据常浩转述，Claude 沙箱外实跑 `tests/storage-safety.spec.ts`：原第 88 行跨窗口用例通过，原第 69 行删除配额失败用例找不到默认角色定位的 status。静态核对及原生产删除函数单元验证确认已有失败 toast；仅将该用例改为定位现有 `.toast[role="status"]` 并断言可见和准确文案，补强单元测试的失败返回值与提示断言。产品代码未改；本沙箱不跑浏览器，修后 E2E 待 Claude 在沙箱外复跑。完整原因、检查结果和本轮增量见证据 `summary.md` 末尾「第 2 轮」。
- 本轮新坑：无。

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
