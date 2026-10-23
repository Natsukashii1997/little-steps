# GPT 重画提示词（第 7、16、25 张）

2026-10-23。对应 T1a 第二轮的 G1、G3、G9，以及常浩 10-23 定下的「视频时长用深色小标签」。

## 用法

- 在原来那个对话里接着发（那里有定妆图和前面所有界面），一次粘一个代码框，出一张存一张。
- 不要加「使用 $clumsy-handwriting」。
- 每条都是「只改一处、其余照旧」。GPT 如果把别的地方也改了，在同一个对话里说「其他地方和上一版保持一致，只改 X」，让它重画。
- 存成同名文件，三张一起打包放到下载目录（或直接给我路径）。原版由 Claude 移到 `gpt-assets/superseded/` 保留，不要自己覆盖。
- 第 16 张也可以不重画：Claude 能用原图像素把软尺换成淡蓝（补充组件板里已经这样做过）。

---

### 第 7 张：screen-7-review-bottom.png（月度回顾·下半）

要改：中间那张照片里画了一只手拿着白色药片对着宝宝（G1），换成普通的宝宝照片。视频时长标签保持深色。

```
第 7 张重画，文件名 screen-7-review-bottom.png。只画这一张。
Redraw item 7 with one change only. Keep everything else exactly as in your previous item 7: same layout, margins, all text, handwriting, the two pale blue strokes under 继续留意, and the one light green stroke under 收好这个月. Keep the first and third photos as they are.

Change only the middle photo: an ordinary natural-color phone photo of the baby lying on its back on a soft blanket, eyes open, smiling, both hands relaxed near its chest. No adult hands in the photo, nothing held toward the baby, nothing near the baby's mouth: no medicine, no tablet, no spoon, no bottle, no pacifier.
In the bottom-left corner of that middle photo, a small dark semi-transparent rounded tag with white text: ▶ 0:15

No red anywhere. Chinese text exactly as before, nothing extra.
```

收图时看：中间照片里没有手、没有药片或任何东西靠近嘴；时长标签是深色底白字、在左下角；其他地方和上一版一样。

---

### 第 16 张：icons-quick.png（记一笔五个类型图标）

要改：软尺是黄色（G3），改成淡蓝。其他四个图标不动。

```
第 16 张重画，文件名 icons-quick.png。只画这一张。
Redraw item 16 with one change only: the measuring tape (the second icon) is pale blue, close to #B3CBE0, the same pale blue as the eye's iris and the bottle cap, with a black outline and black tick marks. Not yellow, not beige, no other color.
Keep the other four icons exactly as before: same shapes, size, line weight, spacing and colors. Same canvas size as before.
Plain pure white background (#FFFFFF). No paper texture, no shadow, no frame, no text, no signature.
```

收图时看：软尺是淡蓝、和眼睛的蓝一样；五个图标大小、线粗一致；背景纯白，没有纸纹和阴影。

---

### 第 25 张：screen-10-quick-doctor.png（记一笔·问医生）

要改：五个类型名被改成了「身高体重」「打疫苗」（G9），必须和第 5 张一样；软尺同样改淡蓝。

```
第 25 张重画，文件名 screen-10-quick-doctor.png。只画这一张。
Redraw item 25 with these fixes. Keep everything else exactly as in your previous item 25: the dimmed home screen at the top, the sheet, layout, margins and all other text.
1. The five type labels under the icons must be exactly, left to right: 观察  测量  照片  照护  问医生 — the same five words as in item 5. Do not write 身高体重, 打疫苗 or any other words.
2. The five icons are the same as in item 5, except the measuring tape is pale blue (the same pale blue as the eye's iris), not yellow.
3. 问医生 stays selected: black, with a short pale blue stroke under it. The other four labels are warm grey.
No red anywhere. Chinese text exactly as given, nothing extra.
```

收图时看：五个字逐字是「观察、测量、照片、照护、问医生」；只有「问医生」是黑字加淡蓝下划；软尺淡蓝；整屏只有「记下」下面一笔浅绿。
