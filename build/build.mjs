import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import msgpack from 'msgpack-lite';
import { encrypt } from './crypto.mjs';
import { loadAll } from './load.mjs';
import { GAZETTEER, geoClientJSON } from './gazetteer.mjs';
import { tagPieces } from './geotag.mjs';
import { SITE } from './site.config.mjs';
import { yearCalendar, fallbackTerms } from './lunar.mjs';
import { KW_VOCAB, pickEvents } from './kwvocab.mjs';
import { homePage, scenePage, groupPage, moodPage, authorPage, placePage } from './pages.mjs';
import { scenesIndexPage, moodsIndexPage, authorsIndexPage, placesIndexPage, searchPage, aboutPage } from './pages2.mjs';
import { jqPage, jqIndexPage } from './jq_pages.mjs';
import { JQ } from './_jq_data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, process.env.BUILD_OUT || 'WWW');

const written = new Set();
let skipped = 0, wrote = 0;
function write(rel, html) {
  const file = path.join(OUT, rel);
  written.add(path.resolve(file));
  // 增量写入：目标已存在且内容一致则跳过（大幅减少小文件 IO）
  try {
    if (fs.readFileSync(file, 'utf8') === html) { skipped++; return file; }
  } catch {}
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
  wrote++;
  return file;
}

// 清掉上一次构建残留、这次不再生成的页面（场景 id 改名时会用到）
function pruneStale(dir) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      removed += pruneStale(full);
      try { if (!fs.readdirSync(full).length) { fs.rmdirSync(full); } } catch {}
    } else if (!written.has(path.resolve(full))) {
      try { fs.unlinkSync(full); removed++; } catch {}
    }
  }
  return removed;
}
function writePage(dir, html) { write(dir ? `${dir}/index.html` : 'index.html', html); }

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

const t0 = Date.now();
const D = await loadAll();

// 站点简介动态化：把全站数据写进 SITE.desc（随数据变化自动更新，用于首页简介/meta/JSON-LD）
(function buildDesc() {
  const P = D.pieces;
  let c = 0, mo = 0, wo = 0;
  P.forEach(p => { if (p.origin === 'classic') c++; else if (p.origin === 'modern') mo++; else wo++; });
  SITE.desc = `按此刻的处境找词句。登顶、放榜、送别、深夜加班……${D.scenes.length} 个具体场景、${D.moods.length} 种心情、${D.places.length} 处地点，收录 ${P.length} 条可复制的词句（古典 ${c} · 近现代 ${mo} · 外国 ${wo}），出自 ${D.authors.length} 位古今中外作者，覆盖 24 节气。每一句都标好出处、怎么用、长度与白话译文，支持语音朗读、一键复制，点一下就带走。`;
})();

// 构建前校验：错位 id / 空场景 / 重复正文 一律告警，避免脏数据静默上线
(function validate() {
  const sc = new Set(D.scenes.map(s => s.id));
  const mo = new Set(D.moods.map(s => s.id));
  const pls = new Set(D.places.map(s => s.id));
  const norm = s => String(s || '').replace(/[\s，。、？！；：""''‘’“”（）()《》·—…\-.,!?;:]/g, '');
  const seen = new Set();
  let badS = 0, badM = 0, badP = 0, emptyS = 0, dup = 0;
  for (const p of D.pieces) {
    (p.s || []).forEach(x => { if (!sc.has(x)) { badS++; console.warn('  ⚠ 未知场景id:', x, '|', (p.t || '').slice(0, 14)); } });
    (p.m || []).forEach(x => { if (!mo.has(x)) { badM++; console.warn('  ⚠ 未知心情id:', x, '|', (p.t || '').slice(0, 14)); } });
    (p.pl || []).forEach(x => { if (!pls.has(x)) { badP++; console.warn('  ⚠ 未知地点id:', x, '|', (p.t || '').slice(0, 14)); } });
    if (!p.s || !p.s.length) emptyS++;
    const k = norm(p.t); if (k) { if (seen.has(k)) dup++; else seen.add(k); }
  }
  if (emptyS) console.warn('  ⚠ 空场景id 条目:', emptyS);
  if (dup) console.warn('  ⚠ 重复正文 条数:', dup);
  if (!badS && !badM && !badP && !emptyS && !dup) console.log('  校验通过：无错位 id / 空场景 / 重复正文');
})();

