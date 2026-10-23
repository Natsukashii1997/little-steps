# 字体候选样张（2026-10-24 00:40–00:47）

起因：常浩看第 2 批截图后提出「字体并不是拙趣风，不能按照 GPT 生成的图的字体么」。GPT 图上的字是画出来的像素，不是字体；权威包 `tokens.json` 与组件规范把霞鹜文楷定为全站唯一字体（10-23 常浩决定），T1b 预审 P6 留了「到 T2 用实际渲染对比再决定」。常浩 00:3x 同意「从官方仓库下载这 4 款候选字体，做同屏样张给我挑」。

## 下载（只从官方仓库；原文件在会话临时目录，不入库）

| 字体 | 来源 | 版本 | 原文件 sha256 |
|---|---|---|---|
| 小赖字体 Xiaolai-Regular.ttf | GitHub `lxgw/kose-font` releases | v3.126（2025-09-10） | `e2f68daf0e72777a8cf58bc83de1b98634b251e537ddbfca24b0ae50d1802da2` |
| 悠哉字体 Yozai-Regular.ttf | GitHub `lxgw/yozai-font` releases | v0.868（2025-09-12） | `25071998a0fe6a72f54c235e714986d259633e5ff670b1a2b5e264387f3316ac` |
| 悠哉字体 Yozai-Medium.ttf | 同上 | 同上 | `05f50f252b45197d0d6148a4abc3e37c7cd4cfdf03c955b57c25d53d924f835f` |
| 站酷快乐体 ZCOOLKuaiLe-Regular.ttf | GitHub `google/fonts` `ofl/zcoolkuaile` | 2.001 | `812a6fc1fe54b6d73a419245c32dfeba8aa33104d5be90d1cf6af082007cb71d` |

呆萌手写体：只找到第三方字体站转载和网盘链接，没有作者（K99Xmas）的官方仓库，不在授权范围内，**没下载**。

## 许可与覆盖（fontTools 读字体 name 表 + GitHub 仓库许可字段）

| 字体 | 许可（字体内 nameID 13/14） | 仓库许可字段 | GB2312 6763 字 | 界面符号缺字 |
|---|---|---|---|---|
| 小赖 | SIL OFL 1.1 | OFL-1.1 | 全有 | 只缺生僻标点（〪〭〮〫〬＀） |
| 悠哉 | SIL OFL 1.1 | OFL-1.1 | 全有 | 同上，另缺 〿〯 |
| 站酷快乐体 | SIL OFL 1.1 | OFL.txt 随仓库 | 全有 | **缺 ‹ › ← → ℃** 等 52 个：界面上的「‹ 今天」「看看 →」会回退到系统字体 |
| 霞鹜文楷（基线） | SIL OFL 1.1 | OFL-1.1 | 全有 | 缺 〱〲〯＀〮 |

「时 以 测」三个字四款都有，字形见样张底部对照条。

## 子集（仓库脚本 `miniapp/scripts/v5-font-subset.py`，7031 码位，WOFF）

| 子集 | 大小 | sha256 |
|---|---|---|
| Xiaolai-Regular.subset.woff | 1,905,828 B | `581790d525b776517563cd7c52ee2243ae5c1a39648ffcf3f2c4a66b4dd512c6` |
| Yozai-Regular.subset.woff | 2,590,816 B | `094a62fa66c86400ae28b3d27406dbd0c2382c014f7766aaa9ca85849e14beff` |
| Yozai-Medium.subset.woff | 2,547,504 B | `ffda12af75c0ee8897dbb4abc64cdbb509ad5e9ec3ace23ca4ed2b37349c9a96` |
| ZCOOLKuaiLe-Regular.subset.woff | 1,074,968 B | `eec9b5515ba7b151dbb90d0ed5541f499a3932acb2e1d5a20f361f660bfc4df3` |

悠哉子集时 pyftsubset 报 `morx NOT subset; dropped`（AAT 表被丢弃，不影响小程序渲染）。小赖、站酷只有 Regular 一个字重，粗体位（weight 700）用同一文件注册；悠哉用 Medium 作粗体。

## 怎么拍的

- 新建隔离副本 `<scratchpad>/iso-font`（rsync 自 `miniapp/`，`touristappid`、去 `cloudfunctionRoot`、`urlCheck=false`），代码与 `c049f21` 一致。
- 字体由本机 `127.0.0.1:8766` 的 CORS 静态服务提供；每款改写副本的 `config.local.js`，用开发者工具命令行关掉再打开项目（让 `app.js` 重新加载字体），自动化端口 9422。
- 数据：从第 2 批实例导出的同一份虚构数据（硕之 2026-08-04，3 条观察记录），`setStorageSync` 写入后 reLaunch 今天页拍图。
- 加载回执（`wx.loadFontFace`，同一地址再调一次）：四款 regular/bold 都 `loadFontFace:ok`，13–26 ms（本机 http）；控制台错误 0。
- 第一次跑文楷基线时自动化连接早于项目就绪而失败，多等 10 秒重跑通过。
- 样张 `字体样张-同屏对比.png`（3240×2088）：四列原分辨率今天页截图 + 用字体文件直接渲染的对照条「时 以 测 61.2 cm 10月28日 / 已约 · 定个日期 → ‹ 今天 / 硕之 2 个月 20 天 / 趴着能抬头了，撑了好几秒。」；单图 `01–04`。PNG 不入库。

## 没做

- 真机（iOS）渲染与加载时长；https 托管（上传云端要常浩另行同意）。
- 任何代码、token、组件规范改动。换字体即改权威包成员，需出 v6-authority-v2、重做 T1b 字体相关条目并重新批准。

## 结果

待常浩选。
