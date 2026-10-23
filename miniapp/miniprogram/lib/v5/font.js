"use strict";

// 霞鹜文楷（LXGW WenKai）是全站唯一字体（规范第 3 节）。
// 字体文件进不了 2 MB 主包，用 wx.loadFontFace 从 config.fontSources 给的地址加载（https 或 Data URL）；
// 没给地址、或者加载失败，就一直用系统字体（app.wxss 的 font-family 已写好回退）。

const FAMILY = "LXGW WenKai";

function loadOne(api, source, weight) {
  return new Promise(function (resolve) {
    api.loadFontFace({
      family: FAMILY,
      global: true,
      source: 'url("' + source + '")',
      desc: { weight: weight, style: "normal" },
      success() {
        resolve(true);
      },
      fail(error) {
        console.warn("字体没加载上，先用系统字体", weight, error);
        resolve(false);
      },
    });
  });
}

// 返回 Promise<boolean>：两个字重都加载成功才算 true。
function loadFonts(config) {
  const api = typeof wx !== "undefined" ? wx : null;
  const sources = (config && config.fontSources) || {};
  if (!api || typeof api.loadFontFace !== "function") return Promise.resolve(false);
  const tasks = [];
  if (sources.regular) tasks.push(loadOne(api, sources.regular, "400"));
  if (sources.bold) tasks.push(loadOne(api, sources.bold, "700"));
  if (!tasks.length) return Promise.resolve(false);
  const started = Date.now();
  return Promise.all(tasks).then(function (results) {
    const ok = results.every(Boolean);
    console.info("字体加载", ok ? "完成" : "有失败", Date.now() - started, "ms");
    return ok;
  });
}

module.exports = { FAMILY, loadFonts };
