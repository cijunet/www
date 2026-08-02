import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import msgpack from 'msgpack-lite';
import { loadAll } from './load.mjs';
import { SITE } from './site.config.mjs';
import { homePage, scenePage, groupPage, moodPage, authorPage } from './pages.mjs';
import { scenesIndexPage, moodsIndexPage, authorsIndexPage, allPage, searchPage, aboutPage } from './pages2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'WWW');

const written = new Set();
function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, 'utf8');
  written.add(path.resolve(file));
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

fs.mkdirSync(OUT, { recursive: true });

let n = 0;
writePage('', homePage(D)); n++;
writePage('scenes', scenesIndexPage(D)); n++;
writePage('moods', moodsIndexPage(D)); n++;
writePage('authors', authorsIndexPage(D)); n++;
writePage('all', allPage(D)); n++;
writePage('search', searchPage(D)); n++;
writePage('about', aboutPage(D)); n++;
for (const s of D.scenes) { writePage(`s/${s.id}`, scenePage(D, s)); n++; }
for (const g of D.groups) { writePage(`g/${g.id}`, groupPage(D, g)); n++; }
for (const m of D.moods) { writePage(`m/${m.id}`, moodPage(D, m)); n++; }
for (const a of D.authors) { writePage(`a/${a.slug}`, authorPage(D, a)); n++; }

// 静态资源
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
for (const f of fs.readdirSync(path.join(OUT, 'assets'))) written.add(path.resolve(OUT, 'assets', f));

// 搜索索引（精简字段，压体积）
const index = D.pieces.map(p => ({
  i: p.id, t: p.t, a: p.a, w: p.w || '', d: p.d || '',
  s: p.s, m: p.m, o: p.origin, l: p.len, n: p.n || '',
  fo: p.o || '', x: p.x || '',
  k: p.s.map(id => D.sceneMap[id]).filter(Boolean).flatMap(x => [x.name, ...(x.kw || [])]).join(' ')
}));
const dataPayload = {
  built: new Date().toISOString(),
  scenes: D.scenes.map(s => ({ id: s.id, name: s.name, g: s.g, desc: s.desc, kw: s.kw })),
  moods: D.moods.map(m => ({ id: m.id, name: m.name })),
  pieces: index
};
write('data/index.json', JSON.stringify(dataPayload));

// MessagePack 二进制（网站运行时优先加载，体积更小、解析更快）
const mpBuf = msgpack.encode(dataPayload);
write('data/pieces.msgpack', mpBuf);
console.log(`  MessagePack ${mpBuf.length} 字节（约等于 JSON ${Buffer.byteLength(JSON.stringify(dataPayload))} 字节的 ${Math.round(mpBuf.length / Buffer.byteLength(JSON.stringify(dataPayload)) * 100)}%）`);

// GitHub Pages / SEO 辅助文件
write('.nojekyll', '');
const base = SITE.origin.replace(/\/$/, '') + SITE.base;
const urls = [
  '', 'scenes/', 'moods/', 'authors/', 'all/', 'search/', 'about/',
  ...D.scenes.map(s => `s/${s.id}/`),
  ...D.groups.map(g => `g/${g.id}/`),
  ...D.moods.map(m => `m/${m.id}/`),
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
- 按作者检索：${base}authors/
- 全部词句：${base}all/
- 结构化数据（MessagePack，站点运行时加载）：${base}data/pieces.msgpack
- 结构化数据（JSON，兜底/供程序读取）：${base}data/index.json
`);

const stale = pruneStale(OUT);

console.log(`\n  ${SITE.name} 构建完成`);
if (stale) console.log(`  清理陈旧文件 ${stale} 个`);
console.log(`  页面 ${n} 个 · 词句 ${D.pieces.length} 条 · 场景 ${D.scenes.length} 个 · 作者 ${D.authors.length} 位 · ${Date.now() - t0}ms`);
if (D.warnings.length) {
  console.log(`\n  ⚠ 数据提醒 ${D.warnings.length} 条：`);
  D.warnings.slice(0, 40).forEach(w => console.log('    - ' + w));
  if (D.warnings.length > 40) console.log(`    …还有 ${D.warnings.length - 40} 条`);
}
console.log('');
