"use strict";

// 首个切片 S1（2026-10-23 常浩授权）：只用本机存储，不初始化云开发，不读旧存储键。
// 旧的 app.js（家庭同步、媒体清理）在基线提交 be772db 里。
const baseConfig = require("./config");
const repo = require("./lib/v5/repo");
const font = require("./lib/v5/font");

let localConfig = {};
try {
  localConfig = require("./config.local");
} catch (error) {
  localConfig = {};
}
const config = Object.assign({}, baseConfig, localConfig);

App({
  globalData: {
    config: config,
    fontReady: false,
  },

  onLaunch() {
    // 读取失败保持原副本，由页面提供重试；软删除满 30 天才清掉。
    try {
      repo.load();
      repo.purgeDeleted();
    } catch (error) {
      console.warn("读取或清理本机记录失败，请在页面重试", error);
    }
    font.loadFonts(config).then((ready) => {
      this.globalData.fontReady = ready;
    });
  },
});