// 地名自动标注：扫「出处/题目」得题咏地(gw)，扫「正文」得描写地(gd)
const geoStat = tagPieces(D.pieces);
console.log(geoStat.report());
if (D.mergedDups) console.log(`  重复正文已合并 ${D.mergedDups} 组（标签并入先收录条目）`);

fs.mkdirSync(OUT, { recursive: true });

let n = 0;
writePage('', homePage(D)); n++;
writePage('scenes', scenesIndexPage(D)); n++;
writePage('moods', moodsIndexPage(D)); n++;
writePage('places', placesIndexPage(D)); n++;
writePage('authors', authorsIndexPage(D)); n++;
writePage('search', searchPage(D)); n++;
writePage('about', aboutPage(D)); n++;
writePage('jq', jqIndexPage(D)); n++;
for (const j of JQ) { writePage(`jq/${j.id}`, jqPage(D, j)); n++; }
for (const s of D.scenes) { writePage(`s/${s.id}`, scenePage(D, s)); n++; }
for (const g of D.groups) { writePage(`g/${g.id}`, groupPage(D, g)); n++; }
for (const m of D.moods) { writePage(`m/${m.id}`, moodPage(D, m)); n++; }
for (const a of D.authors) { writePage(`a/${a.slug}`, authorPage(D, a)); n++; }
for (const pl of D.places) { writePage(`p/${pl.id}`, placePage(D, pl)); n++; }

// 静态资源
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
// 把 assets 下所有文件都标记为已写入，避免 pruneStale 误删
// （vendor / models 为已移除的语音资源，不再保护，允许被清理）
(function markAssets(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'vendor' || e.name === 'models') continue;
      markAssets(p);
    } else written.add(path.resolve(p));
  }
})(path.join(OUT, 'assets'));

// 搜索索引（精简字段，压体积；m/o 等只在服务端渲染用，不下发）
const index = D.pieces.map(p => ({
  i: p.id, t: p.t, a: p.a, w: p.w || '', d: p.d || '',
  s: p.s, pl: p.pl || [], l: p.len, n: p.n || '',
  fo: p.o || '', x: p.x || '',
  gw: p.gw || [], gd: p.gd || [],
  k: [...p.s.map(id => D.sceneMap[id]).filter(Boolean).flatMap(x => [x.name, ...(x.kw || [])]),
     ...(p.pl || []).map(id => D.placeMap[id]).filter(Boolean).map(x => x.name),
     ...[...(p.gw || []), ...(p.gd || [])].map(id => (GAZETTEER.find(g => g.id === id) || {}).name).filter(Boolean)
    ].join(' ')
}));
const dataPayload = {
  built: new Date().toISOString(),
  scenes: D.scenes.map(s => ({ id: s.id, name: s.name, g: s.g, desc: s.desc, kw: s.kw })),
  moods: D.moods.map(m => ({ id: m.id, name: m.name })),
  places: D.places.map(pl => ({ id: pl.id, name: pl.name })),
  geo: geoClientJSON(),
  pieces: index
};
// MessagePack 二进制 + 轻量加密（网站运行时优先加载，体积更小、解析更快，且不直接暴露明文）
const mpBuf = msgpack.encode(dataPayload);
const encBuf = encrypt(mpBuf);
write('data/pieces.msgpack.enc', encBuf);
// 用数据指纹做 Service Worker 缓存版本号（数据变则版本变，自动失效旧缓存）
const APP_VER = createHash('sha256').update(mpBuf).digest('hex').slice(0, 8);
console.log(`  MessagePack ${mpBuf.length} 字节 → 加密 ${encBuf.length} 字节（约等于 JSON ${Buffer.byteLength(JSON.stringify(dataPayload))} 字节的 ${Math.round(mpBuf.length / Buffer.byteLength(JSON.stringify(dataPayload)) * 100)}%）`);

