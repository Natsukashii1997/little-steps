# V6 素材生成清单与提示词（给 GPT 用）

> 已被同目录《GPT开场交接提示词》取代（10-23 常浩要求所有画面都交给 GPT 生成，含整屏界面）。本文件仅留作记录，不要再用。

2026-10-23。用途：婴儿工作台 V6「拙趣手写」的插画、小图标、高光一撇和固定标题字。正文、数字、名字用霞鹜文楷，不在这里生成。

## 一、怎么生成（先看这一节）

1. **同一个对话里按顺序做**。先做第 0 张「定妆图」，挑一张满意的；之后每一张都把这张定妆图作为附图一起发，保证宝宝长相和画风一致。标题字另起一个对话（见第四节）。
2. **第 0 张额外附两张参考**：你那 4 张里的第 1 张（设计提示词分享系列）和第 2 张（舒服，自然在里）。它们是钢笔线加淡水彩，和我们要的一样。第 3、4 张带品牌字样，而且是蜡笔、彩铅质感，不要附。
3. **每条提示词 = 公共段 + 这一张的段落**，按下面写的顺序整段复制粘贴，不要删改。公共段是英文，GPT 对英文画面描述更稳；标题里的中文字保持原样。
4. **背景一律要纯白，不要透明**。让 GPT 出「透明背景」时，它常会画出一层假的灰白格子。白底的图我来处理成透明。
5. **每张可以多出几次，挑最好的一张**。用下载按钮存原图（PNG），不要截图。
6. **挑图时逐项看**：
   - 宝宝和定妆图是同一个样子；
   - 线条粗细和其他几张接近；
   - 只有淡蓝、浅绿两种颜色，而且面积很小；
   - 画面里没有任何多余的字、数字、签名、灰白格子、阴影或底色块；
   - 宝宝比例正常，手指不多不少，看着舒服；
   - 标题字逐字核对，不能有错字、繁体，也不能有像字却不是字的笔画。
7. **存放**：放进本目录下的 `gpt-assets/`，按第二节的文件名命名。如果改过某条提示词，把改后的原话记在 `gpt-assets/改动.txt`。放好告诉我，后面由我接手：处理透明背景、计算文件哈希、写生成记录、放进样稿，再做 T1b 复核。

## 二、生成哪些（共 15 张）

| 顺序 | 文件名 | 内容 | 用在哪 | 画幅 |
|---|---|---|---|---|
| 0 | `00-anchor.png` | 宝宝定妆三个姿势＋三个小道具 | 只给后面当参考，不进界面 | 横 1536×1024 |
| 1 | `ill-home-sleep.png` | 仰面睡在小垫子上 | 本月首页（三张轮换） | 方 1024×1024 |
| 2 | `ill-home-leaf.png` | 躺着看一片飘着的叶子 | 本月首页（三张轮换） | 方 |
| 3 | `ill-home-rattle.png` | 双手握小摇铃 | 本月首页（三张轮换） | 方 |
| 4 | `ill-stage-calendar.png` | 日历，圈了一天，不写数字 | 阶段 | 方 |
| 5 | `ill-growth-sprout.png` | 小盆栽发芽，没有刻度 | 成长 | 方 |
| 6 | `ill-album-camera.png` | 小相机 | 相册；相册空着时 | 方 |
| 7 | `ill-review-notebook.png` | 摊开的本子和铅笔 | 月度回顾；没有记录时 | 方 |
| 8 | `icons-quick.png` | 五个小图标：眼睛、软尺、相机、奶瓶、带问号的对话框 | 随手记的五类 | 横 |
| 9 | `marks-highlight.png` | 淡蓝三笔、浅绿三笔高光 | 状态和动作下面那一撇 | 横 |
| 10 | `title-zhegeyue.png` | 标题字「这个月」 | 阶段 | 横 |
| 11 | `title-zhangdale.png` | 标题字「长大了」 | 成长 | 横 |
| 12 | `title-xiangce.png` | 标题字「相册」 | 相册 | 横 |
| 13 | `title-jiyibi.png` | 标题字「记一笔」 | 随手记 | 横 |
| 14 | `title-shanggeyue.png` | 标题字「上个月」 | 月度回顾 | 横 |

几点说明：

- 首页用三张日常小画轮换，不画「抬头」这类具体本领。这样插画不会和宝宝的真实记录对不上，也不会让人觉得「这个月应该会了」（T1a 第 5 条）。
- 睡觉那张按安全睡姿画：仰卧，旁边不放枕头、被子和玩具。
- 日历不写数字、盆栽不画刻度，原因相同：插画里不放会变的数据。
- 纸纹不用生成。界面底色本身带纸纹，素材都是白底，处理成透明后叠在上面。
- 「要安排／办完了／还没看到／没记过／医生提示」这几个状态小记号，我继续用统一笔画的矢量图画，不需要生成。

