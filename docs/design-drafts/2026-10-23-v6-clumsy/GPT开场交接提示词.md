# 交给 GPT 的交接提示词（全部画面）

2026-10-23。这是唯一要用的版本，取代同目录的《GPT素材生成清单与提示词》。

> 更新：整段发出去后，GPT 只生成了第 0 张定妆图（已可用）。第 1–22 张改用同目录的《GPT逐张提示词》，一张粘一条。

## 怎么用

1. 在 GPT 里新开一个对话，附上你那 4 张参考里的两张：「设计提示词分享系列」和「舒服，自然在里」。第 3、4 张带品牌字样，不要附。然后把下面代码框里的整段粘进去。
2. GPT 每次只出一张，出完会停下来。你回复：
   - 「下一张」：这张可以，继续；
   - 「重画」：同一张再画一次；
   - 也可以直接说哪里要改。
3. 共 23 张，顺序是：定妆图 → 7 张整屏界面 → 组件板 → 9 张插画、图标、高光 → 5 张标题字。整屏界面定下整体样子，后面的素材是拆开给开发用的。界面图没满意之前，不用急着往后做。
4. 每张都用下载按钮存原图，按 GPT 报的文件名放进 `gpt-assets/`。
5. 收图时看：
   - 宝宝是不是同一个样子；
   - 各屏的边距、字的大小、底栏是不是一致；
   - 每屏是不是只有一处浅绿高光；
   - 有没有多余的框线和卡片；
   - 中文有没有错字。界面图里个别字写错可以先记下，不影响定样子；标题字必须全对。

