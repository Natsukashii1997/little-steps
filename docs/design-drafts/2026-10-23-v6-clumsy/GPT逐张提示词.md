# GPT 逐张提示词（第 1–22 张）

2026-10-23。第 0 张定妆图已经生成（宝宝三个姿势，加叶子、摇铃、铅笔），可以用，请存成 `gpt-assets/00-anchor.png`。

## 用法

- 就在生成第 0 张的那个对话里接着发，一次粘一个代码框，出一张存一张。
- **后面不要再加「使用 $clumsy-handwriting」那句**。那个技能会把海报母版整段放在最前面，要求「只留一个标题、一两组短句」，和满屏文字的界面冲突。需要的母版原句我已经写进每条提示词里了。
- 不满意就在同一个对话里说「重画」，或者直接说哪里要改。
- 第 1 张首页定下字体、边距和底栏的样子，后面的界面都照它画。首页满意了再往后走。

---

### 第 1 张：screen-1-home.png（本月首页）

```
第 1 张，文件名 screen-1-home.png。只画这一张。
Keep exactly the baby and drawing style of the accepted item 0. Use the two reference posters attached earlier only for the feel of the hand-lettered title and the neat handwriting.

Screen rules: 1024x1536 portrait canvas. Draw one flat phone screen at the true proportion 390:844 (about 710 px wide, full 1536 px tall), centered; plain white outside; mark the screen edge only with a very faint light grey rounded outline; no device frame, no status-bar icons. Inside: near-white paper with very subtle paper texture, not yellowed. Three text levels only: (1) one large hand-lettered title, rough and clumsy, with obvious stroke-thickness contrast from uneven pressure, slightly crooked, no ink stains, no brush or dry-brush effect; (2) section labels and list items in a neat, comfortable gel-pen handwriting with steady pressure, clearly legible, one size for items and a slightly larger size for section labels; (3) small warm-grey sans-serif for dates, counts and hints. All left text starts on one shared left margin (about 6% of the screen width); all right-side values end on one shared right margin; rows evenly spaced with generous line height; same whitespace between sections; nothing rotated. No cards, boxes, borders, divider lines, shadows or gradients. Pale blue = selected or current state; light green = the single main action. Chinese text exactly as given, character for character, nothing extra, no English.

Content, top to bottom:
- Small grey info, top left: 10月23日 周五
- Screen title, large hand-lettered, top left: 小满
- Below the title, handwriting: 3 个月 2 天
- Handwriting sentence on two lines: 这个月， / 趴着能抬头了。  then small grey info: 10月18日 家里记的
- Illustration on the right side, beside the title and sentence, no larger than one fifth of the screen: the baby sleeping peacefully on its back on a small flat mat; nothing else on the mat (no pillow, no blanket, no toys).
- Section label: 这个月要做的   small grey info after it: 2 件，会提前提醒
  - Row: left: a small hand-drawn open circle + 3 月龄儿保 | right: a tiny pale blue dot + 已约 10月28日
  - Row: left: a small hand-drawn open circle + 本月疫苗 | right: 定个日期 →
- Section label: 上个月的回顾   small grey info under it: 测量 2 次，观察 6 条，照片 128 张 | right: 写一句 →
- Main action, bottom right just above the tab bar: a hand-drawn round button with a "+" inside and a light green watercolor wash; handwritten label under it: 记一笔
- Bottom tab bar: four handwritten labels 本月 阶段 成长 相册, evenly spaced, no icons, no bar background; 本月 is black with a tiny pale blue dot under it; the other three are warm grey.
```

### 第 2 张：screen-2-stage.png（阶段）

