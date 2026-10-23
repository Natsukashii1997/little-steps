#!/usr/bin/env node
// 把 content/stages.js 导出成 docs/content/阶段内容表.md 给常浩逐月确认，并打印 Markdown 的 sha256。
// 用法：node scripts/v5-content-md.mjs
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const stages = require(resolve(here, "../miniprogram/content/stages.js"));
const out = resolve(here, "../../docs/content/阶段内容表.md");

const KINDS = [
  ["observe", "这个月可能看到的（观察点）"],
  ["play", "可以陪宝宝玩的"],
  ["notice", "要留意的"],
  ["arrange", "要安排的（S2 才显示）"],
];
const state = (m) => (stages.confirmedMonths.includes(m) ? "已确认" : stages.draftMonths.includes(m) ? "草稿，待常浩确认" : "未起草");

let md = `# 阶段内容表（0–12 月龄）\n\n`;
md += `版本 ${stages.version}。数据在 \`miniapp/miniprogram/content/stages.js\`，本文件由 \`miniapp/scripts/v5-content-md.mjs\` 导出，改内容请改数据文件再重新导出。\n\n`;
md += `规则：每条一句话，不下判断，不写疫苗名和剂量；来源按公开的儿童保健时点（满月、3、6、8、12 月龄儿保）和国家免疫规划。页脚固定一句「${stages.source}」。\n\n`;
md += `确认方式：常浩看过一个月回「确认 N 月龄」，Claude 把该月从 draftMonths 挪进 confirmedMonths，并把本文件当时的 sha256 记进 docs/handoff/slice-1/README.md。\n\n`;
md += `| 月龄 | 状态 |\n|---|---|\n`;
for (let m = 0; m <= 11; m += 1) md += `| ${m}–${m + 1} 月龄 | ${state(m)} |\n`;
for (const m of Object.keys(stages.months).map(Number).sort((a, b) => a - b)) {
  const month = stages.months[String(m)];
  md += `\n## ${m}–${m + 1} 月龄（${state(m)}）\n`;
  for (const [kind, title] of KINDS) {
    const items = month[kind] || [];
    md += `\n### ${title}\n\n`;
    for (const item of items) {
      md += `- ${item.text}${item.window ? `（${item.window}）` : ""} \`${item.id}\`\n`;
      for (const p of item.body || []) md += `  - ${p}\n`;
    }
  }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md);
const sha = createHash("sha256").update(md).digest("hex");
console.log("写出", out, md.length, "字", "sha256", sha);
