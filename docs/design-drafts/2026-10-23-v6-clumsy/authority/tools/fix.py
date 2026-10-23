# 用 GPT 原图里已有的像素，机械修正标准屏和组件板上与规范冲突的地方（不手画、不重新生成）。
# 用法：python -I fix.py <gpt-assets 目录> <输出目录>；只读原图，派生图和操作记录写到输出目录。
import sys, os, json, hashlib
import numpy as np
from PIL import Image

G, OUT = sys.argv[1], sys.argv[2]
def load(n): return np.asarray(Image.open(os.path.join(G, n)).convert('RGB')).astype(np.float64)
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
def clean(a, box):  # 断言补丁是空白纸面
    x0, y0, x1, y1 = box
    assert a[y0:y1, x0:x1].mean(2).min() > 238, f'补丁不是空白纸面: {box}'
def paste(dst, src, sbox, dx, dy):
    x0, y0, x1, y1 = sbox
    dst[y0+dy:y1+dy, x0+dx:x1+dx] = src[y0:y1, x0:x1]
def multiply(dst, src, sbox, dbox_xy, size=None):
    # 把纸面上的淡彩笔触按「正片叠底」放到另一张纸面上：结果 = 底 × (笔触 / 笔触所在纸色)
    x0, y0, x1, y1 = sbox
    p = src[y0:y1, x0:x1]
    border = np.concatenate([p[0], p[-1], p[:, 0], p[:, -1]])
    ratio = np.clip(p / np.median(border, 0), 0, 1)
    if size:
        ratio = np.asarray(Image.fromarray((ratio * 255).round().astype(np.uint8)).resize(size, Image.LANCZOS)).astype(np.float64) / 255
    dx, dy = dbox_xy
    h, w = ratio.shape[:2]
    dst[dy:dy+h, dx:dx+w] *= ratio
    return (dx, dy, dx + w, dy + h)
def save(a, name):
    p = os.path.join(OUT, name)
    Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8)).save(p, optimize=True)
    return p

def to_ink2(a, box):
    # 占位字改用 ink-2（T1b 预审 P1）：按每个像素相对纸色的墨量，把浅灰字换成同样墨量的 #707070。
    x0, y0, x1, y1 = box
    r = a[y0:y1, x0:x1]; lum = r.mean(2)
    paper = np.median(r[lum > 235], 0); pl = paper.mean()
    core = np.percentile(lum[lum < 200], 5)
    t = np.clip((pl - lum) / (pl - core), 0, 1)[..., None]
    r[:] = paper * (1 - t) + np.array([112.0, 112.0, 112.0]) * t
    return int((t[..., 0] > 0.05).sum())

log = []
s1, s2, s5, b = load('screen-1-home.png'), load('screen-2-stage.png'), load('screen-5-quick.png'), load('sheet-components.png')

# —— 标准屏 screen-1-home ——
# G2：「3 月龄儿保」前的空心圈被涂了淡蓝。用同一张图「本月疫苗」前的空心圈（含四周纸面）整块覆盖，中心对齐。
paste(s1, s1.copy(), (147, 881, 193, 927), 0, -82)
log.append({'file': 'screen-1-home', 'finding': 'G2', 'op': '用同图 (147,881)-(193,927) 的空心圈覆盖到 y-82 处，去掉淡蓝填色'})
# G2：「已约」前加淡蓝小点。取 screen-2 里「已约」前的点，正片叠底，和「已」字的间距、上下位置照 screen-2。
r = multiply(s1, s2, (676, 454, 701, 479), (648, 810))
log.append({'file': 'screen-1-home', 'finding': 'G2', 'op': f'取 screen-2 (676,454)-(701,479) 的淡蓝点，正片叠底到 {r}'})
# G5：「2 件」前多出的一道短横。用正下方 40px 处的空白纸面覆盖。
clean(s1, (496, 768, 529, 781))
paste(s1, s1.copy(), (496, 768, 529, 781), 0, -40)
log.append({'file': 'screen-1-home', 'finding': 'G5', 'op': '用同图 (496,768)-(529,781) 的空白纸面覆盖 y-40 处的短横'})

