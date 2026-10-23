// 把 DC 样稿转成静态页，用 Playwright 截图并量几何。只读源文件，输出到 out/。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/Users/nat/Documents/AI 项目/baby-care-workbench/package.json');
const { chromium } = require('playwright');

const SRC = process.argv[2];
const OUT = process.argv[3];
const names = ['V6-Home','V6-Stage','V6-Growth','V6-Album','V6-Quick','V6-Review','V6-Components'];
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toStatic(raw) {
  const helmet = raw.match(/<helmet>([\s\S]*?)<\/helmet>/)[1];
  let body = raw.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const code = raw.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const props = JSON.parse(raw.match(/data-props='([^']*)'/)[1]);
  const vals = new Function('DCLogic', code + '; return new Component().renderVals();')(class {});
  body = body.replace(/<sc-for list="\{\{(\w+)\}\}" as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g, (_, list, as, tpl) =>
    vals[list].map(item => tpl
      .replace(new RegExp(`<sc-if value="\\{\\{${as}\\.(\\w+)\\}\\}"[^>]*>([\\s\\S]*?)<\\/sc-if>`, 'g'), (_, k, inner) => item[k] ? inner : '')
      .replace(new RegExp(`\\{\\{${as}\\.(\\w+)\\}\\}`, 'g'), (_, k) => esc(item[k]))
      .replace(new RegExp(`\\{\\{${as}\\}\\}`, 'g'), () => esc(item))
    ).join(''));
  return { html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${helmet}</head><body>${body}</body></html>`, size: props.$preview };
}

const browser = await chromium.launch();
const report = {};
for (const n of names) {
  const { html, size } = toStatic(fs.readFileSync(path.join(SRC, n + '.dc.html'), 'utf8'));
  fs.writeFileSync(path.join(OUT, n + '.html'), html);
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: n === 'V6-Components' ? 1 : 2 });
  await page.goto('file://' + path.join(OUT, n + '.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true });
  report[n] = await page.evaluate(() => {
    const scr = document.querySelector('.scr, .bd').getBoundingClientRect();
    const r = el => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const label = el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24);
    // 可点元素尺寸
    const hits = [...document.querySelectorAll('a,button,textarea')].map(el => ({ t: label(el), box: r(el) }))
      .filter(h => h.box[2] < 44 || h.box[3] < 44);
    // 文字叶子节点互相重叠
    const leaves = [...document.querySelectorAll('body *')].filter(el => el.childElementCount === 0 && el.textContent.trim() && !el.closest('svg') || (el.tagName === 'text'));
    const boxes = leaves.map(el => ({ t: label(el), b: el.getBoundingClientRect(), el }));
    const overlaps = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b, c = boxes[j].b;
      const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (ix > 2 && iy > 2 && !boxes[i].el.contains(boxes[j].el) && !boxes[j].el.contains(boxes[i].el)) overlaps.push([boxes[i].t, boxes[j].t, Math.round(ix), Math.round(iy)]);
    }
    // 超出画面或压到底栏
    const tab = document.querySelector('nav.tab');
    const tabTop = tab && !tab.closest('.bd') ? tab.getBoundingClientRect().top : Infinity;
    const clipped = boxes.filter(x => !x.el.closest('nav.tab') && (x.b.bottom > Math.min(scr.bottom, tabTop) + 1 || x.b.right > scr.right + 1)).map(x => [x.t, Math.round(x.b.bottom), Math.round(x.b.right)]);
    // 每个手写字体文本里实际是否用了 Long Cang
    const lc = [...document.querySelectorAll('body *')].filter(el => getComputedStyle(el).fontFamily.includes('Long Cang') && [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()));
    const hwText = [...new Set(lc.map(el => [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('')).join(''))].join('');
    return { scr: [scr.width, scr.height], tabTop, hits, overlaps, clipped, hwChars: [...new Set(hwText.replace(/\s/g, ''))].join(''), lcLoaded: document.fonts.check('20px "Long Cang"', '记') };
  });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
