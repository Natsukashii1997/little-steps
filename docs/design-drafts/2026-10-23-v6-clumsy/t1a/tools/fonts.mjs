import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/Users/nat/Documents/AI 项目/baby-care-workbench/package.json');
const { chromium } = require('playwright');
const fonts = [['龙藏体（现在）', "'Long Cang'"], ['站酷快乐体', "'ZCOOL KuaiLe'"], ['霞鹜文楷屏幕版', "'LXGW WenKai Screen'"]];
const rows = fonts.map(([n, f]) => `<section><h3>${n}</h3><div style="font-family:${f}">
<p class="h">可以陪他玩的</p><p>清醒时趴一会儿　说说话，停下来等他回应</p><p>睡觉仰卧，床上不放软东西</p>
<p class="n">61.2<em>cm</em> 6.1<em>kg</em> 40.1<em>cm</em> +3.2</p><p>抓着我的手指不放，好久都不松开。</p><p class="s">观察　测量　照片　照护　问医生</p></div></section>`).join('');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 560 }, deviceScaleFactor: 1 });
await p.setContent(`<link href="https://fonts.googleapis.com/css2?family=Long+Cang&family=ZCOOL+KuaiLe&family=Noto+Sans+SC&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/style.css" rel="stylesheet">
<style>body{margin:0;padding:24px;background:#FCFBF8;color:#1D1B19;display:grid;grid-template-columns:repeat(3,1fr);gap:28px;font-family:"Noto Sans SC"}
h3{font:500 13px "Noto Sans SC";color:#6B655E;margin:0 0 8px}p{margin:0 0 10px;font-size:20px;line-height:1.4}.h{font-size:23px}.n{font-size:34px}.n em{font:400 12px "Noto Sans SC";color:#6B655E;margin:0 10px 0 2px}.s{font-size:17px;color:#6B655E}</style>${rows}`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
await p.screenshot({ path: path.resolve('out/font-compare.png') });
await b.close();