```
第 2 张，文件名 screen-2-stage.png。只画这一张。
Match the accepted home screen (item 1) exactly: same title lettering, same handwriting, same small grey text, same margins, spacing, status marks and tab bar. Same baby and drawing style as item 0.

Screen rules: 1024x1536 portrait canvas; one flat phone screen at 390:844 (about 710 px wide, full height), centered; plain white outside; faint light grey rounded outline; no device frame, no status-bar icons. Near-white paper with very subtle texture. Three text levels only: one large clumsy hand-lettered title; neat gel-pen handwriting for labels and items; small warm-grey sans-serif for dates and hints. One shared left margin, one shared right margin, rows evenly spaced, nothing rotated. No cards, boxes, borders, dividers, shadows or gradients. Pale blue = selected or current; light green = the single main action; at most ONE light green highlighter stroke on the screen. Chinese text exactly as given, nothing extra.

Content, top to bottom:
- Small grey info, top left: 3–4 月龄，10月21日至11月20日
- Screen title, large hand-lettered, top left: 这个月
- Illustration on the right of the title: a wall calendar page with two binder rings and one spot loosely circled with a light green watercolor ring; no numbers, no letters on the calendar.
- Section label: 要安排的   small grey: 有日期，会提前提醒
  - Row: left: open circle + 3 月龄儿保, with a small grey line under it: 建议 10月21日至11月4日 | right: a tiny pale blue dot + 已约 10月28日
  - Row: left: open circle + 本月疫苗, with a small grey line under it: 建议 11月2日前，以门诊通知为准 | right: 定个日期 → with the screen's one light green highlighter stroke under it
- Section label: 可以陪宝宝玩的   small grey: 不做也没关系
  - Row: left: 清醒时趴一会儿 | right: a small check mark + 10月20日 试过
  - Row: left: 说说话，停下来等宝宝回应 | right: 试过了 →
  - Row: left: 让宝宝握住小摇铃 | right: a small check mark + 10月22日 试过
- Section label: 要留意的   small grey: 看看就好，不用打卡
  - Row: left: 睡觉仰卧，床上不放软东西 | right: 看看 →
  - Row: left: 哪些情况要尽快看医生 | right: 看看 →
- Small grey note near the bottom: 示例内容，以儿保医生的意见为准。
- Bottom tab bar: 本月 阶段 成长 相册; 阶段 is black with a tiny pale blue dot under it; the others warm grey.
```

### 第 3 张：screen-3-growth.png（成长）

```
第 3 张，文件名 screen-3-growth.png。只画这一张。
Match the accepted home screen (item 1) exactly: same title lettering, handwriting, small grey text, margins, spacing, status marks and tab bar. Same drawing style as item 0.

Screen rules: 1024x1536 portrait canvas; one flat phone screen at 390:844 (about 710 px wide, full height), centered; plain white outside; faint light grey rounded outline; no device frame, no status-bar icons. Near-white paper with very subtle texture. Three text levels only: one large clumsy hand-lettered title; neat gel-pen handwriting for labels, items and numbers; small warm-grey sans-serif for units, dates and hints. One shared left margin, one shared right margin, rows evenly spaced, nothing rotated. No cards, boxes, borders, dividers, shadows, charts or gradients. Pale blue = selected or current. Chinese text and numbers exactly as given, nothing extra.

Content, top to bottom:
- Small grey info, top left: 截至 10月23日
- Screen title, large hand-lettered, top left: 长大了
- Illustration on the right of the title: a small flowerpot with a pale blue wash and a sprout with two light green leaves; no measuring marks, no numbers.
- Three measurements in one row, evenly spaced. Each: a number in handwriting, medium-large, followed by a small grey unit, and a small grey line under it:
  61.2 cm, under it: 身高，比上次 +3.2 | 6.1 kg, under it: 体重，+0.7 | 40.1 cm, under it: 头围，+1.1
- Row: left, small grey: 10月12日 社区儿保量的，共 4 次 | right: 看曲线 →
- Section label: 家里看到的   small grey: 随手记下的变化
  - Row: left: small check mark + 趴着能抬头 | right: 10月18日
  - Row: left: small check mark + 逗一逗会笑出声 | right: 10月9日
  - Row: left: small dashed circle + 两只手碰到一起 | right: 还没看到
  - Row: left: short dash + 翻身 (in warm grey) | right, warm grey: 没记过
- Section label: 医生说   small grey: 原话照记
  - Handwriting quote: 「生长正常，注意左右换着睡。」
  - Small grey info: 10月12日 2 月龄儿保
  - Small hand-drawn exclamation mark + 医生提示要留意：睡姿
- Section label: 家里在留意   small grey: 2 / 3 条
  - One line with two short items, each after a tiny pale blue dot: 夜里醒 3 次左右    总朝右边睡
- Bottom tab bar: 本月 阶段 成长 相册; 成长 is black with a tiny pale blue dot under it; the others warm grey.
```

### 第 4 张：screen-4-album.png（相册）

