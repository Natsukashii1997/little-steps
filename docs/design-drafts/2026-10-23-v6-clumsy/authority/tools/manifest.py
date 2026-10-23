# 生成视觉权威包清单：逐个成员算 sha256，清单哈希 = 成员表规范化 JSON（键排序、无空白）的 sha256。
# 用法：python -I manifest.py <authority 目录> [状态]；写 manifest.json 和 视觉权威包清单.md。
import sys, os, json, glob, hashlib

A = os.path.abspath(sys.argv[1]); ROOT = os.path.dirname(A)   # ROOT = 2026-10-23-v6-clumsy
VERSION = 'v6-authority-v1'
STATUS = sys.argv[2] if len(sys.argv) > 2 else 'draft'   # draft / t1b_ready / approved；不写进成员表，不影响清单哈希
PENDING = []
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
def rel(p): return os.path.relpath(p, ROOT)
members = []
def add(role, path, note=''):
    members.append({'role': role, 'path': rel(path), 'sha256': sha(path), **({'note': note} if note else {})})

add('canonical_screen', f'{A}/derived/screen-1-home.fixed.png', '本月首页；原图按 G2、G5 机械修正')
add('component_board', f'{A}/derived/sheet-components.fixed.png', '原组件板按 G4 机械修正，视频时长标签改成深色')
add('component_board', f'{A}/derived/sheet-components-supplement.png', '从 GPT 屏按组件裁切的补充板')
add('tokens', f'{A}/tokens.json')
add('spec', f'{A}/组件规范.md')
add('asset_registry', f'{A}/assets.json')
for r in json.load(open(f'{A}/assets.json')):
    if r['file']: add('asset', os.path.join(ROOT, r['file']), r['id'])
for p in sorted(glob.glob(f'{ROOT}/gpt-assets/*.png')):
    n = os.path.basename(p)
    if n.startswith('screen-') and n != 'screen-1-home.png' or n in ('00-anchor.png', 'icons-quick.png'):
        add('reference', p, '参考屏；与规范冲突处以规范为准' if n.startswith('screen-') else ('定妆参考' if n.startswith('00') else '原图，软尺是黄色；派生见 derived/icons-quick.recolor.png'))
add('derived_source', f'{A}/derived/icons-quick.recolor.png', '第 16 张软尺按 G3 机械换成淡蓝，5 个图标从这里切出')
for p in [f'{ROOT}/gpt-assets/screen-1-home.png', f'{ROOT}/gpt-assets/sheet-components.png']:
    add('source_original', p, '修正前的 GPT 原图')
for p in [f'{ROOT}/gpt-assets/生成记录.md', f'{A}/derived/fix-log.json', f'{A}/derived/compose-log.json'] + sorted(glob.glob(f'{A}/tools/*.py')) + sorted(glob.glob(f'{A}/evidence/*.png')):
    add('provenance', p)

canon = json.dumps(members, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
mhash = hashlib.sha256(canon).hexdigest()
out = {'version': VERSION, 'status': STATUS, 'manifest_sha256': mhash,
       'hash_rule': 'sha256(json.dumps(members, ensure_ascii=False, sort_keys=True, separators=(",", ":")))',
       'pending': PENDING, 'approval': None, 'members': members}
json.dump(out, open(f'{A}/manifest.json', 'w'), ensure_ascii=False, indent=1)

core = [m for m in members if m['role'] in ('canonical_screen', 'component_board', 'tokens', 'spec', 'asset_registry')]
lines = [f'# 视觉权威包清单 {VERSION}', '', f'状态：**{STATUS}**。清单哈希：`{mhash}`', '',
         '本页由 `tools/manifest.py` 生成，不要手改。成员有任何变动，清单哈希都会变，此前的 T1b 记录和批准随之失效。', '',
         '## 核心成员', '', '| 角色 | 文件 | sha256 |', '|---|---|---|']
lines += [f"| {m['role']} | `{m['path']}` | `{m['sha256']}` |" for m in core]
counts = {}
for m in members: counts[m['role']] = counts.get(m['role'], 0) + 1
lines += ['', '## 其他成员', '', '| 角色 | 数量 |', '|---|---|'] + [f'| {k} | {v} |' for k, v in counts.items() if k not in ('canonical_screen', 'component_board', 'tokens', 'spec', 'asset_registry')]
lines += ['', '完整列表和每个文件的哈希见 `manifest.json`。', '', '## 未完成', ''] + [f'- {p}' for p in PENDING]
open(f'{A}/视觉权威包清单.md', 'w').write('\n'.join(lines) + '\n')
print(VERSION, STATUS, mhash, len(members), 'members')