```
You are my visual partner for a private mobile app called 婴儿工作台: a baby-care workbench that one family uses on a phone (WeChat mini program). The UI is Simplified Chinese. All data in the images is fictional: the baby is 小满, 3 months and 2 days old. Talk to me in Simplified Chinese; write your own image prompts in English.

HOW WE WORK
1. Make ONE image per turn, in the order of the LIST. Before each image, tell me in one Chinese line the item number and the file name. After each image, stop and wait for me.
2. My replies: "下一张" = accepted, go to the next item; "重画" = redo the same item; anything else = a correction to apply to the same item.
3. Item 0 is the anchor for the baby character and the drawing style. Once I accept it, every later image reuses exactly that baby and that style. Once I accept item 1 (the home screen), every later screen reuses exactly its lettering, handwriting, margins, spacing, colors, tab bar, and status marks.
4. For item 0, use my two attached reference posters only for lettering, line quality, and watercolor feel. Never copy their characters, objects, layout, or text.
5. All Chinese text inside an image must be exactly the copy I give in the LIST, character for character: correct Simplified Chinese, no extra words, no English, no placeholder text, no invented characters.

LOOK (applies to every image)
Role: Senior Eastern visual typography designer, handwritten type designer, and naturalistic illustration art director.
Overall style (verbatim from the clumsy-handwriting master prompt): "Modern white background, natural innocence, minimalist literary poster, plain handwritten feeling, clumsy authenticity, low design trace, quiet whitespace; the overall impression should be like a handmade work slowly completed on white paper by someone earnest but not skilled at drawing or writing."
Line style (verbatim): "No guide lines, grids, decorative frames, decorative underlines, or intentional geometric composition; all text and illustration lines should feel natural, casual, and slightly unstable; illustration lines may vary in thickness, but must not be refined."
Title lettering (verbatim): "The font is rough handwritten lettering without ink stains; emphasize the clumsy feeling of not knowing how much pressure to apply, with exaggerated and obvious contrast in stroke thickness, some strokes suddenly becoming thicker or thinner, slightly crooked character structures, and inconsistent character sizes; avoid crayon, calligraphic dry-brush effects, ink bleeding, brush ink marks, and overly artistic effects."
Illustration (verbatim): "The illustration should look like a clumsy painter holding a brush but forgetting how to draw; it should not pursue beauty or accuracy."
Accent color (verbatim): "Use at most 2 low-saturation accent colors; colors may be applied to small color blocks, light fills, one local stroke, or a few small dots; accents must feel like accidental traces of color, not strong decoration."
Palette: text and lines black or dark charcoal; secondary text warm grey; accents only pale blue (close to #A8C3DE) and light green (close to #C2D58A); colored areas very small.
Illustration medium: black fineliner ink lines with natural pressure variation; accent fills are a light, transparent watercolor wash, slightly misregistered and going a little outside the lines.
Finish: naive and simple, yet calm, tidy, well balanced and pleasant to look at; confident continuous lines, not shaky, not scribbly, not messy. Clumsy letterforms, orderly layout.

CHARACTER (whenever the baby appears)
A baby around 3 to 6 months old: big round head, chubby soft body, short limbs, a few short hair strands on top of the head, simple dot eyes or gently closed smiling eyes, a tiny curved mouth, no blush. Plain onesie with a pale blue watercolor wash. Proportions read as a real infant, drawn simply; no realistic facial detail, no extra or missing fingers, no adult features.

SCREEN RULES (items 1 to 7)
- Canvas 1024x1536 portrait. Draw ONE flat phone screen at the true phone proportion 390:844, i.e. a tall rectangle about 710 px wide using the full 1536 px height, centered. Outside the screen is plain white; mark the screen edge only with a very faint light grey rounded outline. No device frame, no status-bar icons, no keyboard.
- Inside the screen: near-white paper with very subtle paper texture, not yellowed.
- Text has exactly three levels:
  (1) Screen title: one large hand-lettered title following the Title lettering rule above. It is the only large, heavy, clumsy lettering on the screen.
  (2) Section labels and list items: a neat, comfortable handwriting, like the short supporting lines in the reference posters: thin gel-pen strokes, steady pressure, clearly legible. All list items share one size; section labels are slightly larger.
  (3) Small info (dates, counts, units, hints, notes): plain small sans-serif in warm grey.
- Order: all left-aligned text starts on one shared left margin (about 6% of the screen width); all right-side values end on one shared right margin. No text block is rotated. List rows are evenly spaced with generous line height; sections are separated by the same amount of whitespace. Letterforms may be a little crooked; rows and columns are never messy.
- No cards, boxes, borders, divider lines, shadows, gradients, icons in boxes, or grid lines. Grouping comes from whitespace only.
- Color meaning: pale blue = selected or current state; light green = the single main action of the screen. At most ONE highlighter stroke per screen: a light green marker swipe under the main action only. Every other action is plain text ending with "→".
- Status marks are small hand-drawn marks, always followed by words: open circle = to arrange; check mark = done or seen; dashed circle = watching, not seen yet; short dash with grey text = no record; exclamation mark = flagged by the doctor.
- One illustration per screen, small (at most about one fifth of the screen), placed beside or diagonally opposite the title, same baby and style as item 0. Illustrations never contain numbers or words.
- Items 1 to 4 have a bottom tab bar: four handwritten labels 本月 阶段 成长 相册, evenly spaced, no icons, no bar background; the current tab is black with a tiny pale blue dot under it; the others are warm grey.
- Everything tappable looks comfortably large; nothing is cramped.

LIST

0. 00-anchor.png (1536x1024 landscape, not a screen) — Character and style anchor sheet. Top row: the baby three times, small and evenly spaced: (1) lying on its back, arms relaxed; (2) lying on its back holding a small round rattle with both hands; (3) lying on its tummy on a small flat mat, lifting its head a little. Bottom row, same style: a single leaf, a small round rattle, a pencil. Plain white background, no text.

1. screen-1-home.png — Home screen "本月". From top to bottom:
   - Small grey info, top left: 10月23日 周五
   - Screen title, hand-lettered, top left: 小满
   - Below the title, handwriting: 3 个月 2 天
   - Handwriting sentence on two lines: 这个月， / 趴着能抬头了。 then small grey info: 10月18日 家里记的
   - Illustration on the right side next to the title and sentence: the baby sleeping peacefully on its back on a small flat mat, nothing else on the mat (no pillow, no blanket, no toys).
   - Section label: 这个月要做的   with small grey info: 2 件，会提前提醒
     - open circle + 3 月龄儿保 ........ right: 已约 10月28日 (handwriting, black, with a tiny pale blue dot before it)
     - open circle + 本月疫苗 ........ right: 定个日期 →
   - Section label: 上个月的回顾   with small grey info under it: 测量 2 次，观察 6 条，照片 128 张 ........ right: 写一句 →
   - Main action, bottom right above the tab bar: a hand-drawn round button with a "+" inside and a light green watercolor wash, the handwritten label 记一笔 under it.
   - Tab bar, current tab 本月.

2. screen-2-stage.png — Stage screen "阶段". From top to bottom:
   - Small grey info: 3–4 月龄，10月21日至11月20日
   - Screen title, hand-lettered, top left: 这个月
   - Illustration on the right of the title: a wall calendar page with two binder rings and one spot loosely circled with a light green watercolor ring; no numbers, no letters on it.
   - Section label: 要安排的   small grey: 有日期，会提前提醒
     - open circle + 3 月龄儿保, small grey line under it: 建议 10月21日至11月4日 ........ right: 已约 10月28日 (tiny pale blue dot before it)
     - open circle + 本月疫苗, small grey line under it: 建议 11月2日前，以门诊通知为准 ........ right: 定个日期 → with the screen's one light green highlighter stroke under it
   - Section label: 可以陪宝宝玩的   small grey: 不做也没关系
     - 清醒时趴一会儿 ........ right: check mark + 10月20日 试过
     - 说说话，停下来等宝宝回应 ........ right: 试过了 →
     - 让宝宝握住小摇铃 ........ right: check mark + 10月22日 试过
   - Section label: 要留意的   small grey: 看看就好，不用打卡
     - 睡觉仰卧，床上不放软东西 ........ right: 看看 →
     - 哪些情况要尽快看医生 ........ right: 看看 →
   - Small grey note near the bottom: 示例内容，以儿保医生的意见为准。
   - Tab bar, current tab 阶段.

3. screen-3-growth.png — Growth screen "成长". From top to bottom:
   - Small grey info: 截至 10月23日
   - Screen title, hand-lettered, top left: 长大了
   - Illustration on the right of the title: a small flowerpot with a pale blue wash and a sprout with two light green leaves; no measuring marks, no numbers.
   - Three measurements in one row, evenly spaced; each number in handwriting, medium-large, with a small grey unit and a small grey line under it:
     61.2 cm — 身高，比上次 +3.2 | 6.1 kg — 体重，+0.7 | 40.1 cm — 头围，+1.1
   - Small grey info: 10月12日 社区儿保量的，共 4 次 ........ right: 看曲线 →
   - Section label: 家里看到的   small grey: 随手记下的变化
     - check mark + 趴着能抬头 ........ right: 10月18日
     - check mark + 逗一逗会笑出声 ........ right: 10月9日
     - dashed circle + 两只手碰到一起 ........ right: 还没看到
     - short dash + 翻身 (in grey) ........ right, grey: 没记过
   - Section label: 医生说   small grey: 原话照记
     - Handwriting quote: 「生长正常，注意左右换着睡。」
     - Small grey info: 10月12日 2 月龄儿保
     - exclamation mark + 医生提示要留意：睡姿
   - Section label: 家里在留意   small grey: 2 / 3 条
     - two short items on one line, each after a tiny pale blue dot: 夜里醒 3 次左右   总朝右边睡
   - Tab bar, current tab 成长.

4. screen-4-album.png — Album screen "相册". From top to bottom:
   - Small grey info: 312 张照片，28 段视频
   - Screen title, hand-lettered, top left: 相册
   - Illustration on the right of the title: a small boxy film camera, front view, pale blue wash in the lens, a tiny light green dot as the flash; no brand, no letters.
   - Handwriting sentence on two lines: 原片都好好存着， / 换手机也看得到。
   - Small grey info: 存储方式待定
   - Month label: 3 月龄   small grey: 10月21日起，46 张，7 段
     - A 3-column grid of 9 square thumbnails with small even gaps and very slightly rounded corners: ordinary phone photos with natural, unfiltered colors of a baby's everyday life (tiny hands, feet, sleeping from above, bath towel, a parent's finger held, a stroller blanket); faces are not the focus. Two tiles show a small white pill with a video duration: 0:42 and 1:08. One tile has a tiny light green dot in its top right corner.
     - Below the grid, right aligned: 展开这个月 →
   - Month label: 2 月龄   small grey: 128 张，15 段, with the top of the next row of thumbnails just visible.
   - Bottom row above the tab bar: left: 全部导出 ........ right: 放照片进来 + with the screen's one light green highlighter stroke under it.
   - Tab bar, current tab 相册.

5. screen-5-quick.png — "记一笔" bottom sheet over the home screen. No tab bar.
   - The home screen from item 1 is visible at the very top, dimmed by a soft grey overlay.
   - A bottom sheet covers the screen from about 15% height down, near-white paper, top corners rounded, a short hand-drawn grab handle at the top center.
   - Sheet title, hand-lettered, left: 记一笔 ........ right, small grey: 取消
   - Small grey line: 随手记下来，月底会整理进回顾。
   - Five choices in one row, evenly spaced, each a small hand-drawn icon above a handwritten label: an open eye — 观察; a short soft measuring tape — 测量; a small camera — 照片; a baby bottle — 照护; a speech bubble with a question mark — 问医生. 观察 is selected: black label with a short pale blue highlighter stroke under it; the other four labels are warm grey.
   - Handwriting row: 看到了吗   then two choices: 看到了 (selected: black with a short pale blue stroke under it)   留意了，还没看到 (warm grey)
   - The note being written, in handwriting, slightly larger: 抓着我的手指不放，好久都不松开。 with one long, slightly wobbly hand-drawn line under it as the input line.
   - One small square photo thumbnail, then the text: + 照片或视频
   - Small grey info: 今天 10月23日 14:20   then handwriting: 改时间
   - Bottom row: left small grey: 会出现在本月和成长里 ........ right: 记下, large handwriting with the screen's one light green highlighter stroke under it.

6. screen-6-review-top.png — Monthly review page, upper half (it is a long scrolling page; this image shows its top). No tab bar.
   - Top left, small handwriting: ‹ 本月
   - Screen title, hand-lettered, top left: 上个月
   - Illustration on the right of the title: an open notebook seen from above with a few wavy lines (no real letters) and a pencil with a pale blue body lying across it.
   - Small grey info: 9月21日至10月20日，2 月龄
   - Handwriting sentence on two lines: 这个月替你理好了， / 看一遍，写一句就收好。
   - Section label: 长了多少   small grey: 9月20日到10月12日，两次测量
     - Three changes in one row, handwriting numbers with small grey units and small grey lines under them:
       +3.2 cm — 身高，现在 61.2 | +0.7 kg — 体重，现在 6.1 | +1.1 cm — 头围，现在 40.1
   - Section label: 看到的变化   small grey: 家里记的 6 条
     - check mark + 逗一逗会笑出声 ........ right: 10月9日
     - check mark + 眼睛跟着人走 ........ right: 9月30日
     - dashed circle + 两只手碰到一起, small grey line under it: 留意过 2 次，还没看到
     - 还有 3 条 →
   - Section label: 办完的事   small grey: 2 件
     - check mark + 2 月龄儿保, small grey line under it: 10月12日，医生：「生长正常，注意左右换着睡。」
     - check mark + 疫苗, small grey line under it: 9月21日，按接种本记了实际日期

7. screen-7-review-bottom.png — Monthly review page, lower half (continue the same page; same margins and type as item 6). No tab bar, no title.
   - Section label: 挑了三张   small grey: 从 128 张里挑的，点一下可以换
     - Three square photo thumbnails in one row, ordinary natural-color phone photos of a baby's everyday life; the middle one shows a small white pill: 0:15
   - Section label: 家里在留意   small grey: 还要不要继续看着
     - 夜里醒 3 次左右 ........ right: 继续留意 (selected: black with a short pale blue stroke under it)   不用了 (warm grey)
     - 总朝右边睡 ........ right: 继续留意 (selected, same style)   不用了 (warm grey)
   - Section label: 你写一句   small grey: 只有这一步要你动笔
     - Grey handwriting placeholder: 比如：第一次笑出声那天，全家都围过来了。 with one long, slightly wobbly hand-drawn line under it; small grey at the right end: 0 / 200
   - Main action, left aligned, large handwriting: 收好这个月 with the screen's one light green highlighter stroke under it.
   - Small grey note: 收好后还能改。没有记录的地方，不代表没有变化。

8. sheet-components.png (1536x1024 landscape, not a phone screen) — A tidy style sheet of the app's recurring parts, same look as the accepted screens, arranged in a loose 4-column layout with generous whitespace and no boxes. Each group has a small grey label above it:
   - 颜色: five hand-painted color dabs in a row: near-white paper, black ink, warm grey, pale blue, light green.
   - 字: one hand-lettered sample 这个月; one handwriting sample 清醒时趴一会儿; one small grey sans-serif sample 建议 11月2日前
   - 状态: five rows, each a mark plus words: open circle 要安排; check mark 办完了; dashed circle 还没看到; short dash 没记过 (grey); exclamation mark 医生提示要留意
   - 动作: 记下 with a light green highlighter stroke under it; 看看 →; 看到了 with a short pale blue stroke (selected) next to 留意了，还没看到 in warm grey
   - 底栏: the four tab labels 本月 阶段 成长 相册 with 本月 current
   - 输入: grey placeholder 比如：抓着我的手指不放。 above one wobbly hand-drawn line
   - 照片格: three square thumbnails, one with a 0:42 pill, one with a tiny light green dot
   - 空着的时候: the small camera illustration, the handwriting line 这个月还没有照片。 and below it 放照片进来 + with a light green stroke

9. ill-home-sleep.png (1024x1024 square) — The baby sleeping peacefully on its back on a small flat mat, arms relaxed up beside its head, eyes closed. Nothing else on the mat: no pillow, no blanket, no toys. Short wobbly ground line, one or two tiny light green dots near it. Isolated, centered, at least 12% empty margin, plain pure white background (#FFFFFF), no paper texture, no shadow, no text.
10. ill-home-leaf.png (1024x1024) — The baby lying on its back on a small flat mat, looking up with curious dot eyes at one light green leaf drifting above it. Short ground line with three tiny grass ticks. Same isolation and background rules as item 9.
11. ill-home-rattle.png (1024x1024) — The baby lying on its back, both hands holding a small round rattle (pale blue ball, light green handle), smiling with gently closed eyes. Short ground line. Same isolation and background rules.
12. ill-stage-calendar.png (1024x1024) — The calendar from item 2, alone. No numbers, letters, or weekday names; a few faint short dashes suggest rows, never a precise grid. Same isolation and background rules.
13. ill-growth-sprout.png (1024x1024) — The sprout pot from item 3, alone, with a short ground line. No measuring marks. Same isolation and background rules.
14. ill-album-camera.png (1024x1024) — The camera from item 4, alone, with two short spark ticks near its top right. Same isolation and background rules.
15. ill-review-notebook.png (1024x1024) — The notebook and pencil from item 6, alone; a tiny light green dot at the pencil's end. Same isolation and background rules.
16. icons-quick.png (1536x1024 landscape) — The five icons from item 5 (eye, measuring tape, camera, baby bottle, speech bubble with a question mark), alone, in one row, evenly spaced, identical size and line weight, lines slightly thicker than the illustrations so they read at 36 px. Only the eye's iris and the camera lens are pale blue. No labels. Plain pure white background.
17. marks-highlight.png (1536x1024 landscape) — Six separate horizontal highlighter strokes in the same style as the screens: three pale blue in the top row, three light green in the bottom row; each about five times as long as tall, slightly uneven edges, a little lighter at both ends, translucent watercolor texture, lots of space between them. Nothing else. Plain pure white background.
18. title-zhegeyue.png (1536x1024 landscape) — The hand-lettered title 这个月 alone, matching the screen titles exactly; one horizontal line, centered, about 70% of the width; plain pure white background; no underline, no highlight, no other marks.
19. title-zhangdale.png — Same as item 18 with 长大了.
20. title-xiangce.png — Same as item 18 with 相册.
21. title-jiyibi.png — Same as item 18 with 记一笔.
22. title-shanggeyue.png — Same as item 18 with 上个月.

Start now with item 0.
```

## 做完以后

告诉我图都放进了 `gpt-assets/`，后面由我来：
- 把界面图当作视觉候选，再做一次复核，有问题列给你；
- 给每张图记下来源和文件哈希（生成途径记为「常浩手动用 GPT」，模型和质量参数无法得知，记为 not_exposed）；
- 把插画、图标、高光、标题字处理成透明背景，整理成组件板；
- 做 T1b 复核，然后请你批准一个具体版本。

界面里会变的字，比如名字、日期、你写的记录，开发时还是要用字体来显示，图里的手写效果只能尽量贴近。这一步到实现时我再处理，现在不用管。