```
第 4 张，文件名 screen-4-album.png。只画这一张。
Match the accepted home screen (item 1) exactly: same title lettering, handwriting, small grey text, margins, spacing and tab bar. Same drawing style as item 0.

Screen rules: 1024x1536 portrait canvas; one flat phone screen at 390:844 (about 710 px wide, full height), centered; plain white outside; faint light grey rounded outline; no device frame, no status-bar icons. Near-white paper with very subtle texture. Three text levels only: one large clumsy hand-lettered title; neat gel-pen handwriting for labels and items; small warm-grey sans-serif for counts and hints. One shared left margin, one shared right margin, nothing rotated. No cards, boxes, borders, dividers, shadows or gradients. Light green = the single main action; at most ONE light green highlighter stroke on the screen. Chinese text exactly as given, nothing extra.

Content, top to bottom:
- Small grey info, top left: 312 张照片，28 段视频
- Screen title, large hand-lettered, top left: 相册
- Illustration on the right of the title: a small boxy film camera, front view, pale blue wash in the lens, a tiny light green dot as the flash; no brand, no letters.
- Handwriting sentence on two lines: 原片都好好存着， / 换手机也看得到。
- Small grey info: 存储方式待定
- Month label in handwriting: 3 月龄   small grey: 10月21日起，46 张，7 段
  - A 3-column grid of 9 square thumbnails with small even gaps and very slightly rounded corners. They are ordinary phone photos with natural, unfiltered colors of a baby's everyday life: tiny hands, feet, the baby sleeping seen from above, a bath towel, a parent's finger being held, a stroller blanket. Faces are not the focus. Two tiles show a small white pill with a video duration: 0:42 and 1:08. One tile has a tiny light green dot in its top right corner.
  - Below the grid, right aligned: 展开这个月 →
- Month label: 2 月龄   small grey: 128 张，15 段   with only the top edge of the next row of thumbnails visible.
- Bottom row just above the tab bar: left: 全部导出 | right: 放照片进来 + with the screen's one light green highlighter stroke under it.
- Bottom tab bar: 本月 阶段 成长 相册; 相册 is black with a tiny pale blue dot under it; the others warm grey.
```

### 第 5 张：screen-5-quick.png（随手记弹层）

```
第 5 张，文件名 screen-5-quick.png。只画这一张。
Match the accepted home screen (item 1) exactly: same title lettering, handwriting, small grey text and margins. Same drawing style as item 0. No tab bar on this screen.

Screen rules: 1024x1536 portrait canvas; one flat phone screen at 390:844 (about 710 px wide, full height), centered; plain white outside; faint light grey rounded outline; no device frame, no status-bar icons, no keyboard. Three text levels only: one large clumsy hand-lettered title; neat gel-pen handwriting for labels and items; small warm-grey sans-serif for hints. One shared left margin, one shared right margin, nothing rotated. No cards, boxes, borders, dividers or gradients. Pale blue = selected; light green = the single main action; at most ONE light green highlighter stroke on the screen. Chinese text exactly as given, nothing extra.

Content:
- At the very top, the home screen from item 1 is visible, dimmed by a soft grey overlay.
- A bottom sheet covers the screen from about 15% of its height down: near-white paper, top corners rounded, a short hand-drawn grab handle at the top center.
- Inside the sheet, top to bottom:
  - Row: left: sheet title, large hand-lettered: 记一笔 | right, small grey: 取消
  - Small grey line: 随手记下来，月底会整理进回顾。
  - Five choices in one row, evenly spaced, each a small hand-drawn icon above a handwritten label: an open eye — 观察; a short soft measuring tape — 测量; a small camera — 照片; a baby bottle — 照护; a speech bubble with a question mark — 问医生. 观察 is selected: black label with a short pale blue highlighter stroke under it. The other four labels are warm grey.
  - Row: handwriting 看到了吗, then two choices: 看到了 (selected: black with a short pale blue stroke under it) and 留意了，还没看到 (warm grey)
  - The note being written, in handwriting, slightly larger than list items: 抓着我的手指不放，好久都不松开。 with one long, slightly wobbly hand-drawn line under it as the input line.
  - Row: one small square photo thumbnail, then the text: + 照片或视频
  - Row: small grey: 今天 10月23日 14:20, then handwriting: 改时间
  - Bottom row: left, small grey: 会出现在本月和成长里 | right: 记下, large handwriting, with the screen's one light green highlighter stroke under it.
```

### 第 6 张：screen-6-review-top.png（月度回顾·上半）

