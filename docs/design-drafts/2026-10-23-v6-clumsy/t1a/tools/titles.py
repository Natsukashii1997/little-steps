# 标题字裁到墨迹边界、统一高度后并排，比较笔画粗细（只读原图）
import sys, os
from PIL import Image, ImageOps
G, OUT = sys.argv[1], sys.argv[2]
names = ['title-zhegeyue', 'title-zhangdale', 'title-xiangce', 'title-jiyibi', 'title-shanggeyue']
H = 160
row = []
for n in names:
    g = Image.open(os.path.join(G, n + '.png')).convert('L')
    ink = g.point(lambda v: 255 if v < 128 else 0)
    box = ink.getbbox()
    crop = g.crop(box)
    s = H / crop.height
    crop = crop.resize((max(1, round(crop.width * s)), H))
    dark = sum(1 for v in crop.getdata() if v < 128) / (crop.width * crop.height)
    print(f'{n:18s} 原墨迹框 {box[2]-box[0]}x{box[3]-box[1]}  统一高度后墨迹占比 {dark:.2%}')
    row.append(crop)
W = sum(c.width for c in row) + 40 * (len(row) + 1)
out = Image.new('L', (W, H + 40), 255)
x = 40
for c in row:
    out.paste(c, (x, 20)); x += c.width + 40
out.save(OUT)
