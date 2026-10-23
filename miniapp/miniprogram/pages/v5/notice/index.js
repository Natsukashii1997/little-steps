"use strict";

// 注意事项正文（二级页，审查 B12）：「‹ 这个月」＋标题＋段落＋页脚来源。只读。
const content = require("../../../lib/v5/content");

Page({
  data: { title: "", paragraphs: [], sourceLine: "", draftLine: "" },

  onLoad(query) {
    const index = Number(query && query.month);
    const item = Number.isFinite(index) ? content.noticeItem(index, (query && query.id) || "") : null;
    this.setData({
      title: item ? item.text : "这条内容找不到了。",
      paragraphs: item ? item.body || [] : ["可能是内容表改过了，回这个月页再看看。"],
      sourceLine: content.sourceLine(),
      draftLine: item && content.isDraft(index) ? content.draftLine() : "",
    });
  },
});
