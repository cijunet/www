# 词句 · 此刻，说句好的

按此刻的处境找词句的中文静态站。登顶、放榜、送别、深夜加班……272 个具体场景、123 种心情、178 处地点，每一句都标好了「怎么用」。古诗词、名人名言、中外金句，点一下就复制。

**数据量**：11,645 条词句 · 1,063 位作者 · 272 场景全覆盖 · 24 节气全覆盖 · 1681 个静态页

## 快速开始

```bash
npm install          # 安装依赖（xlsx / msgpack-lite）
npm run ci           # 一键质量门禁：audit → test → build → fronttest → check → fingerprint
npm run fronttest    # 前端无头自测（假 DOM + 真实数据执行 app.js，17 项断言）
npm run serve        # 本地预览（http://localhost:3000 附近）
```

构建产物在 `WWW/` 目录（纯静态，可直接上传 GitHub Pages / 任意静态托管）。

## 架构

```
词句数据.xlsx        ← 唯一真源（改数据只改它）
  └─ build/load.mjs  ← 读取 + 校验 + 去重合并 + 分类（classic/modern/world）+ 长度分级
       └─ build/build.mjs  ← 生成 1681 个静态页 → WWW/
            ├─ WWW/s/*       场景页（272 个）
            ├─ WWW/jq/*      二十四节气文化专题页（24 + 1）
            ├─ WWW/a/*       作者页（含同时代推荐）
            ├─ WWW/data/     检索索引（msgpack + json）
            ├─ WWW/sw.js     Service Worker（可安装、可离线）
            └─ WWW/sitemap.xml   SEO
```

## 数据纪律

- **xlsx 是唯一真源**；增量数据经 `data/supplement*.json` 合入后必须回收回 xlsx
- 任何 xlsx 写入前先备份到 `ciju_trash/`
- 每批改动跑 `npm run ci`，**零告警才交付**
- 质量门禁（`build/audit.mjs`，13 项）：近似重复 / 缺字段 / 错别字 / 外文正文 / 误传句黑名单 / 场景错配回潮 / 同句异译 / 占位符 等

## 部署到 GitHub Pages

站点已为 GitHub Pages 就绪：站内链接全部相对路径、sw/manifest 相对化、404.html 兜底、无任何 CDN 外部依赖（全部本地托管）。

### 方式 A：自定义域名（推荐，正式站 ciju.net）

1. 仓库根放 `WWW/` 内容（或把构建输出指向仓库目录）
2. Settings → Pages → Deploy from branch → 选择分支与目录
3. 在域名服务商把 `ciju.net` 配 CNAME 指向 `你的用户名.github.io`
4. `WWW/CNAME` 已生成（内容 `ciju.net`），上传即生效
5. `build/site.config.mjs` 中 `origin` 已是 `https://ciju.net`，SEO canonical/OG/sitemap 一致

### 方式 B：项目子路径（暂用 user.github.io/ciju）

1. `build/site.config.mjs`：`base` 改为 `'/ciju/'`
2. 重新 `npm run ci`
3. 上传 `WWW/` 内容到仓库（子路径模式建议用 GitHub Actions 或 docs/ 目录）

### 本地调试

```bash
npm run build        # 构建到 WWW/
python -m http.server 8899 --directory WWW   # 本地起服务
# 访问 http://localhost:8899/
```

## 功能

- 场景 / 心情 / 地点 / 作者 / **二十四节气**五维检索，搜索支持多词 + 拼音首字母（`sls` → 苏轼）+ 命中高亮 + 加载更多
- **二十四节气专题页**（`jq/`）：每节气含三候 / 民俗 / 农谚 / 饮食 + 节气词句聚合，前后节气导航
- 每句：复制 / 带出处复制 / 分享卡片（生成 PNG）/ 语音朗读（TTS 零 CDN）/ 收藏
- 首页：今日主题 + 历史上的今天 + 此日此句
- 卡片：怎么用提示 · 白话译文 · 外文原句 · 长度分级（极短/适中/偏长）· 适用场景/地点标签 · 类似此刻推荐
- 作者页：同时代作者推荐 · 收藏导出/导入（md / JSON）
- 可访问性：按钮 aria-label / 朗读 aria-pressed / 结果区 aria-live
- 暗色模式（跟随系统 + 记忆）· PWA（可安装、可离线）

## 质量审计摘要（2026-08-06）

- 近似重复 0 · 缺「怎么用」0 · 缺白话 0 · 无场景 0 · 外文/日韩文正文 0 · 薄场景 0（全部 ≥20 句）
- 误传句（"世界上最遥远的距离"等）已归位并设黑名单防回潮
- 同句异译 123 对已并标归零 · 场景错配 590 处已按规则修复（51 条规则防回潮）
- 白话重写 338 条 · 长度分级全库生效 · 外文作者译名归一 18 对 · world 原文覆盖率 72%
- `npm run ci` 一键全绿（audit 13 项 + test 13 例 + build + fronttest 17 断言 + check + fingerprint）