```
第 6 张，文件名 screen-6-review-top.png。只画这一张。
This is the top half of a long scrolling page. Match the accepted home screen (item 1) exactly: same title lettering, handwriting, small grey text, margins, spacing and status marks. Same drawing style as item 0. No tab bar.

Screen rules: 1024x1536 portrait canvas; one flat phone screen at 390:844 (about 710 px wide, full height), centered; plain white outside; faint light grey rounded outline; no device frame, no status-bar icons. Near-white paper with very subtle texture. Three text levels only: one large clumsy hand-lettered title; neat gel-pen handwriting for labels, items and numbers; small warm-grey sans-serif for units, dates and notes. One shared left margin, one shared right margin, rows evenly spaced, nothing rotated. No cards, boxes, borders, dividers, shadows or gradients. Chinese text and numbers exactly as given, nothing extra.

Content, top to bottom:
- Top left, small handwriting: ‹ 本月
- Screen title, large hand-lettered, top left: 上个月
- Illustration on the right of the title: an open notebook seen from above with a few wavy lines (no real letters) and a pencil with a pale blue body lying across it.
- Small grey info: 9月21日至10月20日，2 月龄
- Handwriting sentence on two lines: 这个月替你理好了， / 看一遍，写一句就收好。
- Section label: 长了多少   small grey: 9月20日到10月12日，两次测量
  - Three changes in one row, evenly spaced; each a handwriting number with a small grey unit and a small grey line under it:
    +3.2 cm, under it: 身高，现在 61.2 | +0.7 kg, under it: 体重，现在 6.1 | +1.1 cm, under it: 头围，现在 40.1
- Section label: 看到的变化   small grey: 家里记的 6 条
  - Row: left: small check mark + 逗一逗会笑出声 | right: 10月9日
  - Row: left: small check mark + 眼睛跟着人走 | right: 9月30日
  - Row: left: small dashed circle + 两只手碰到一起, with a small grey line under it: 留意过 2 次，还没看到
  - Handwriting: 还有 3 条 →
- Section label: 办完的事   small grey: 2 件
  - Row: small check mark + 2 月龄儿保, with a small grey line under it: 10月12日，医生：「生长正常，注意左右换着睡。」
  - Row: small check mark + 疫苗, with a small grey line under it: 9月21日，按接种本记了实际日期
```

### 第 7 张：screen-7-review-bottom.png（月度回顾·下半）

```
第 7 张，文件名 screen-7-review-bottom.png。只画这一张。
This is the bottom half of the same long page as item 6, continuing it with the same margins and text styles. Match the accepted home screen (item 1) exactly. Same drawing style as item 0. No tab bar, no screen title.

Screen rules: 1024x1536 portrait canvas; one flat phone screen at 390:844 (about 710 px wide, full height), centered; plain white outside; faint light grey rounded outline; no device frame, no status-bar icons. Near-white paper with very subtle texture. Neat gel-pen handwriting for labels and items; small warm-grey sans-serif for hints and notes. One shared left margin, one shared right margin, rows evenly spaced, nothing rotated. No cards, boxes, borders, dividers, shadows or gradients. Pale blue = selected; light green = the single main action; at most ONE light green highlighter stroke on the screen. Chinese text exactly as given, nothing extra.

Content, top to bottom:
- Section label: 挑了三张   small grey: 从 128 张里挑的，点一下可以换
  - Three square photo thumbnails in one row: ordinary natural-color phone photos of a baby's everyday life; the middle one shows a small white pill: 0:15
- Section label: 家里在留意   small grey: 还要不要继续看着
  - Row: left: 夜里醒 3 次左右 | right: 继续留意 (selected: black with a short pale blue stroke under it), then 不用了 (warm grey)
  - Row: left: 总朝右边睡 | right: 继续留意 (selected, same style), then 不用了 (warm grey)
- Section label: 你写一句   small grey: 只有这一步要你动笔
  - Grey handwriting placeholder: 比如：第一次笑出声那天，全家都围过来了。 with one long, slightly wobbly hand-drawn line under it; at the right end of the line, small grey: 0 / 200
- Main action, left aligned, large handwriting: 收好这个月, with the screen's one light green highlighter stroke under it.
- Small grey note: 收好后还能改。没有记录的地方，不代表没有变化。
```

### 第 8 张：sheet-components.png（组件板）

