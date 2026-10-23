# 素材登记表：核对透明派生素材与原图，重算裁切框（与 t1a/tools/alpha.py 同一规则），写 assets.json。
# 用法：python -I assets.py <gpt-assets 目录> <输出 json>
import sys, os, json, hashlib
import numpy as np
from PIL import Image

G, OUT = sys.argv[1], sys.argv[2]
CUT, SOLID = 242, 60
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
CONSUMERS = {
    'ill-home-sleep': ('本月页头图（默认）', ['本月页']),
    'ill-home-leaf': ('本月页头图（新的一个月、还没有记录）', ['本月页·空状态']),
    'ill-home-rattle': ('本月页头图（备用，轮换）', ['本月页']),
    'ill-stage-calendar': ('阶段页头图', ['阶段页']),
    'ill-growth-sprout': ('成长页头图', ['成长页']),
    'ill-album-camera': ('相册页头图；相册空状态', ['相册页', '相册·空状态']),
    'ill-review-notebook': ('月度回顾头图', ['回顾页']),
    'marks-highlight': ('手绘笔触：上排 3 笔淡蓝（选中下划一笔），下排 3 笔浅绿（主动作高光）；实现时按笔切开', ['选中下划线', '主动作高光']),
    'title-zhegeyue': ('手写标题「这个月」', ['阶段页']),
    'title-zhangdale': ('手写标题「长大了」', ['成长页']),
    'title-xiangce': ('手写标题「相册」', ['相册页']),
    'title-jiyibi': ('手写标题「记一笔」', ['记一笔弹层']),
    'title-shanggeyue': ('手写标题「上个月」', ['回顾页']),
}
rows = []
for n, (purpose, consumers) in CONSUMERS.items():
    src = os.path.join(G, n + '.png'); der = os.path.join(G, 'transparent', n + '.png')
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    a = np.clip((CUT - rgb.min(axis=2)) / (CUT - SOLID), 0, 1)
    ys, xs = np.nonzero(a > 0); h, w = a.shape; pad = round(max(w, h) * 0.04)
    box = [int(max(0, xs.min() - pad)), int(max(0, ys.min() - pad)), int(min(w, xs.max() + 1 + pad)), int(min(h, ys.max() + 1 + pad))]
    d = Image.open(der)
    assert d.mode == 'RGBA' and d.size == (box[2] - box[0], box[3] - box[1]), f'{n} 派生尺寸与重算不符'
    rows.append({'id': n, 'purpose': purpose, 'source': f'gpt-assets/{n}.png', 'source_sha256': sha(src),
                 'derivation': 'alpha.py 软阈值去白底（最暗通道 ≥242 透明、≤60 不透明，之间线性），裁到内容边界留 4% 边距',
                 'file': f'gpt-assets/transparent/{n}.png', 'size': list(d.size), 'crop_in_source': box, 'safe_area': '四周 4%（已含在文件里）',
                 'background': 'contextual：只放在纸面（paper #FCFCFC）上；白色部分是透明的，不能放在深色、照片或彩色底上',
                 'sha256': sha(der), 'status': 'candidate（常浩批准权威包后转 production_candidate）', 'consumers': consumers})
rows.append({'id': 'icons-quick', 'purpose': '记一笔五个类型图标（观察、测量、照片、照护、问医生），36pt 显示', 'source': 'gpt-assets/icons-quick.png',
             'source_sha256': sha(os.path.join(G, 'icons-quick.png')), 'derivation': '待第 16 张重画交回后切成 5 个并去白底', 'file': None,
             'size': None, 'crop_in_source': None, 'safe_area': None, 'background': 'contextual（同上）', 'sha256': None,
             'status': 'blocked：软尺是黄色（G3），等重画', 'consumers': ['记一笔弹层·类型选择']})
rows.append({'id': '00-anchor', 'purpose': '宝宝形象定妆参考，只作画风依据，不进界面', 'source': 'gpt-assets/00-anchor.png',
             'source_sha256': sha(os.path.join(G, '00-anchor.png')), 'derivation': None, 'file': None, 'size': None, 'crop_in_source': None,
             'safe_area': None, 'background': None, 'sha256': None, 'status': 'reference_only', 'consumers': []})
json.dump(rows, open(OUT, 'w'), ensure_ascii=False, indent=1)
for r in rows: print(r['id'], r['size'], (r['sha256'] or '-')[:12], r['status'][:20])
