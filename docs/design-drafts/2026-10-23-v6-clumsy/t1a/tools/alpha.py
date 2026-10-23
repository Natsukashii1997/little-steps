# 白底转透明（软阈值）：最暗通道 >= CUT 视为纸面全透明，<= SOLID 全不透明，中间线性过渡；
# 颜色按白底反推，叠回白底与原图一致。裁到内容边界留 4% 边距。只读原图，派生文件写到 transparent/。
import sys, os
import numpy as np
from PIL import Image
CUT, SOLID = 242, 60
G = sys.argv[1]
for n in sys.argv[2:]:
    rgb = np.asarray(Image.open(os.path.join(G, n + '.png')).convert('RGB')).astype(np.float32)
    m = rgb.min(axis=2)
    a = np.clip((CUT - m) / (CUT - SOLID), 0, 1)
    safe = np.where(a > 0, a, 1)[..., None]
    col = np.clip((rgb - 255 * (1 - a[..., None])) / safe, 0, 255)
    out = np.dstack([col, a * 255]).round().astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    ys, xs = np.nonzero(a > 0)
    h, w = a.shape
    pad = round(max(w, h) * 0.04)
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + 1 + pad), min(h, ys.max() + 1 + pad))
    img.crop(box).save(os.path.join(G, 'transparent', n + '.png'), optimize=True)
    print(f'{n:22s} {box[2]-box[0]}x{box[3]-box[1]}')