// ── 今日版块数据：节日/节气日历（预推 16 年）+ 历史上的今天 ──
const rawHistPath = path.join(ROOT, 'data', 'history-raw.json');
if (fs.existsSync(rawHistPath)) {
  const raw = JSON.parse(fs.readFileSync(rawHistPath, 'utf8'));
  const THIS_YEAR = new Date().getFullYear();
  const years = {};
  for (let y = THIS_YEAR; y <= THIS_YEAR + 15; y++) years[y] = yearCalendar(y);
  const days = {};
  let evTotal = 0, kwHits = 0;
  for (const [mmdd, events] of Object.entries(raw.days || {})) {
    const picked = pickEvents(events, KW_VOCAB, 6);
    days[mmdd] = picked;
    evTotal += picked.length;
    kwHits += picked.filter(e => e.kw.length).length;
  }
  const histPayload = {
    built: new Date().toISOString().slice(0, 10),
    source: raw.source || '',
    years,                 // { "2026": { "0217": {n,kind,s,scenes,kw}, ... } }
    terms: fallbackTerms(THIS_YEAR), // 超出预推年份时的节气兜底
    days                   // { "0804": [ {y,t,kw}, ... ] }
  };
  write('data/history.json', JSON.stringify(histPayload));
  console.log(`  历史上的今天：${Object.keys(days).length} 天 · ${evTotal} 条 · ${kwHits} 条可关联词句`);
} else {
  console.warn('  ⚠ 未找到 data/history-raw.json，「今日」版块无历史事件（可用 node build/fetch-history.mjs 生成）');
}

