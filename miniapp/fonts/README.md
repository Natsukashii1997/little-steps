# 霞鹜文楷子集（S1）

来源：GitHub `lxgw/LxgwWenKai` v1.530（SIL Open Font License 1.1）。常浩 2026-10-24 同意下载。v1.530 的字重是 Light / Regular / Medium，没有叫 Bold 的文件，粗体用 Medium 顶替（注册为 weight 700）。

| 原文件 | 大小 | sha256 |
|---|---|---|
| LXGWWenKai-Regular.ttf | 25,928,940 B | `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b` |
| LXGWWenKai-Medium.ttf | 25,800,076 B | `f4b8a34d1f838fe411540cb7c97b1c384ac9738a876c4104500bc42508b2312a` |

原文件不入库（在会话临时目录）。子集由 `scripts/v5-font-subset.py` 生成：ASCII、GB2312 的 6763 个汉字、中文标点、全角字符、界面符号，共 7031 个码位，WOFF 格式。

| 子集 | 大小 | sha256 |
|---|---|---|
| LXGWWenKai-Regular.subset.woff | 2,106,132 B | `cc1c81dfbd9c163a7a1e53f220b215328a75acf470cdc6bd36449cfb7c6a054c` |
| LXGWWenKai-Medium.subset.woff | 2,114,520 B | `2feffa6297e2fd19799cea01643787e5d5b325d863dd1dbdb2035bf5b2fcab34` |

## 怎么用

- 字体不进小程序包。放到 https 地址（计划放现有云开发的云存储；上传云端要常浩另行同意），地址填进 `config.local.js` 的 `fontSources`，`lib/v5/font.js` 用 `wx.loadFontFace` 加载，加载前用系统字体。
- **托管的地址必须返回 `Access-Control-Allow-Origin` 头**，否则 `loadFontFace` 失败（2026-10-24 在开发者工具里实测：没有 CORS 头时失败，加上后成功）。
- 开发者工具里 http 可以；真机 iOS 只认 https。
- 开发者工具实测：本机地址加载 Regular 43 ms、Medium 38 ms（含自动化往返，不代表真机网络）。真机的加载时长在第 4 批测。
- 用户输入超出 GB2312 的生僻字会回退到系统字体。
