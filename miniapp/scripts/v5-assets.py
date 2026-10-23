#!/usr/bin/env python3
"""从已批准的视觉权威包派生小程序用的素材（只缩放、裁切，不新生成）。

用法：python3 -I scripts/v5-assets.py <design-drafts/2026-10-23-v6-clumsy 目录> <miniprogram/assets/v5 输出目录>

- 插画按 3 倍屏的显示宽度缩放（显示尺寸见 docs/design-drafts/.../authority/组件规范.md 第 4、5.13 节）。
- 手写标题按墨迹高 56pt × 3 = 168px 缩放。
- 圆按钮 fab-add 原样复制（135px，显示 56pt，T1b P5 已接受）。
- marks-highlight 按笔切成 3 笔淡蓝、3 笔浅绿，按宽度排序命名 s / m / l。
- 每个输出记录来源文件的 sha256 和输出的 sha256，写到 derived.json。
"""
import hashlib
import json
import os
import sys

from PIL import Image


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


# (来源, 输出名, 缩放方式, 值)。宽度 = 显示宽度(pt) × 3；高度同理。
JOBS = [
    ("gpt-assets/transparent/ill-home-sleep.png", "ill-home-sleep.png", "width", 660),
    ("gpt-assets/transparent/ill-home-leaf.png", "ill-home-leaf.png", "width", 660),
    ("gpt-assets/transparent/ill-home-rattle.png", "ill-home-rattle.png", "width", 540),
    ("gpt-assets/transparent/ill-stage-calendar.png", "ill-stage-calendar.png", "width", 380),
    ("gpt-assets/transparent/ill-growth-sprout.png", "ill-growth-sprout.png", "width", 255),
    ("gpt-assets/transparent/ill-album-camera.png", "ill-album-camera.png", "width", 325),
    ("gpt-assets/transparent/title-zhegeyue.png", "title-zhegeyue.png", "height", 168),
    ("gpt-assets/transparent/title-zhangdale.png", "title-zhangdale.png", "height", 168),
    ("gpt-assets/transparent/title-xiangce.png", "title-xiangce.png", "height", 168),
    ("gpt-assets/transparent/title-jiyibi.png", "title-jiyibi.png", "height", 168),
    ("gpt-assets/transparent/title-shanggeyue.png", "title-shanggeyue.png", "height", 168),
    ("authority/assets/fab-add.png", "fab-add.png", "copy", None),
    ("authority/assets/mark-todo.png", "mark-todo.png", "copy", None),
    ("authority/assets/mark-done.png", "mark-done.png", "copy", None),
    ("authority/assets/mark-not-yet.png", "mark-not-yet.png", "copy", None),
    ("authority/assets/mark-none.png", "mark-none.png", "copy", None),
    ("authority/assets/mark-doctor.png", "mark-doctor.png", "copy", None),
    ("authority/assets/mark-error.png", "mark-error.png", "copy", None),
]


def runs(mask, min_gap):
    """把一维布尔数组切成连续段，间隔小于 min_gap 的段合并。返回 [(start, end)]。"""
    out = []
    start = None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            out.append([start, i])
            start = None
    if start is not None:
        out.append([start, len(mask)])
    merged = []
    for seg in out:
        if merged and seg[0] - merged[-1][1] < min_gap:
            merged[-1][1] = seg[1]
        else:
            merged.append(seg)
    return [tuple(s) for s in merged]


def alpha_mask(im):
    """返回 (宽, 高, 像素是否有墨) 的纯 Python 结构，不依赖 numpy。"""
    alpha = im.split()[3].point(lambda a: 255 if a > 20 else 0)
    w, h = alpha.size
    data = alpha.load()
    return w, h, data


def split_strokes(src, out_dir, log):
    im = Image.open(src).convert("RGBA")
    w, h, px = alpha_mask(im)
    row_any = [any(px[x, y] for x in range(w)) for y in range(h)]
    rows = runs(row_any, 12)
    if len(rows) != 2:
        print("marks-highlight: 期望 2 行笔触，实际", len(rows), rows)
    names = ["blue", "green"]
    for row_index, (y0, y1) in enumerate(rows[:2]):
        col_any = [any(px[x, y] for y in range(y0, y1)) for x in range(w)]
        cols = runs(col_any, 24)
        if len(cols) != 3:
            print("marks-highlight 第", row_index + 1, "行：期望 3 笔，实际", len(cols), cols)
        crops = []
        for (x0, x1) in cols:
            ys = [y for y in range(y0, y1) if any(px[x, y] for x in range(x0, x1))]
            top, bottom = ys[0], ys[-1] + 1
            crops.append((x1 - x0, x0, x1, top, bottom))
        crops.sort()
        for size, (stroke_w, x0, x1, top, bottom) in zip(["s", "m", "l"], crops):
            pad_x, pad_y = max(2, stroke_w // 50), max(2, (bottom - top) // 10)
            box = (max(0, x0 - pad_x), max(0, top - pad_y), min(im.width, x1 + pad_x), min(im.height, bottom + pad_y))
            crop = im.crop(box)
            target_h = 48  # 16pt × 3
            ratio = target_h / crop.height
            crop = crop.resize((max(1, round(crop.width * ratio)), target_h), Image.LANCZOS)
            name = "stroke-%s-%s.png" % (names[row_index], size)
            path = os.path.join(out_dir, name)
            crop.save(path, optimize=True)
            log.append({"source": os.path.relpath(src, ROOT), "source_sha256": sha256(src), "box": box,
                        "output": name, "size": crop.size, "output_sha256": sha256(path)})
            print(name, crop.size, "from", box)


def main():
    global ROOT
    ROOT, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    log = []
    for rel, name, mode, value in JOBS:
        src = os.path.join(ROOT, rel)
        im = Image.open(src).convert("RGBA")
        if mode == "width":
            ratio = value / im.width
            im = im.resize((value, max(1, round(im.height * ratio))), Image.LANCZOS)
        elif mode == "height":
            ratio = value / im.height
            im = im.resize((max(1, round(im.width * ratio)), value), Image.LANCZOS)
        path = os.path.join(out_dir, name)
        if name.startswith("ill-"):
            # 水彩插画压成 256 色调色板 PNG（带透明），体积约为原来的 1/4；线条素材保持真彩。
            im = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
        im.save(path, optimize=True)
        log.append({"source": rel, "source_sha256": sha256(src), "mode": mode, "value": value,
                    "output": name, "size": im.size, "output_sha256": sha256(path)})
        print(name, im.size, os.path.getsize(path) // 1024, "KB")
    split_strokes(os.path.join(ROOT, "gpt-assets/transparent/marks-highlight.png"), out_dir, log)
    with open(os.path.join(out_dir, "derived.json"), "w", encoding="utf-8") as f:
        json.dump({"note": "由 scripts/v5-assets.py 从权威包派生；来源哈希见 authority/manifest.json", "items": log},
                  f, ensure_ascii=False, indent=2)
    total = sum(os.path.getsize(os.path.join(out_dir, p)) for p in os.listdir(out_dir))
    print("合计", total // 1024, "KB")


if __name__ == "__main__":
    main()
