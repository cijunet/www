import { SITE, NAV } from './site.config.mjs';
import { esc, rel, tierLabel, lengthTier, charLen } from './util.mjs';

export function layout({ depth = 0, title, desc, canonical, bodyClass = '', jsonld = null, content, hero = '' }) {
  const R = rel(depth);
  const fullTitle = depth === 0 ? `${SITE.name} · ${SITE.tagline}` : `${title} - ${SITE.name}`;
  const d = desc || SITE.desc;
  const url = SITE.origin.replace(/\/$/, '') + SITE.base + (canonical || '');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(d)}">
<meta name="keywords" content="${esc(SITE.keywords.join(','))}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#a8322d">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='18' fill='%23a8322d'/%3E%3Ctext x='50' y='72' font-size='64' text-anchor='middle' fill='%23faf7f0' font-family='serif'%3E%E8%AF%8D%3C/text%3E%3C/svg%3E">
<link rel="apple-touch-icon" href="${R}assets/icon.svg">
<link rel="manifest" href="${R}assets/manifest.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="词句">
<link rel="stylesheet" href="${R}assets/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">跳到正文</a>
<header class="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="${R}">
      <span class="brand-mark">词</span>
      <span class="brand-text"><b>${esc(SITE.name)}</b><i>${esc(SITE.tagline)}</i></span>
    </a>
    <nav class="nav">
      ${NAV.map(n => `<a href="${R}${n.href}">${esc(n.label)}</a>`).join('')}
    </nav>
    <button class="nav-toggle" aria-label="菜单" data-nav-toggle>☰</button>
  </div>
</header>
${hero}
<main id="main">${content}</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="foot-cols">
      <div>
        <b>${esc(SITE.name)}</b>
        <p>${esc(SITE.desc)}</p>
      </div>
      <div>
        <b>逛一逛</b>
        <a href="${R}scenes/">全部场景</a>
        <a href="${R}moods/">按心情找</a>
        <a href="${R}places/">按地点找</a>
        <a href="${R}authors/">按作者找</a>
        <a href="${R}all/">全部词句</a>
      </div>
      <div>
        <b>关于</b>
        <a href="${R}about/">关于本站</a>
        <a href="${R}search/">站内搜索</a>
        <span class="muted">收录内容多为公有领域作品，近现代及外文引文均标注出处。</span>
      </div>
    </div>
    <div class="copy">© ${SITE.year} ${esc(SITE.name)}</div>
  </div>
</footer>
<nav class="tabbar" aria-label="底部导航">
  <a class="tb" data-tb="home" href="${R}"><span class="tb-ic">⌂</span><span>首页</span></a>
  <a class="tb" data-tb="scenes" href="${R}scenes/"><span class="tb-ic">◫</span><span>场景</span></a>
  <a class="tb" data-tb="moods" href="${R}moods/"><span class="tb-ic">☺</span><span>心情</span></a>
  <a class="tb" data-tb="places" href="${R}places/"><span class="tb-ic">⌖</span><span>地点</span></a>
  <a class="tb" data-tb="authors" href="${R}authors/"><span class="tb-ic">✎</span><span>作者</span></a>
  <a class="tb" data-tb="all" href="${R}all/"><span class="tb-ic">☰</span><span>全部</span></a>