## 三、插画、图标、高光（第 0–9 张）

### 公共段 A：画风（第 0–9 张每次都先粘这一段）

```
STYLE — keep identical for every image in this set.
Role: Senior Eastern visual typography designer, handwritten type designer, and naturalistic illustration art director.
Overall style (verbatim from the clumsy-handwriting master prompt): "Modern white background, natural innocence, minimalist literary poster, plain handwritten feeling, clumsy authenticity, low design trace, quiet whitespace; the overall impression should be like a handmade work slowly completed on white paper by someone earnest but not skilled at drawing or writing."
Line style (verbatim): "No guide lines, grids, decorative frames, decorative underlines, or intentional geometric composition; all text and illustration lines should feel natural, casual, and slightly unstable; illustration lines may vary in thickness, but must not be refined."
Illustration (verbatim): "The illustration should look like a clumsy painter holding a brush but forgetting how to draw; it should not pursue beauty or accuracy."
Accent color (verbatim): "Use at most 2 low-saturation accent colors; colors may be applied to small color blocks, light fills, one local stroke, or a few small dots; accents must feel like accidental traces of color, not strong decoration."
Palette for this set: black or dark charcoal lines only; accents only pale blue (close to #A8C3DE) and light green (close to #C2D58A); colored area very small.
Medium: black fineliner ink lines with natural pressure variation; accent fills are a light, transparent watercolor wash, slightly misregistered and going a little outside the lines. The same line weight across the whole set.
Finish: naive and simple, yet calm, tidy, well balanced and pleasant to look at; confident continuous lines, not shaky, not scribbly, not messy.
Asset format: one isolated element for a mobile app, centered, with generous empty margin (at least 12% on every side), on a plain pure white background (#FFFFFF). A short wobbly ground line or a few tiny grass ticks are allowed where stated. No paper texture, no shadow, no background color block, no frame, no checkerboard pattern, no text, no letters, no numbers, no signature, no watermark.
```

### 公共段 B：宝宝（画里有宝宝时，紧接在 A 后面粘）

```
CHARACTER — the same baby in every image.
A baby around 3 to 6 months old: big round head, chubby soft body, short limbs, a few short hair strands on top of the head, simple dot eyes or gently closed smiling eyes, a tiny curved mouth, no blush. Wears a plain onesie with a pale blue watercolor wash. Proportions read as a real infant, drawn simply; no realistic facial detail, no extra or missing fingers, no adult features.
```

### 第 0 张：定妆图（A + B + 下面这段；附参考第 1、2 张）

```
TASK: Character and style anchor sheet.
On one sheet, draw the baby from the CHARACTER block three times in one row, evenly spaced and small: (1) lying on its back, arms relaxed; (2) lying on its back holding a small round rattle with both hands; (3) lying on its tummy on a small flat mat, lifting its head a little. Below them, in a second row, draw three small props in the same style: a single leaf, a small round rattle, a pencil.
Use the attached reference posters only for line quality and watercolor feel. Do not copy their characters, objects, layout, or any text.
Canvas: 1536 x 1024, landscape.
```

### 第 1 张：睡觉（A + B + 这段；附定妆图）

```
TASK: Illustration "sleeping".
The same baby as in the attached anchor sheet, sleeping peacefully on its back on a small flat mat, arms relaxed up beside its head, eyes closed. Safe sleep: nothing else on the mat, no pillow, no blanket, no toys near the face. A short wobbly ground line under the mat; one or two tiny light green dots near the ground line.
Canvas: 1024 x 1024, square.
```

### 第 2 张：看叶子（A + B + 这段；附定妆图）

```
TASK: Illustration "watching a leaf".
The same baby as in the attached anchor sheet, lying on its back on a small flat mat, looking up with curious dot eyes at a single light green leaf drifting in the air above it. A short ground line with three tiny grass ticks. Only the onesie (pale blue) and the leaf (light green) have color.
Canvas: 1024 x 1024, square.
```

### 第 3 张：握摇铃（A + B + 这段；附定妆图）

```
TASK: Illustration "holding a rattle".
The same baby as in the attached anchor sheet, lying on its back, both hands holding a small round rattle (pale blue ball, light green handle), smiling with gently closed eyes. A short ground line.
Canvas: 1024 x 1024, square.
```

### 第 4 张：日历（A + 这段；附定妆图）

