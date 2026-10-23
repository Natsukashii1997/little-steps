# 组件板·补充：从 GPT 原图按组件裁切，拼成一张板。不手画、不重新生成；灰色小字只是说明，不属于视觉。
# 用法：python -I compose.py <gpt-assets 目录> <输出目录>
import sys, os, json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont

G, OUT = sys.argv[1], sys.argv[2]
FONT = '/System/Library/Fonts/Hiragino Sans GB.ttc'
PAPER = (252, 252, 252)
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def tape_to_blue(img, box):
    # G3：软尺图标是黄色。只在软尺范围内把黄色系像素的色相换成淡蓝，明度不变，饱和度按淡蓝 token 缩放。
    hsv = np.asarray(img.convert('HSV')).astype(np.float64).copy()
    x0, y0, x1, y1 = box
    r = hsv[y0:y1, x0:x1]
    m = (r[..., 0] > 15) & (r[..., 0] < 50) & (r[..., 1] > 40)
    s0 = np.median(r[..., 1][m])
    r[..., 0][m] = 145                       # 第 16 张眼睛虹膜的色相中位值，与 icons.py 一致
    r[..., 1][m] = r[..., 1][m] * 54 / s0    # 同上，饱和度中位值 54/255
    out = Image.fromarray(hsv.round().astype(np.uint8), 'HSV').convert('RGB')
    return out, int(m.sum())

def to_ink2(a, box):
    # 占位字改用 ink-2（T1b 预审 P1）：按每个像素相对纸色的墨量，把浅灰字换成同样墨量的 #707070。
    x0, y0, x1, y1 = box
    r = a[y0:y1, x0:x1]; lum = r.mean(2)
    paper = np.median(r[lum > 235], 0); pl = paper.mean()
    core = np.percentile(lum[lum < 200], 5)
    t = np.clip((pl - lum) / (pl - core), 0, 1)[..., None]
    r[:] = paper * (1 - t) + np.array([112.0, 112.0, 112.0]) * t
    return int((t[..., 0] > 0.05).sum())

# (编号, 组件与状态, 源文件, 裁切框, 额外处理)
ITEMS = [
    ('1', '弹层头部：拖动条、手写标题、取消、说明；背后是遮罩（黑 50%）', 'screen-5-quick.png', (96, 370, 928, 700), None),
    ('2', '类型选择：选中的类型字下一笔淡蓝（软尺已按 G3 换成淡蓝）', 'screen-5-quick.png', (130, 725, 900, 890), ('tape', (318, 745, 404, 806))),
    ('3', '二选一：选中项字下一笔淡蓝，未选项是次要灰', 'screen-5-quick.png', (130, 925, 900, 1010), None),
    ('4', '键盘弹出：输入线、光标；「记下」在键盘正上方', 'screen-8-quick-typing.png', (96, 820, 928, 1110), None),
    ('5', '测量：日期可改、地点二选一、三项数字输入（没量可以不填）', 'screen-9-quick-measure.png', (130, 830, 900, 1300), ('placeholder', (458, 1236, 630, 1271))),
    ('6', '要安排的事·操作：约在哪天、改、这次跳过、已经办完了；主动作「约好了」', 'screen-11-arrange.png', (130, 970, 900, 1470), None),
    ('7', '办完写结果：哪天办的、医生原话（输入线）、有没有提示要留意、当天量的', 'screen-12-done.png', (130, 605, 900, 1225), None),
    ('8', '照片大图：日期与备注、设为精选（主动作）、下载原片、更多、原片信息', 'screen-13-photo.png', (130, 1140, 900, 1475), None),
    ('9', '批量导入：进度条、已存好计数、正在存、没存上（可全部再试）', 'screen-14-import.png', (130, 880, 900, 1460), None),
    ('10', '出错：黑色圈叹号＋说明，不用红色；次要「先放着」、主动作「再试一次」', 'screen-15-save-failed.png', (130, 1355, 910, 1495), None),
    ('11', '测量数字：大号数字＋小号单位，下面一行小字', 'screen-3-growth.png', (130, 345, 900, 480), None),
    ('12', '家里在留意：条目前淡蓝小点（表示正在留意，属于进行中状态）', 'screen-3-growth.png', (140, 1235, 800, 1375), None),
    ('13', '「已约」前淡蓝小点；主动作「定个日期 →」下一笔浅绿', 'screen-2-stage.png', (640, 440, 905, 625), None),
    ('14', '「记一笔」圆按钮：浅绿底、黑线圈、手写字', 'screen-1-home.png', (740, 1190, 900, 1390), None),
    ('15', '二级页返回：左上小字「< 上一页名称」', 'screen-6-review-top.png', (130, 62, 420, 122), None),
]
f_label = ImageFont.truetype(FONT, 26, index=0)
f_src = ImageFont.truetype(FONT, 18, index=0)
f_head = ImageFont.truetype(FONT, 40, index=0)

