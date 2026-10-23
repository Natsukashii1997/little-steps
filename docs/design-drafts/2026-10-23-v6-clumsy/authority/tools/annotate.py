# 量测标注图：在修正版标准屏上标出量到的字高、边距、区块间距、按钮和底栏（只作证据，不是视觉）。
# 用法：python -I annotate.py <标准屏修正版> <输出 png>
import sys
from PIL import Image, ImageDraw, ImageFont
S = 390 / 832
img = Image.open(sys.argv[1]).convert('RGB'); d = ImageDraw.Draw(img)
f = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 17)
RED = (214, 64, 64)
def pt(px): return f'{px * S:.1f}pt'
ROWS = [  # (y0, y1, x0, x1, 说明)
    (99, 125, 152, 346, '小字 small 14'), (168, 309, 144, 429, '名字 display-name 72'), (336, 385, 155, 391, '月龄 title 28'),
    (453, 493, 155, 297, '那句话 item 20'), (509, 557, 157, 429, ''), (580, 605, 157, 386, '小字 small 14'), (688, 748, 151, 490, '区块标题 title 28'),
    (800, 838, 223, 430, '条目 item 20'), (1026, 1081, 148, 478, '区块标题 title 28'), (1113, 1143, 152, 590, '小字 small 14'),
    (1414, 1458, 163, 860, '底栏 item 20'),
]
for y0, y1, x0, x1, t in ROWS:
    d.rectangle((x0, y0, x1, y1), outline=RED, width=1)
    if t: d.text((x1 + 6 if x1 < 700 else x0, y0 - 20 if x1 >= 700 else y0), f'{t}｜墨迹 {pt(y1 - y0 + 1)}', font=f, fill=RED)
d.line((96, 1000, 152, 1000), fill=RED, width=2); d.text((98, 1004), f'页边 {pt(56)}', font=f, fill=RED)
d.line((883, 975, 927, 975), fill=RED, width=2); d.text((835, 980), f'右 {pt(44)}', font=f, fill=RED)
d.line((140, 922, 140, 1026), fill=RED, width=2); d.text((100, 960), pt(104), font=f, fill=RED)
d.line((140, 605, 140, 688), fill=RED, width=2); d.text((100, 635), pt(83), font=f, fill=RED)
d.rectangle((757, 1204, 879, 1325), outline=RED, width=1); d.text((600, 1250), f'圆按钮 直径 {pt(122)}', font=f, fill=RED)
d.text((300, 1490), f'外框内宽 832px = 390pt，1px = {S:.3f}pt', font=f, fill=RED)
img.save(sys.argv[2], optimize=True)
