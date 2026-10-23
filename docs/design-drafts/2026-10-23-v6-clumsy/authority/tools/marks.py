# 从已修正的组件板和 GPT 原图里切出界面上反复出现的手绘记号，去白底规则同 t1a/tools/alpha.py。
# 用法：python -I marks.py <gpt-assets 目录> <authority 目录>；结果写到 authority/assets/，并追加到 assets.json。
import sys, os, json, hashlib
import numpy as np
from PIL import Image

G, A = sys.argv[1], sys.argv[2]
CUT, SOLID, PAD = 242, 60, 6
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
BOARD = os.path.join(A, 'derived', 'sheet-components.fixed.png')
MARKS = [  # id, 用途, 源文件, 内容框（墨迹范围，四周再留 PAD）
    ('mark-todo', '状态记号·要安排（空心圈），纯黑', BOARD, (859, 121, 895, 156)),
    ('mark-done', '状态记号·办完了 / 看到了（勾），纯黑', BOARD, (862, 195, 895, 226)),
    ('mark-not-yet', '状态记号·还没看到（虚线圈），纯黑', BOARD, (856, 265, 898, 307)),
    ('mark-none', '状态记号·没记过（短横），纯黑', BOARD, (862, 346, 890, 354)),
    ('mark-doctor', '状态记号·医生提示要留意（叹号），纯黑，不用红色', BOARD, (871, 388, 880, 434)),
    ('mark-error', '出错提示前的圈叹号，纯黑', os.path.join(G, 'screen-15-save-failed.png'), (152, 1359, 198, 1407)),
    ('fab-add', '「记一笔」圆按钮（浅绿底、黑线圈、加号），下方「记一笔」三个字用字体', os.path.join(G, 'screen-1-home.png'), (757, 1204, 880, 1326)),
]
rows = json.load(open(os.path.join(A, 'assets.json')))
rows = [r for r in rows if not r['id'].startswith(('mark-', 'fab-'))]
for mid, purpose, src, (x0, y0, x1, y1) in MARKS:
    box = (x0 - PAD, y0 - PAD, x1 + PAD, y1 + PAD)
    rgb = np.asarray(Image.open(src).convert('RGB').crop(box)).astype(np.float32)
    a = np.clip((CUT - rgb.min(axis=2)) / (CUT - SOLID), 0, 1)
    safe = np.where(a > 0, a, 1)[..., None]
    col = np.clip((rgb - 255 * (1 - a[..., None])) / safe, 0, 255)
    p = os.path.join(A, 'assets', mid + '.png')
    Image.fromarray(np.dstack([col, a * 255]).round().astype(np.uint8), 'RGBA').save(p, optimize=True)
    rel_src = os.path.relpath(src, os.path.dirname(A))
    rows.append({'id': mid, 'purpose': purpose, 'source': rel_src, 'source_sha256': sha(src),
                 'derivation': f'从源图裁 {list(box)}（墨迹四周留 {PAD}px），按 alpha.py 同一规则去白底',
                 'file': f'authority/assets/{mid}.png', 'size': [box[2] - box[0], box[3] - box[1]], 'crop_in_source': list(box),
                 'safe_area': f'四周 {PAD}px（已含在文件里）', 'background': 'contextual：只放在纸面上',
                 'sha256': sha(p), 'status': 'candidate（常浩批准权威包后转 production_candidate）',
                 'consumers': ['状态记号组件'] if mid.startswith('mark-') and mid != 'mark-error' else (['出错提示'] if mid == 'mark-error' else ['本月页·记一笔按钮'])})
    print(mid, box[2] - box[0], 'x', box[3] - box[1], sha(p)[:12])
json.dump(rows, open(os.path.join(A, 'assets.json'), 'w'), ensure_ascii=False, indent=1)
