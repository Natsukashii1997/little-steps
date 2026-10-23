#!/usr/bin/env python3
"""把霞鹜文楷做成小程序能加载的子集（GB2312 常用字 + 界面符号），输出 WOFF。

用法：
  python3 -I scripts/v5-font-subset.py <fonttools 虚拟环境的 pyftsubset 路径> <输入 ttf> <输出 woff> [字重名]

- 子集范围：ASCII、GB2312 的 6763 个汉字、中文标点（U+3000–303F）、全角字符（U+FF00–FF5E）、
  界面用到的符号：– — ‹ › → ← · … ℃ × 「」『』。
- 用户输入超出 GB2312 的字（生僻字）会回退到系统字体，这是已知取舍。
- 输出 WOFF（官方建议 TTF/WOFF；WOFF2 低版本 iOS 不兼容）。
- 字体文件不进小程序包；放云存储再用 wx.loadFontFace 加载（上传云端要常浩另行同意）。
"""
import hashlib
import os
import subprocess
import sys
import tempfile


def gb2312_hanzi():
    out = []
    for code in range(0x4E00, 0xA000):
        try:
            chr(code).encode("gb2312")
        except UnicodeEncodeError:
            continue
        out.append(code)
    return out


def unicode_list():
    codes = set(range(0x20, 0x7F))
    codes.update(gb2312_hanzi())
    codes.update(range(0x3000, 0x3040))
    codes.update(range(0xFF00, 0xFF5F))
    for ch in "–—‹›→←·…℃×「」『』‘’“”":
        codes.add(ord(ch))
    return sorted(codes)


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    pyftsubset, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    codes = unicode_list()
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("\n".join("U+%04X" % c for c in codes))
        list_path = f.name
    subprocess.run([
        pyftsubset, src,
        "--unicodes-file=" + list_path,
        "--flavor=woff",
        "--layout-features=kern,liga",
        "--no-hinting",
        "--desubroutinize",
        "--output-file=" + dst,
    ], check=True)
    os.unlink(list_path)
    print("字数", len(codes), "输入", os.path.getsize(src) // 1024, "KB", "输出", os.path.getsize(dst) // 1024, "KB")
    print("输入 sha256", sha256(src))
    print("输出 sha256", sha256(dst))


if __name__ == "__main__":
    main()
