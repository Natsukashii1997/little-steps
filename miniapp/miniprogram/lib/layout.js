"use strict";

function getWindowInfo() {
  if (typeof wx === "undefined") return { statusBarHeight: 24, windowWidth: 375 };
  if (typeof wx.getWindowInfo === "function") return wx.getWindowInfo();
  if (typeof wx.getSystemInfoSync === "function") return wx.getSystemInfoSync();
  return { statusBarHeight: 24, windowWidth: 375 };
}

function getHeaderLayout() {
  const windowInfo = getWindowInfo();
  let menu = null;
  try {
    menu = typeof wx !== "undefined" && typeof wx.getMenuButtonBoundingClientRect === "function"
      ? wx.getMenuButtonBoundingClientRect()
      : null;
  } catch (error) {
    menu = null;
  }
  const statusBarHeight = Number(windowInfo.statusBarHeight || 24);
  const menuHeight = menu && Number(menu.height || 0);
  const menuBottom = menu && Number(menu.bottom || (Number(menu.top || 0) + menuHeight));
  const barHeight = 52;
  const contentTop = menuHeight && menuBottom
    ? Math.max(statusBarHeight, menuBottom + 4)
    : statusBarHeight + 44;
  return {
    statusBarHeight,
    contentTop,
    barHeight,
    totalHeight: contentTop + barHeight,
  };
}

module.exports = { getHeaderLayout };