```
TASK: Illustration "calendar".
A single wall calendar page with two binder rings at the top and a hand-drawn header line. Inside the page, a few faint short dashes loosely suggest rows; it must not look like a precise grid. One spot is loosely circled with a light green watercolor ring. No numbers, no letters, no weekday names anywhere on the calendar.
Canvas: 1024 x 1024, square.
```

### 第 5 张：小盆栽（A + 这段；附定妆图）

```
TASK: Illustration "sprout".
A small flowerpot with a pale blue watercolor wash; a thin stem rising from it with two light green leaves. A short ground line under the pot. No measuring marks, no ruler, no numbers.
Canvas: 1024 x 1024, square.
```

### 第 6 张：小相机（A + 这段；附定妆图）

```
TASK: Illustration "camera".
A small boxy film camera seen from the front, a round lens with a pale blue wash in the glass, a tiny light green dot as the flash light, two short spark ticks near the top right corner. No brand name, no letters.
Canvas: 1024 x 1024, square.
```

### 第 7 张：本子和铅笔（A + 这段；附定妆图）

```
TASK: Illustration "notebook".
An open notebook seen from above at a slight angle; a few short wavy lines on the left page suggest handwriting but are not real letters; a pencil with a pale blue body rests across the right page, with a tiny light green dot at its end.
Canvas: 1024 x 1024, square.
```

### 第 8 张：随手记小图标（A + 这段；附定妆图）

```
TASK: Small icon sheet for an app, five icons.
Five small icons in one row, evenly spaced, identical size and identical line weight; lines slightly thicker than in the illustrations so they stay readable at 36 px: (1) an open eye with a pale blue iris; (2) a short soft measuring tape, slightly curled; (3) a small camera with a pale blue lens; (4) a baby bottle; (5) a speech bubble with a question mark inside. Only the eye iris and the camera lens have color. No labels.
Canvas: 1536 x 1024, landscape.
```

### 第 9 张：高光一撇（A + 这段；不用附图）

```
TASK: Highlighter marks sheet.
Six separate horizontal hand-painted highlighter strokes, like one quick swipe of a soft marker under a word: three in pale blue (close to #A8C3DE) in the top row and three in light green (close to #C2D58A) in the bottom row. Each stroke is about five times as long as it is tall, with slightly uneven edges, a little lighter at both ends, and a translucent watercolor texture. Lots of empty space between strokes. Nothing else on the canvas.
Canvas: 1536 x 1024, landscape.
```

## 四、标题字（第 10–14 张）

另起一个新对话，不附插画定妆图。先做「这个月」，挑一张满意的；之后四张都把它作为附图发，并在 TASK 前加一句：

```
Match the lettering style, stroke weight, and size of the attached title image exactly; only the characters change.
```

### 公共段 C：手写标题字（每张都先粘这一段）

```
TITLE LETTERING — lettering only, nothing else.
Role: Senior Eastern visual typography designer and handwritten type designer.
Lettering (verbatim from the clumsy-handwriting master prompt): "The font is rough handwritten lettering without ink stains; emphasize the clumsy feeling of not knowing how much pressure to apply, with exaggerated and obvious contrast in stroke thickness, some strokes suddenly becoming thicker or thinner, slightly crooked character structures, and inconsistent character sizes; avoid crayon, calligraphic dry-brush effects, ink bleeding, brush ink marks, and overly artistic effects."
Title style (verbatim): "black or dark charcoal; strong stroke-weight variation but no ink effect; slightly crooked forms, uneven letter spacing, unstable writing pressure"
Accuracy: every character must be the correct standard Simplified Chinese character, in the given order; no invented strokes, no traditional forms, no extra characters, no punctuation, no illustration, no underline, no highlight.
Format: one horizontal line, centered, filling about 70% of the canvas width, on plain pure white (#FFFFFF). No paper texture, no shadow, no frame, no checkerboard pattern, no signature.
Canvas: 1536 x 1024, landscape.
```

### 每张只换这一段

```
TASK: Write exactly these characters: 这个月
```

依次替换为：`长大了`、`相册`、`记一笔`、`上个月`。

如果某个字反复写错，就先跳过，告诉我是哪一个。那张标题我改用霞鹜文楷大字，或者继续用手画矢量字。

## 五、说明：和技能母版的关系

`clumsy-handwriting` 规定把海报母版逐字整段交给图像模型，产出的是整张海报（标题、副文、插画画在一起）。界面需要的是一个个拆开的素材，所以这里没有整段照搬：母版里关于画风、线条、颜色、字形的句子原文保留（上面标了 verbatim 的引号部分），只把输出对象改成单个白底素材，再加上同一个宝宝、安全睡姿、不放数据这几条界面需要的约束。母版的「not pursue beauty or accuracy」也原样保留，同时补了一句「看着舒服、线条稳」，对应你说的「拙但有章法」。