```
第 8 张，文件名 sheet-components.png。只画这一张。
A tidy style sheet of the app's recurring parts, in exactly the same look as the accepted screens (items 1 to 7). Canvas 1536x1024 landscape, NOT a phone screen. Near-white paper with very subtle texture. Arrange the groups in a loose 4-column layout with generous whitespace; no boxes, no borders, no divider lines. Each group has a small warm-grey sans-serif label above it. Chinese text exactly as given, nothing extra.

Groups:
- 颜色: five hand-painted color dabs in a row: near-white paper, black ink, warm grey, pale blue, light green.
- 字: one large hand-lettered sample 这个月; one neat handwriting sample 清醒时趴一会儿; one small grey sans-serif sample 建议 11月2日前
- 状态: five rows, each a small hand-drawn mark followed by words: open circle 要安排; check mark 办完了; dashed circle 还没看到; short dash 没记过 (warm grey); exclamation mark 医生提示要留意
- 动作: 记下 with a light green highlighter stroke under it; 看看 →; 看到了 with a short pale blue stroke under it (selected) next to 留意了，还没看到 in warm grey
- 底栏: the four tab labels 本月 阶段 成长 相册, with 本月 black and a tiny pale blue dot under it, the others warm grey
- 输入: grey placeholder handwriting 比如：抓着我的手指不放。 above one long, slightly wobbly hand-drawn line
- 照片格: three square photo thumbnails, one with a small white pill 0:42, one with a tiny light green dot in its corner
- 空着的时候: the small camera illustration from item 4, the handwriting line 这个月还没有照片。 and under it 放照片进来 + with a light green highlighter stroke under it
```

---

第 9–17 张是开发要用的单个素材：纯白底，每张一个东西，不带字。

### 第 9 张：ill-home-sleep.png

```
第 9 张，文件名 ill-home-sleep.png。只画这一张。
The same baby and drawing style as item 0 (black fineliner lines with natural pressure variation, light transparent watercolor wash slightly outside the lines, only pale blue and light green as accents, naive yet calm and tidy).
The baby sleeping peacefully on its back on a small flat mat, arms relaxed up beside its head, eyes closed. Nothing else on the mat: no pillow, no blanket, no toys. A short wobbly ground line, with one or two tiny light green dots near it.
Canvas 1024x1024 square. One isolated element, centered, at least 12% empty margin on every side, plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 10 张：ill-home-leaf.png

```
第 10 张，文件名 ill-home-leaf.png。只画这一张。
The same baby and drawing style as item 0 (black fineliner lines, light watercolor wash, only pale blue and light green as accents).
The baby lying on its back on a small flat mat, looking up with curious dot eyes at one light green leaf drifting in the air above it. A short ground line with three tiny grass ticks. Only the onesie (pale blue) and the leaf (light green) have color.
Canvas 1024x1024 square. One isolated element, centered, at least 12% empty margin, plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 11 张：ill-home-rattle.png

```
第 11 张，文件名 ill-home-rattle.png。只画这一张。
The same baby and drawing style as item 0 (black fineliner lines, light watercolor wash, only pale blue and light green as accents).
The baby lying on its back, both hands holding a small round rattle (pale blue ball, light green handle), smiling with gently closed eyes. A short ground line.
Canvas 1024x1024 square. One isolated element, centered, at least 12% empty margin, plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 12 张：ill-stage-calendar.png

```
第 12 张，文件名 ill-stage-calendar.png。只画这一张。
Same drawing style as item 0 and the calendar in item 2 (black fineliner lines, light watercolor wash, only pale blue and light green as accents).
A single wall calendar page with two binder rings at the top and a hand-drawn header line. A few faint short dashes loosely suggest rows; it must never look like a precise grid. One spot is loosely circled with a light green watercolor ring. No numbers, no letters, no weekday names anywhere.
Canvas 1024x1024 square. One isolated element, centered, at least 12% empty margin, plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 13 张：ill-growth-sprout.png

```
第 13 张，文件名 ill-growth-sprout.png。只画这一张。
Same drawing style as item 0 and the sprout pot in item 3.
A small flowerpot with a pale blue watercolor wash; a thin stem rising from it with two light green leaves. A short ground line under the pot. No measuring marks, no ruler, no numbers.
Canvas 1024x1024 square. One isolated element, centered, at least 12% empty margin, plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 14 张：ill-album-camera.png

```
第 14 张，文件名 ill-album-camera.png。只画这一张。
Same drawing style as item 0 and the camera in item 4.
A small boxy film camera seen from the front; a round lens with a pale blue wash in the glass; a tiny light green dot as the flash light; two short spark ticks near the top right corner. No brand name, no letters.
Canvas 1024x1024 square. One isolated element, centered, at least 12% empty margin, plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 15 张：ill-review-notebook.png