</nav>
<script src="${R}assets/msgpack.min.js"></script>
<script src="${R}assets/app.js" defer></script>
</body>
</html>`;
}

// 单条词句卡片
/* ── 「附近的诗句」定位入口 ─────────────────────
 * 首页用 compact（一行话 + 按钮，不喧宾夺主），
 * 地点页用完整版（讲清楚由近及远怎么铺开）。
 * 两处共用同一套 data-* 钩子，app.js 只认第一个 [data-nearme]，所以一个页面只放一个。 */
export function nearMeBlock({ compact = false } = {}) {
  if (compact) {
    return `<section class="near-me compact" data-nearme>
    <div class="nm-inner">
      <h2 class="nm-title">📍 就在你脚下的这片地方</h2>
      <p class="nm-sub">古人也在这里写过诗。授权定位，由近及远给你翻出来。</p>
      <button class="nm-btn" type="button" data-geo-btn>看看此地的诗句</button>
      <div class="nm-out" data-geo-out></div>
    </div>
  </section>`;
  }
  return `<section class="near-me" data-nearme>
    <div class="nm-inner">
      <h2 class="nm-title">📍 按你所在的地方找</h2>
      <p class="nm-sub">授权获取你的位置，全站词句会按「就在此处 → 就在附近 → 这一带 → 这一方水土」由近及远铺开，每个古地名单独成组。比如你在镇江南山，先给你京口北固亭，再是瓜洲、广陵、金陵，最后才是整个江南。</p>
      <button class="nm-btn" type="button" data-geo-btn>获取我的位置</button>
      <div class="nm-out" data-geo-out></div>
    </div>
  </section>`;
}

export function card(p, R, { showScenes = true } = {}) {
  const tier = lengthTier(p.t);
  const src = [p.a, p.w ? `《${p.w}》` : ''].filter(Boolean).join(' ');
  return `<article class="q" data-tier="${tier}" data-len="${charLen(p.t)}" data-origin="${p.origin}" data-moods="${(p.m || []).join(' ')}" data-scenes="${(p.s || []).join(' ')}" data-places="${(p.pl || []).join(' ')}" id="q-${p.id}">
  <blockquote class="q-text">${esc(p.t)}</blockquote>
  ${p.o ? `<p class="q-o">${esc(p.o)}</p>` : ''}
  ${p.x ? `<p class="q-x">${esc(p.x)}</p>` : ''}
  <div class="q-meta">
    ${p.authorSlug ? `<a class="q-src" href="${R}a/${p.authorSlug}/">${esc(src || p.a || '佚名')}</a>` : `<span class="q-src">${esc(src)}</span>`}
    ${p.d ? `<span class="q-dyn">${esc(p.d)}</span>` : ''}
    <span class="q-tier t-${tier}">${tierLabel[tier]}</span>
  </div>
  ${p.n ? `<p class="q-note"><span>怎么用</span>${esc(p.n)}</p>` : ''}
  ${showScenes && p.sceneRefs && p.sceneRefs.length ? `<div class="q-scenes">${p.sceneRefs.map(s => `<a href="${R}s/${s.id}/">${esc(s.name)}</a>`).join('')}</div>` : ''}
  <div class="q-act">
    <button class="btn-copy" data-copy="${esc(p.t)}">复制</button>
    <button class="btn-copy alt" data-copy="${esc(p.t + (src ? ' —— ' + src : ''))}">带出处复制</button>
    <button class="btn-fav" data-fav="${p.id}" aria-label="收藏">☆</button>
  </div>
</article>`;
}

export function cardList(list, R, opts) {
  if (!list.length) return `<p class="empty">这个场景还没有收录，正在补。</p>`;
  return `<div class="q-list">${list.map(p => card(p, R, opts)).join('')}</div>`;
}

// 筛选条
export function filterBar(moods, places) {
  return `<div class="filters" data-filters>
  <div class="f-row">
    <span class="f-label">长度</span>
    <button class="chip on" data-f="tier" data-v="">不限</button>
    <button class="chip" data-f="tier" data-v="short">极短 ≤12字</button>
    <button class="chip" data-f="tier" data-v="mid">适中</button>
    <button class="chip" data-f="tier" data-v="long">偏长</button>
  </div>
  <div class="f-row">
    <span class="f-label">来源</span>
    <button class="chip on" data-f="origin" data-v="">不限</button>
    <button class="chip" data-f="origin" data-v="classic">古典</button>
    <button class="chip" data-f="origin" data-v="modern">近现代</button>
    <button class="chip" data-f="origin" data-v="world">外国</button>
  </div>
  ${moods && moods.length ? `<div class="f-row">
    <span class="f-label">心情</span>
    <button class="chip on" data-f="mood" data-v="">不限</button>
    ${moods.map(m => `<button class="chip" data-f="mood" data-v="${m.id}">${esc(m.name)}</button>`).join('')}
  </div>` : ''}
  ${places && places.length ? `<div class="f-row">
    <span class="f-label">地点</span>
    <button class="chip on" data-f="place" data-v="">不限</button>
    ${places.map(pl => `<button class="chip" data-f="place" data-v="${pl.id}">${esc(pl.name)}</button>`).join('')}
  </div>` : ''}
  <div class="f-count"><span data-count></span> 句</div>
</div>`;
}