// GitHub Pages / SEO 辅助文件
write('.nojekyll', '');
// 自定义域名（GitHub Pages 读取此文件把站点挂到 ciju.net）+ 404 页
write('CNAME', SITE.origin.replace(/^https?:\/\//, '').replace(/\/$/, ''));
// Service Worker：让站点具备 App 体验（可安装、可离线、秒开）
write('sw.js', `const APP='ciju-app-${APP_VER}';        // 缓存版本：随数据指纹自动变化，旧缓存自动失效（无需手改）
const SHELL=['./','./index.html','./assets/style.css','./assets/app.js','./assets/msgpack.min.js','./assets/manifest.webmanifest','./assets/icon.svg','./404.html','./scenes/','./moods/','./places/','./authors/','./search/','./about/'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(APP).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>true));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==APP).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  const cacheFirst=()=>caches.match(req).then(m=>m||fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(APP).then(c=>c.put(req,cp));}return r;}).catch(()=>caches.match('./index.html')));
  // 数据文件：stale-while-revalidate（先取缓存秒开，后台静默更新）
  if(url.pathname.indexOf('/data/')>=0){
    e.respondWith(caches.open(APP).then(async c=>{const cached=await c.match(req);const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone());return r;}).catch(()=>cached);return cached||net;}));
    return;
  }
  // 页面与静态资源：cache-first（构建期不可变，版本号已变即换新缓存）
  e.respondWith(cacheFirst());
});`);
write('404.html', `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>没找着 — ${SITE.name}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='18' fill='%23a8322d'/%3E%3Ctext x='50' y='72' font-size='64' text-anchor='middle' fill='%23faf7f0' font-family='serif'%3E%E8%AF%8D%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/style.css">
</head>
<body class="page-home">
<header class="site-head"><div class="wrap head-inner"><a class="brand" href="./"><span class="brand-mark">词</span><span class="brand-text"><b>${SITE.name}</b><i>${SITE.tagline}</i></span></a></div></header>
<main id="main"><section class="hero" style="border-bottom:0"><div class="wrap">
<h1>这句，还没收</h1>
<p class="hero-sub">你要找的那一句，本站暂时没有。<br>不如换个处境翻翻，或者去全站里慢慢找。</p>
<div class="hero-hot">
<a href="./">回到首页</a><a href="scenes/">全部场景</a><a href="moods/">按心情找</a><a href="places/">按地点找</a><a href="authors/">按作者找</a><a href="search/">站内搜索</a>
</div>
</div></section></main>
<footer class="site-foot"><div class="wrap"><div class="copy">© ${SITE.year} ${SITE.name}</div></div></footer>
</body>
</html>`);
const base = SITE.origin.replace(/\/$/, '') + SITE.base;
const urls = [
  '', 'scenes/', 'moods/', 'places/', 'authors/', 'search/', 'about/', 'jq/',
  ...JQ.map(j => `jq/${j.id}/`),
  ...D.scenes.map(s => `s/${s.id}/`),
  ...D.groups.map(g => `g/${g.id}/`),
  ...D.moods.map(m => `m/${m.id}/`),
  ...D.places.map(pl => `p/${pl.id}/`),
  ...D.authors.map(a => `a/${a.slug}/`)
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${base}${u}</loc><changefreq>weekly</changefreq><priority>${u === '' ? '1.0' : u.startsWith('s/') ? '0.9' : '0.6'}</priority></url>`).join('\n')}
</urlset>`);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}sitemap.xml\n`);

// llms.txt —— 让 AI 检索时能快速理解本站结构
write('llms.txt', `# ${SITE.name}

> ${SITE.desc}

${SITE.name} 是一个按「具体处境」组织的中文好词好句检索站。与按朝代、体裁分类的传统诗词站不同，本站把古今中外的作品拆成可直接使用的短句，归置到 ${D.scenes.length} 个日常场景下，并为每一句标注适用长度、情绪与使用建议。

## 数据规模
- 词句：${D.pieces.length} 条
- 场景：${D.scenes.length} 个，归入 ${D.groups.length} 个大类
- 情绪标签：${D.moods.length} 种
- 地点标签：${D.places.length} 处
- 作者：${D.authors.length} 位

## 核心设计
- 一首作品可拆为多条独立短句，分别归属不同场景
- 一条短句可同时归属多个场景（一句多用）
- 每条短句附「怎么用」的实用提示，说明适合发布的渠道与搭配
- 按字数分为极短（≤12字）、适中（13-28字）、偏长（>28字）三档

## 场景大类
${D.groups.map(g => `- ${g.name}（${g.tag}）：${D.scenesByGroup.find(x => x.id === g.id).scenes.map(s => s.name).join('、')}`).join('\n')}

## 主要入口
- 全部场景：${base}scenes/
- 按心情检索：${base}moods/
- 按地点检索：${base}places/
- 按作者检索：${base}authors/
- 结构化数据（二进制加密，站点运行时加载）：${base}data/pieces.msgpack.enc
`);

const stale = pruneStale(OUT);

console.log(`\n  ${SITE.name} 构建完成`);
if (stale) console.log(`  清理陈旧文件 ${stale} 个`);
console.log(`  页面 ${n} 个 · 词句 ${D.pieces.length} 条 · 场景 ${D.scenes.length} 个 · 作者 ${D.authors.length} 位 · 写入 ${wrote} / 跳过 ${skipped} · ${Date.now() - t0}ms`);
if (D.warnings.length) {
  console.log(`\n  ⚠ 数据提醒 ${D.warnings.length} 条：`);
  D.warnings.slice(0, 40).forEach(w => console.log('    - ' + w));
  if (D.warnings.length > 40) console.log(`    …还有 ${D.warnings.length - 40} 条`);
}
console.log('');