```
第 15 张，文件名 ill-review-notebook.png。只画这一张。
Same drawing style as item 0 and the notebook in item 6.
An open notebook seen from above at a slight angle; a few short wavy lines on the left page suggest handwriting but are not real letters; a pencil with a pale blue body rests across the right page, with a tiny light green dot at its end.
Canvas 1024x1024 square. One isolated element, centered, at least 12% empty margin, plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 16 张：icons-quick.png

```
第 16 张，文件名 icons-quick.png。只画这一张。
Same drawing style as item 0 and the five icons in item 5.
Five small app icons in one row, evenly spaced, identical size and identical line weight; lines slightly thicker than in the illustrations so they stay readable at 36 px: (1) an open eye with a pale blue iris; (2) a short soft measuring tape, slightly curled; (3) a small camera with a pale blue lens; (4) a baby bottle; (5) a speech bubble with a question mark inside. Only the eye's iris and the camera lens have color. No labels.
Canvas 1536x1024 landscape. Plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

### 第 17 张：marks-highlight.png

```
第 17 张，文件名 marks-highlight.png。只画这一张。
Highlighter strokes in exactly the same style as the light green and pale blue strokes in the accepted screens.
Six separate horizontal hand-painted highlighter strokes, like one quick swipe of a soft marker under a word: three pale blue (close to #A8C3DE) in the top row and three light green (close to #C2D58A) in the bottom row. Each stroke is about five times as long as it is tall, with slightly uneven edges, a little lighter at both ends, and a translucent watercolor texture. Lots of empty space between strokes. Nothing else.
Canvas 1536x1024 landscape. Plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text.
```

---

第 18–22 张是单独的标题字：纯白底，必须逐字写对。

### 第 18 张：title-zhegeyue.png

```
第 18 张，文件名 title-zhegeyue.png。只画这一张。
The hand-lettered screen title 这个月, alone, matching exactly the large title lettering in the accepted screens: rough handwritten lettering without ink stains, the clumsy feeling of not knowing how much pressure to apply, exaggerated stroke-thickness contrast, slightly crooked character structures, uneven letter spacing; black or dark charcoal; no crayon, no dry-brush, no ink bleeding, no brush marks.
Write exactly these three Simplified Chinese characters, in this order: 这个月. Correct standard characters only: no invented strokes, no traditional forms, no extra characters, no punctuation.
Canvas 1536x1024 landscape. One horizontal line, centered, about 70% of the width. Plain pure white background (#FFFFFF). No paper texture, no shadow, no underline, no highlight, no illustration, no signature.
```

### 第 19 张：title-zhangdale.png

```
第 19 张，文件名 title-zhangdale.png。只画这一张。
Same as item 18 in every way: same lettering style, stroke weight and character size. Only the characters change.
Write exactly these three Simplified Chinese characters, in this order: 长大了. Correct standard characters only, nothing extra.
Canvas 1536x1024 landscape, one horizontal line, centered, about 70% of the width, plain pure white background (#FFFFFF), nothing else.
```

### 第 20 张：title-xiangce.png

```
第 20 张，文件名 title-xiangce.png。只画这一张。
Same as item 18 in every way: same lettering style, stroke weight and character size. Only the characters change.
Write exactly these two Simplified Chinese characters, in this order: 相册. Correct standard characters only, nothing extra.
Canvas 1536x1024 landscape, one horizontal line, centered, plain pure white background (#FFFFFF), nothing else.
```

### 第 21 张：title-jiyibi.png

```
第 21 张，文件名 title-jiyibi.png。只画这一张。
Same as item 18 in every way: same lettering style, stroke weight and character size. Only the characters change.
Write exactly these three Simplified Chinese characters, in this order: 记一笔. Correct standard characters only, nothing extra.
Canvas 1536x1024 landscape, one horizontal line, centered, about 70% of the width, plain pure white background (#FFFFFF), nothing else.
```

### 第 22 张：title-shanggeyue.png

```
第 22 张，文件名 title-shanggeyue.png。只画这一张。
Same as item 18 in every way: same lettering style, stroke weight and character size. Only the characters change.
Write exactly these three Simplified Chinese characters, in this order: 上个月. Correct standard characters only, nothing extra.
Canvas 1536x1024 landscape, one horizontal line, centered, about 70% of the width, plain pure white background (#FFFFFF), nothing else.
```
