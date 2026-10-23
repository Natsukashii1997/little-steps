import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/Users/nat/Documents/AI 项目/baby-care-workbench/package.json');
const { chromium } = require('playwright');
const OUT = path.resolve('out');
const b = await chromium.launch();
// 1) 龙藏体字形放大对照
const p = await b.newPage({ viewport: { width: 900, height: 420 }, deviceScaleFactor: 1 });
await p.setContent(`<link href="https://fonts.googleapis.com/css2?family=Long+Cang&family=Noto+Sans+SC&display=swap" rel="stylesheet">
<style>body{margin:16px;background:#FCFBF8;color:#1D1B19}div{display:flex;gap:18px;align-items:center}b{font:400 64px "Long Cang"}i{font:400 30px "Noto Sans SC";font-style:normal;color:#6B655E}</style>
<div><b>时 以 测 说 话 着 晴 醒</b></div><div><i>时 以 测 说 话 着 晴 醒（对照）</i></div>
<div><b>61.2 6.1 40.1 +3.2</b></div><div><b>睡觉仰卧，床上</b></div>`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
await p.screenshot({ path: path.join(OUT, 'glyphs.png') });
// 2) 一撇宽度与文字宽度
const res = {};
for (const [n, sel] of [['V6-Review', '.done'], ['V6-Album', '.imp'], ['V6-Quick', '.go'], ['V6-Stage', '.mark'], ['V6-Components', '.big']]) {
  const q = await b.newPage({ viewport: { width: n === 'V6-Components' ? 1440 : 390, height: 900 } });
  await q.goto('file://' + path.join(OUT, n + '.html'), { waitUntil: 'networkidle' });
  await q.evaluate(() => document.fonts.ready); await q.waitForTimeout(400);
  res[n] = await q.$$eval(sel, els => els.filter(el => el.querySelector("span") && el.querySelector("svg")).map(el => { const t = el.querySelector('span').getBoundingClientRect(), s = el.querySelector('svg').getBoundingClientRect(); return { text: el.textContent.trim(), textW: Math.round(t.width), swooshW: Math.round(s.width), uncovered: Math.round(t.right - s.right) }; }));
  await q.close();
}
console.log(JSON.stringify(res));
await b.close();
// 3) 对比度
const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, c) => { const [x, y] = [L(a), L(c)].sort((m, n) => n - m); return ((x + 0.05) / (y + 0.05)).toFixed(2); };
console.log('次要字/纸', cr('#6B655E', '#FCFBF8'), '占位字/纸', cr('#8A837A', '#FCFBF8'), '墨/浅绿', cr('#1D1B19', '#C2D58A'), '墨/淡蓝', cr('#1D1B19', '#A8C3DE'), '次要字/弹层压暗区', cr('#6B655E', '#B1AFAB'), '浅绿/纸(非文字)', cr('#C2D58A', '#FCFBF8'), '淡蓝/纸(非文字)', cr('#A8C3DE', '#FCFBF8'));
