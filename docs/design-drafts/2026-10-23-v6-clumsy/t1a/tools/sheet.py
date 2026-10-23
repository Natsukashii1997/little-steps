# 素材缩略总览 + 背景白度检查（只读原图）
import sys, os
from PIL import Image, ImageDraw
G, OUT = sys.argv[1], sys.argv[2]
names = ['ill-home-sleep','ill-home-leaf','ill-home-rattle','ill-stage-calendar','ill-growth-sprout','ill-album-camera','ill-review-notebook','icons-quick','marks-highlight','title-zhegeyue','title-zhangdale','title-xiangce','title-jiyibi','title-shanggeyue']
cell, cols = 360, 4
rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell, rows * (cell + 28)), (200, 200, 200))
d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    im = Image.open(os.path.join(G, n + '.png')).convert('RGB')
    w, h = im.size
    # 四角与边缘的平均色、最暗边缘像素，用来判断是不是纯白底
    border = [im.getpixel((x, y)) for x in range(0, w, max(1, w // 40)) for y in (2, h - 3)] + [im.getpixel((x, y)) for y in range(0, h, max(1, h // 40)) for x in (2, w - 3)]
    avg = tuple(sum(c[k] for c in border) // len(border) for k in range(3))
    mn = min(sum(c) for c in border) // 3
    print(f'{n:22s} {w}x{h} 边缘平均 {avg} 边缘最暗 {mn}')
    im.thumbnail((cell - 8, cell - 8))
    x, y = (i % cols) * cell, (i // cols) * (cell + 28)
    sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
    d.text((x + 6, y + cell + 6), f'{9 + i}. {n}', fill=(0, 0, 0))
sheet.save(OUT)
