"use strict";

// 阶段内容表（0–12 月龄）。起草稿由 scripts/v5-content-md.mjs 导出成 docs/content/阶段内容表.md 给常浩逐月看；
// 常浩确认一个月，就把月龄从 draftMonths 挪进 confirmedMonths，并在 README 记下 Markdown 的 sha256。
// draftMonths 里的月份页面照常显示，但页脚多一行「草稿，等你逐月确认」；没列出的月份按空状态显示。
// 每条：{ id, text }，text 一句话、不下判断、不写疫苗名和剂量。
// 四类：observe（这个月可能看到的，观察点）、play（可以陪宝宝玩的）、notice（要留意的，带 body 段落）、arrange（要安排的，S2 用）。

module.exports = {
  version: "2026-10-24",
  source: "内容整理自公开的儿童保健资料，以儿保医生的意见为准",
  confirmedMonths: [],
  draftMonths: [2, 3],
  months: {
    "2": {
      observe: [
        { id: "m2-head", text: "趴着能抬头" },
        { id: "m2-smile", text: "逗一逗会笑出声" },
        { id: "m2-hands", text: "两只手碰到一起" },
        { id: "m2-track", text: "眼睛跟着东西转" },
        { id: "m2-sound", text: "听到声音会转头找" },
        { id: "m2-coo", text: "发出啊、呜这样的声音" },
      ],
      play: [
        { id: "m2-play-tummy", text: "清醒时趴一会儿" },
        { id: "m2-play-talk", text: "说说话，停下来等宝宝回应" },
        { id: "m2-play-grip", text: "让宝宝握住手指或摇铃" },
        { id: "m2-play-follow", text: "移动玩具，让眼睛跟着看" },
        { id: "m2-play-walk", text: "抱着在屋里走走，看看周围" },
      ],
      notice: [
        {
          id: "m2-notice-sleep",
          text: "睡觉仰卧，床上不放软东西",
          body: [
            "每次睡觉都让宝宝仰卧，睡在自己的小床上，和大人同房间、不同床。",
            "床面平整偏硬，床上不放枕头、被子、毛绒玩具和床围。",
            "房间别太热，穿睡袋比盖被子稳妥。",
            "醒着、有人看着的时候再趴。",
          ],
        },
        {
          id: "m2-notice-doctor",
          text: "哪些情况要尽快看医生",
          body: [
            "发烧：三个月以内的宝宝发烧，不要等，尽快去看。",
            "精神差、嗜睡叫不醒，或者哭声和平时明显不一样。",
            "不吃奶或吃得明显少、反复呕吐、腹泻、尿明显变少。",
            "呼吸急促费力、口唇发紫。",
            "皮肤发黄加重、出疹子、摔碰到头。",
            "拿不准的时候，打电话问医生比等着稳妥。",
          ],
        },
        {
          id: "m2-notice-neck",
          text: "抱和放的时候护住头颈",
          body: [
            "抱起、放下、换姿势时，一只手托住头和脖子。",
            "竖抱时让头靠在肩上，不让头往后仰。",
          ],
        },
        {
          id: "m2-notice-shake",
          text: "哭闹再厉害也不摇晃宝宝",
          body: [
            "剧烈摇晃会伤到脑。",
            "哭闹时试试抱紧、轻声说话、换个环境、检查是不是饿了或尿了。",
            "实在累了，把宝宝放在安全的床上，自己歇几分钟再回来。",
          ],
        },
      ],
      arrange: [
        { id: "m2-arr-checkup", text: "3 月龄儿保", window: "满 3 月龄前后两周" },
        { id: "m2-arr-vaccine", text: "本月疫苗", window: "以门诊通知为准" },
      ],
    },
    "3": {
      observe: [
        { id: "m3-chest", text: "趴着能用手肘撑起上身" },
        { id: "m3-laugh", text: "会咯咯笑出声" },
        { id: "m3-reach", text: "伸手去够眼前的东西" },
        { id: "m3-mouth", text: "把手放进嘴里" },
        { id: "m3-babble", text: "发出咕咕啊啊的声音" },
        { id: "m3-know", text: "看到熟悉的人会笑" },
      ],
      play: [
        { id: "m3-play-tummy", text: "趴一会儿，前面放个玩具" },
        { id: "m3-play-reach", text: "玩具放在手够得着的地方" },
        { id: "m3-play-chat", text: "和宝宝一来一往地发声" },
        { id: "m3-play-mirror", text: "抱着照照镜子" },
        { id: "m3-play-song", text: "念绘本、唱儿歌" },
      ],
      notice: [
        {
          id: "m3-notice-sleep",
          text: "睡觉仰卧，床上不放软东西",
          body: [
            "每次睡觉都让宝宝仰卧，睡在自己的小床上，和大人同房间、不同床。",
            "床面平整偏硬，床上不放枕头、被子、毛绒玩具和床围。",
            "会翻身以后也先仰卧放下，自己翻过去就不用翻回来。",
          ],
        },
        {
          id: "m3-notice-fall",
          text: "别单独留在床或沙发上",
          body: [
            "这个月前后宝宝可能开始翻身，几秒钟就能滚到边上。",
            "换尿布、穿衣服时一只手始终扶着。",
            "要离开哪怕一会儿，先放回婴儿床或地垫上。",
          ],
        },
        {
          id: "m3-notice-doctor",
          text: "哪些情况要尽快看医生",
          body: [
            "发烧超过一天不退，或者精神明显不好。",
            "不吃奶或吃得明显少、反复呕吐、腹泻、尿明显变少。",
            "呼吸急促费力、口唇发紫。",
            "出疹子、摔碰到头。",
            "拿不准的时候，打电话问医生比等着稳妥。",
          ],
        },
        {
          id: "m3-notice-small",
          text: "小东西收到够不着的地方",
          body: [
            "宝宝开始抓东西往嘴里送。",
            "硬币、纽扣、小零件、塑料袋都收好。",
            "玩具挑比拳头大、没有可拆小件的。",
          ],
        },
      ],
      arrange: [
        { id: "m3-arr-vaccine", text: "4 月龄疫苗", window: "以门诊通知为准" },
        { id: "m3-arr-checkup", text: "还没做的 3 月龄儿保", window: "尽早" },
      ],
    },
  },
};
