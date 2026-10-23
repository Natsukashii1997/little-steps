# 第 16 张图标：用原图像素把软尺从黄色换成淡蓝（色相、饱和度取同图眼睛虹膜的中位值，明度不变），
# 再按 alpha.py 同一规则去白底，切成 5 个图标，并更新 assets.json 里的 icons-quick 一行。
# 用法：python -I icons.py <gpt-assets 目录> <authority 目录>
import sys, os, json, hashlib
import numpy as np
from PIL import Image

G, A = sys.argv[1], sys.argv[2]
CUT, SOLID, PAD = 242, 60, 12
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
SRC = os.path.join(G, 'icons-quick.png')
ICONS = [('icon-observe', '观察', (138, 336, 361, 466)), ('icon-measure', '测量', (509, 332, 738, 478)),
         ('icon-photo', '照片', (867, 316, 1078, 487)), ('icon-care', '照护', (1274, 275, 1400, 520)),
         ('icon-doctor', '问医生', (1592, 309, 1804, 510))]
img = Image.open(SRC).convert('RGB')
hsv = np.asarray(img.convert('HSV')).astype(np.float64).copy()
eye = hsv[:, 138:361]; mb = (eye[..., 1] > 30) & (eye[..., 0] > 120) & (eye[..., 0] < 170)
H, S = np.median(eye[..., 0][mb]), np.median(eye[..., 1][mb])
x0, y0, x1, y1 = ICONS[1][2]
r = hsv[y0:y1, x0:x1]
m = (r[..., 0] > 15) & (r[..., 0] < 50) & (r[..., 1] > 30)
S0 = np.median(r[..., 1][m])
r[..., 1][m] = r[..., 1][m] * S / S0
r[..., 0][m] = H
rec = Image.fromarray(hsv.round().astype(np.uint8), 'HSV').convert('RGB')
rp = os.path.join(A, 'derived', 'icons-quick.recolor.png'); rec.save(rp, optimize=True)
print(f'软尺 {int(m.sum())} 像素：色相→{H:.0f}，饱和度按 {S:.0f}/{S0:.0f} 缩放')

rows = [x for x in json.load(open(os.path.join(A, 'assets.json'))) if x['id'] != 'icons-quick' and not x['id'].startswith('icon-')]
rgbf = np.asarray(rec).astype(np.float32)
for iid, name, (a0, b0, a1, b1) in ICONS:
    box = (a0 - PAD, b0 - PAD, a1 + PAD, b1 + PAD)
    c = rgbf[box[1]:box[3], box[0]:box[2]]
    al = np.clip((CUT - c.min(axis=2)) / (CUT - SOLID), 0, 1)
    safe = np.where(al > 0, al, 1)[..., None]
    col = np.clip((c - 255 * (1 - al[..., None])) / safe, 0, 255)
    p = os.path.join(A, 'assets', iid + '.png')
    Image.fromarray(np.dstack([col, al * 255]).round().astype(np.uint8), 'RGBA').save(p, optimize=True)
    rows.append({'id': iid, 'purpose': f'记一笔类型图标·{name}，显示 36pt', 'source': 'gpt-assets/icons-quick.png', 'source_sha256': sha(SRC),
                 'derivation': ('软尺黄色换成淡蓝（G3），' if iid == 'icon-measure' else '') + f'从 icons-quick 裁 {list(box)}（四周留 {PAD}px），按 alpha.py 同一规则去白底',
                 'file': f'authority/assets/{iid}.png', 'size': [box[2] - box[0], box[3] - box[1]], 'crop_in_source': list(box),
                 'safe_area': f'四周 {PAD}px（已含在文件里）', 'background': 'contextual：只放在纸面上', 'sha256': sha(p),
                 'status': 'candidate（常浩批准权威包后转 production_candidate）', 'consumers': ['记一笔弹层·类型选择']})
    print(iid, box[2] - box[0], 'x', box[3] - box[1], sha(p)[:12])
json.dump(rows, open(os.path.join(A, 'assets.json'), 'w'), ensure_ascii=False, indent=1)