def wrap(text, font, width):
    lines, cur = [], ''
    for ch in text:
        if font.getlength(cur + ch) > width: lines.append(cur); cur = ch
        else: cur += ch
    return lines + [cur]

COLW, GUT, M = 840, 60, 60
cols = [[], []]; heights = [0, 0]
log, cache = [], {}
for no, label, fn, box, extra in ITEMS:
    if fn not in cache: cache[fn] = Image.open(os.path.join(G, fn)).convert('RGB')
    img = cache[fn]
    note = ''
    if extra and extra[0] == 'tape':
        img, n = tape_to_blue(img, extra[1]); note = f'；软尺范围 {extra[1]} 内 {n} 个黄色像素换成淡蓝色相'
    if extra and extra[0] == 'placeholder':
        arr = np.asarray(img).astype(np.float64).copy(); n = to_ink2(arr, extra[1])
        img = Image.fromarray(arr.round().astype(np.uint8)); note = f'；占位字 {extra[1]} 按墨量换成 ink-2（{n} 像素）'
    crop = img.crop(box)
    lines = wrap(f'{no}  {label}', f_label, COLW)
    h = 34 * len(lines) + 26 + 10 + crop.height + 56
    c = 0 if heights[0] <= heights[1] else 1
    cols[c].append((lines, fn, box, crop)); heights[c] += h
    log.append({'no': no, 'component': label, 'source': fn, 'source_sha256': sha(os.path.join(G, fn)), 'crop': box, 'op': '裁切' + note})

W = M * 2 + COLW * 2 + GUT
H = 200 + max(heights) + M
board = Image.new('RGB', (W, H), PAPER)
d = ImageDraw.Draw(board)
d.text((M, 60), '组件板 · 补充', font=f_head, fill=(17, 17, 17))
d.text((M, 120), '全部由 GPT 原图按组件机械裁切，没有新生成。灰色小字是说明，不属于视觉。尺寸与颜色以 tokens.json 和组件规范为准。', font=f_src, fill=(112, 112, 112))
for c in range(2):
    x, y = M + c * (COLW + GUT), 200
    for lines, fn, box, crop in cols[c]:
        for i, ln in enumerate(lines):
            d.text((x, y + 34 * i), ln, font=f_label, fill=(17, 17, 17))
        y += 34 * len(lines)
        d.text((x, y), f'{fn}  {box}', font=f_src, fill=(138, 138, 138))
        board.paste(crop, (x, y + 26 + 10))
        y += 26 + 10 + crop.height + 56
p = os.path.join(OUT, 'sheet-components-supplement.png')
board.save(p, optimize=True)
json.dump({'items': log, 'output': {'file': os.path.basename(p), 'size': board.size, 'sha256': sha(p)}}, open(os.path.join(OUT, 'compose-log.json'), 'w'), ensure_ascii=False, indent=1)
print(board.size, sha(p))
