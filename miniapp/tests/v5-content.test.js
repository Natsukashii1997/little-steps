"use strict";

// 内容表校验：结构、id 唯一、每条一句话、要留意的带正文、草稿与确认不重叠。
const assert = require("node:assert/strict");
const stages = require("../miniprogram/content/stages");
const content = require("../miniprogram/lib/v5/content");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("通过", name);
  } catch (error) {
    failed += 1;
    console.log("失败", name, "\n   ", error.message);
  }
}

const KINDS = ["observe", "play", "notice", "arrange"];

test("每个月都有四类，每条有 id 和一句话（不超过 30 字、没有句号以外的分句）", () => {
  Object.keys(stages.months).forEach((m) => {
    const month = stages.months[m];
    KINDS.forEach((kind) => {
      assert.ok(Array.isArray(month[kind]), m + " 月缺 " + kind);
      month[kind].forEach((item) => {
        assert.match(item.id, /^m\d+-[a-z0-9-]+$/, "id 不规范 " + item.id);
        assert.ok(item.text && item.text.length <= 30, "太长 " + item.id);
        assert.ok(!/[。！？]/.test(item.text), "条目里不放句号 " + item.id);
      });
    });
  });
});

test("id 全表唯一，且以月龄开头", () => {
  const seen = {};
  Object.keys(stages.months).forEach((m) => {
    KINDS.forEach((kind) => stages.months[m][kind].forEach((item) => {
      assert.ok(!seen[item.id], "重复 id " + item.id);
      assert.ok(item.id.indexOf("m" + m + "-") === 0, "id 月份不对 " + item.id);
      seen[item.id] = true;
    }));
  });
});

test("要留意的每条都有正文段落，不写疫苗名和剂量", () => {
  Object.keys(stages.months).forEach((m) => {
    stages.months[m].notice.forEach((item) => {
      assert.ok(Array.isArray(item.body) && item.body.length >= 2, "正文太短 " + item.id);
      item.body.forEach((p) => assert.ok(!/(mg|ml|毫克|毫升|剂)/.test(p), "出现剂量 " + item.id));
    });
    KINDS.forEach((kind) => stages.months[m][kind].forEach((item) => {
      assert.ok(!/(乙肝|卡介|脊灰|百白破|麻腮风|流脑|乙脑|轮状|肺炎球菌|五联|六联)/.test(item.text), "出现疫苗名 " + item.id);
    }));
  });
});

test("草稿月份和确认月份不重叠；都在表里", () => {
  stages.draftMonths.forEach((m) => assert.ok(stages.confirmedMonths.indexOf(m) < 0 && stages.months[String(m)], "草稿 " + m));
  stages.confirmedMonths.forEach((m) => assert.ok(stages.months[String(m)], "确认 " + m));
});

test("content：草稿月份可读且标草稿，没列的月份为空", () => {
  assert.equal(content.isDraft(2), true);
  assert.ok(content.observePoints(2).length >= 4);
  assert.equal(content.pickableItems(2).filter((p) => p.kind === "play").length, content.playItems(2).length);
  assert.equal(content.noticeItem(2, "m2-notice-sleep").body.length >= 2, true);
  assert.equal(content.monthContent(7), null);
  assert.equal(content.isDraft(7), false);
  assert.equal(content.pointText(2, "m2-head"), "趴着能抬头");
});

console.log("\nv5-content：通过", passed, "失败", failed);
process.exit(failed ? 1 : 0);