# —— 组件板 sheet-components ——
# G4：「看到了」的选中样式改成字下面一笔淡蓝。先用左侧 40px 处的空白纸面盖掉竖条，
# 再取 screen-5「看到了」下面那一笔，按字宽横向缩放，正片叠底到字下方（与字的间距照 screen-5：10px）。
clean(b, (1162, 301, 1187, 356))
paste(b, b.copy(), (1162, 301, 1187, 356), 40, 0)
w = round((539 - 415) * (1356 - 1246) / (516 - 429))
r = multiply(b, s5, (415, 980, 539, 1002), (1246 - round(14 * (1356 - 1246) / (516 - 429)) - 3, 347 + 10 - 3), size=(w, 22))
log.append({'file': 'sheet-components', 'finding': 'G4', 'op': f'用同图 (1162,301)-(1187,356) 空白纸面盖掉竖条；取 screen-5 (415,980)-(539,1002) 的淡蓝下划一笔，横向缩放到 {w}px，正片叠底到 {r}'})

# 视频时长标签：白底黑字 → 半透明黑底、白字（常浩 10-23 决定）。标签下面的照片被盖住了取不回，
# 所以底色按「黑 60% 叠在标签周围照片的平均色上」算；字的笔画按原来的墨量换成白色；外缘 1px 半混合。
def dilate(m, k):
    out = m.copy()
    for _ in range(k):
        n = out.copy(); n[1:] |= out[:-1]; n[:-1] |= out[1:]; n[:, 1:] |= out[:, :-1]; n[:, :-1] |= out[:, 1:]; out = n
    return out
X0, Y0, X1, Y1 = 66, 882, 196, 932
r = b[Y0:Y1, X0:X1]
white = r.min(2) > 238
shape = np.zeros_like(white)
for yy in range(white.shape[0]):
    xs = np.nonzero(white[yy])[0]
    if len(xs) > 30: shape[yy, xs.min():xs.max() + 1] = True
ring = dilate(shape, 6) & ~dilate(shape, 2)
photo = r[ring].mean(0)
bg = photo * 0.40 + 17 * 0.60
t = np.clip((235 - r.mean(2)) / (235 - 40), 0, 1)[..., None]
new = bg * (1 - t) + 255 * t
edge = dilate(shape, 1) & ~shape
r[shape] = new[shape]
r[edge] = (r[edge] + bg) / 2
log.append({'file': 'sheet-components', 'finding': '视频时长标签（常浩 10-23 决定用深色）',
            'op': f'在 ({X0},{Y0})-({X1},{Y1}) 内按白底范围逐行取标签形状（{int(shape.sum())} 像素），底色 = 周围照片平均色 × 0.40 + #111111 × 0.60 = #%02X%02X%02X，笔画按墨量换成白色，外缘 1px 半混合' % tuple(int(round(v)) for v in bg)})

n = to_ink2(b, (720, 552, 1096, 595))
log.append({'file': 'sheet-components', 'finding': 'T1b 预审 P1', 'op': f'输入框占位字 (720,552)-(1096,595) 按墨量换成 ink-2 #707070，涉及 {n} 像素'})

src = {n: sha(os.path.join(G, n)) for n in ['screen-1-home.png', 'screen-2-stage.png', 'screen-5-quick.png', 'sheet-components.png']}
out = {}
for a, n in [(s1, 'screen-1-home.fixed.png'), (b, 'sheet-components.fixed.png')]:
    out[n] = sha(save(a, n))
json.dump({'sources_sha256': src, 'operations': log, 'outputs_sha256': out}, open(os.path.join(OUT, 'fix-log.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, indent=1))
