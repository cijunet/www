// 阶段 I：把「场景/心情/地点/作者/大类/节气」的详情页从独立 HTML 目录改为查询字符串实现。
// 站点目录因此从 1700+ 个文件骤降到个位数。详情内容由前端从分片数据渲染：
//
//   枢纽页 ?id=    /scenes/?id=aimei  /moods/?id=anjing  /places/?id=jiangnan  /authors/?id=libai
//   场景区查询串   /scenes/?type=g&id=xxx（大类）  /scenes/?type=jq&id=xxx（节气）
//   首页查询串     /?view=about  /?view=jq（旧根路径 /?type=g&id= 、/?type=jq&id= 兼容保留）
//
// 复用 records（分面倒排取 gid）+ card（渲染）+ meta（name/desc），不引入新的数据通道。
import { initRecords, cardsForFilter, getCards } from './records.js';
import { loadMeta } from './meta.js';
import { renderCard, setMeta } from './card.js';
import { baseHref, esc } from './util.js';

const HUB = {
  '/scenes/':  { kind: 'scene',  facet: 's',  nameKey: 'scenes',  plural: 'scenes',  title: '场景' },
  '/moods/':   { kind: 'mood',   facet: 'm',  nameKey: 'moods',   plural: 'moods',   title: '心情' },
  '/places/':  { kind: 'place',  facet: 'pl', nameKey: 'places',  plural: 'places',  title: '地点' },
  '/authors/': { kind: 'author', facet: 'a',  nameKey: 'authors', plural: 'authors', title: '作者' }
};

const PAGE = 300;   // 每批渲染 300 条：既不一次撑爆 DOM，也不再截断——余量由「加载更多」按需追加
// 当前列表的分页状态（同一时刻页面上只有一个列表：作者/场景/心情/地点详情 或 大类详情）
let LIST = null;    // { root, gids, shown, R }

function curPath() {
  const p = location.pathname.replace(/index\.html$/, '/');
  return p.endsWith('/') ? p : p + '/';
}

export function mountDetail() {
  const sp = new URLSearchParams(location.search);
  const p = curPath();
  const type = sp.get('type'), id = sp.get('id'), view = sp.get('view');
  // 大类 / 节气详情：统一放在场景区路径 /scenes/ 下（/scenes/?type=g&id= 、/scenes/?type=jq&id= ），
  // 根路径 /?type=g&id= 、/?type=jq&id= 保留兼容旧链接。
  if (p === '/scenes/' || p === '/' || p === '') {
    if (type === 'g' && id) return showGroupDetail(id);
    if (type === 'jq' && id) return showJqDetail(id);
  }
  if (HUB[p] && sp.has('id')) { showDetail(HUB[p], id); return; }
  if (p === '/' || p === '') {
    if (view === 'about') return showStatic('view-about');
    if (view === 'jq') return showStatic('view-jq');
  }
}

// 静态视图（关于 / 二十四节气索引）：内容已随首页产出，仅做显隐切换
function showStatic(id) {
  const idx = document.getElementById('hub-index');
  const view = document.getElementById(id);
  document.querySelectorAll('.hero,.page-hero').forEach(e => e.hidden = true);
  if (idx) idx.hidden = true;
  if (view) {
    view.hidden = false;
    view.scrollIntoView();
    document.title = (view.dataset.title ? view.dataset.title + ' - ' : '') + '词句';
  }
}

function hideChrome(root) {
  document.querySelectorAll('.hero,.page-hero').forEach(e => e.hidden = true);
  const idx = document.getElementById('hub-index');
  if (idx) idx.hidden = true;
  root.hidden = false;
  root.scrollIntoView();
}

// 无效 id（拼错 / 旧链接 / 改名）不再静默退回首页，而是显式「未找到」，避免看起来像首页崩溃。
function notFound(root, msg) {
  const idx = document.getElementById('hub-index');
  if (idx) idx.hidden = true;
  root.hidden = false;
  root.innerHTML = `<section class="page-hero"><div class="wrap">
    <h1>没有找到</h1><p class="lead">${esc(msg)}</p>
    <p><a href="${baseHref()}">返回首页</a></p>
  </div></section>`;
  root.scrollIntoView();
}

function showDetail(cfg, id) {
  const R = baseHref();
  const root = document.getElementById('detail-root');
  if (!root) return;
  initRecords(R).then(async () => {
    const meta = await loadMeta(); setMeta(meta);
    const entry = (meta[cfg.nameKey] || {})[id];
    if (!entry) return notFound(root, `没有找到这个${cfg.title}：${id}`);
    // 阶段 D：作者档案（简介/生卒年/字号）挂到 entry，详情页 hero 展示
    if (cfg.kind === 'author' && !entry.folk) {
      const info = (meta.authorInfo || {})[entry.name];
      if (info && !entry.desc) entry.desc = info.desc || '';
      if (info && !entry._info) entry._info = info;
    }
    const f = detailFiltersFromURL();
    const gids = await cardsForFilter({ [cfg.facet]: id, ...toFilterQuery(f) });
    const recs = await getCards(gids.slice(0, PAGE));
    hideChrome(root);
    root.innerHTML = detailHTML(cfg, entry, gids, recs, R, meta, f);
    document.title = `${entry.name} - 词句`;
    bindDetailList(root, cfg.facet, id);
    LIST = { root, gids, shown: Math.min(PAGE, gids.length), R };
  }).catch(e => console.error('[detail]', e));
}

function detailHero(cfg, entry, R, extra) {
  // 作者页：朝代并入标题行（苏轼 + 「宋」小标签），不再让朝代单独占一行；
  // 其余分类保留原 lead（描述/标签/年代）。作者无 desc 时不出 lead 行。
  // 民间类型（佛经/古诗十九首/谚语/歌词…）：标题前加「民间」标识，不显示朝代。
  const isAuthor = cfg.kind === 'author';
  const isFolk = isAuthor && entry.folk;
  const secTitle = isFolk ? '民间' : cfg.title;
  const dyn = (isAuthor && !isFolk) ? (entry.d || '') : '';
  const desc = isAuthor ? (entry.desc || '') : (entry.desc || entry.tag || entry.d || '');
  const folkName = entry.name;
  const h1 = isFolk ? `民间 · ${esc(folkName)}` : esc(entry.name);
  // 阶段 D：作者档案补充行（生卒年 · 字号 · 籍贯）
  const info = isAuthor && !isFolk ? (entry._info || null) : null;
  const infoLine = info ? `<p class="a-info">${[info.years, info.zi, info.home].filter(Boolean).map(esc).join(' · ')}</p>` : '';
  return `<section class="page-hero"><div class="wrap">
    <nav class="crumb"><a href="${R}">首页</a> › <a href="${R}${cfg.plural}/">${secTitle}</a> › <span>${esc(folkName)}</span></nav>
    <h1>${h1}${dyn ? `<small>${esc(dyn)}</small>` : ''}</h1>
    ${infoLine}
    ${desc ? `<p class="lead">${esc(desc)}</p>` : ''}
    ${extra || ''}
  </div></section>`;
}

function detailHTML(cfg, entry, gids, recs, R, meta, f) {
  return detailHero(cfg, entry, R)
    + `<div class="wrap">${filterBarHTML(f)}<div data-dlist>${detailCardsHTML(recs, R, gids.length)}</div>${siblingHTML(cfg, entry, R, meta)}</div>`;
}

/* ── 详情页筛选：长度（短/中等/偏长）+ 来源（古典/近现代/外国），复用搜索页分面通道 ── */
const ORIGIN_CODE = { classic: 0, modern: 1, world: 2 };
const TIER_CODE = { short: 0, mid: 1, long: 2 };
const FILTER_DEFS = [
  ['tier', '长度', [['', '不限'], ['short', '短'], ['mid', '中等'], ['long', '偏长']]],
  ['origin', '来源', [['', '不限'], ['classic', '古典'], ['modern', '近现代'], ['world', '外国']]]
];

// 筛选状态存 URL（?tier=short&origin=classic），可分享、刷新可还原
function detailFiltersFromURL() {
  const sp = new URLSearchParams(location.search);
  return { tier: sp.get('tier') || '', origin: sp.get('origin') || '' };
}
function toFilterQuery(f) {
  const o = {};
  if (f.tier && TIER_CODE[f.tier] !== undefined) o.tier = TIER_CODE[f.tier];
  if (f.origin && ORIGIN_CODE[f.origin] !== undefined) o.c = ORIGIN_CODE[f.origin];
  return o;
}
function filterBarHTML(cur) {
  return `<div class="filters s-filters detail-filters" data-dfilters>`
    + FILTER_DEFS.map(([fl, label, opts]) => `<div class="f-row"><span class="f-label">${label}</span>`
      + opts.map(([v, name]) => `<button type="button" class="chip${cur[fl] === v ? ' on' : ''}" data-df="${fl}" data-dv="${v}" aria-pressed="${cur[fl] === v}">${name}</button>`).join('')
      + '</div>').join('')
    + '</div>';
}
function paintFilterBar(bar, f) {
  bar.querySelectorAll('[data-df]').forEach(b => {
    const on = (f[b.dataset.df] || '') === b.dataset.dv;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function detailCardsHTML(recs, R, total) {
  if (!total) return '<p class="empty">这个分类还没有收录，正在补。</p>';
  const shown = Math.min(PAGE, total);
  const rest = total - shown;
  const stat = `<p class="stat" data-dstat>共 ${total} 句${rest > 0 ? ` · 已显示 ${shown} 句` : ''}</p>`;
  const cards = `<div class="q-list" data-dcards>${recs.map(r => renderCard(r, { R })).join('')}</div>`;
  const more = rest > 0
    ? `<div class="more-wrap" data-dmore><button type="button" class="btn-more" data-more>加载更多（还有 ${rest} 句）</button></div>`
    : '';
  return stat + cards + more;
}
// 追加下一批：只往 [data-dcards] 尾部插 HTML，不重绘已渲染部分（滚动位置不跳）。
// 复制按钮走 clipboard.js 的 document 级事件委托，新插入的卡片无需二次绑定。
async function loadMore(root) {
  if (!LIST || LIST.root !== root) return;
  const { gids, shown, R } = LIST;
  const next = gids.slice(shown, shown + PAGE);
  if (!next.length) return;
  const recs = await getCards(next);           // 内部按需 pushShard，大分类是渐进下载
  const box = root.querySelector('[data-dcards]');
  if (box) box.insertAdjacentHTML('beforeend', recs.map(r => renderCard(r, { R })).join(''));
  LIST.shown = shown + next.length;            // 按 gid 位置推进（而非 recs.length），个别缺卡也不会原地打转
  paintMore(root);
}
function paintMore(root) {
  if (!LIST) return;
  const totalN = LIST.gids.length, rest = totalN - LIST.shown;
  const stat = root.querySelector('[data-dstat]');
  if (stat) stat.textContent = rest > 0 ? `共 ${totalN} 句 · 已显示 ${LIST.shown} 句` : `共 ${totalN} 句（已全部展开）`;
  const wrap = root.querySelector('[data-dmore]');
  if (!wrap) return;
  if (rest <= 0) { wrap.remove(); return; }
  const btn = wrap.querySelector('[data-more]');
  if (btn) { btn.disabled = false; btn.textContent = `加载更多（还有 ${rest} 句）`; }
}
// 筛选点击 + 加载更多：监听点从筛选条上移到 #detail-root（列表区会被整段重绘，root 不会），一次绑定即可同时接管两者
function bindDetailList(root, facet, id) {
  if (root._dlBound) return;                 // 一个页面只绑一次（详情页为整页加载，root 不重建）
  root._dlBound = true;
  root.addEventListener('click', async e => {
    const more = e.target.closest('[data-more]');
    if (more) {
      if (more.disabled) return;
      const old = more.textContent;
      more.disabled = true; more.textContent = '加载中…';
      try { await loadMore(root); }
      catch (err) { console.error('[more]', err); more.textContent = old; more.disabled = false; }
      return;
    }
    const btn = e.target.closest('[data-df]');
    if (!btn) return;
    const f = detailFiltersFromURL();
    const fl = btn.dataset.df, v = btn.dataset.dv;
    f[fl] = (f[fl] === v) ? '' : v;            // 再点同项取消
    const sp = new URLSearchParams(location.search);
    for (const k of ['tier', 'origin']) { if (f[k]) sp.set(k, f[k]); else sp.delete(k); }
    try { history.replaceState({}, '', location.pathname + '?' + sp.toString()); } catch {}
    const bar = root.querySelector('[data-dfilters]');
    if (bar) paintFilterBar(bar, f);
    const R = baseHref();
    const gids = await cardsForFilter({ [facet]: id, ...toFilterQuery(f) });
    const recs = await getCards(gids.slice(0, PAGE));
    const dl = root.querySelector('[data-dlist]');
    if (dl) dl.innerHTML = detailCardsHTML(recs, R, gids.length);
    LIST = { root, gids, shown: Math.min(PAGE, gids.length), R };   // 换筛选 = 分页归零
  });
}

// 「换一个」：同大类其它场景 / 同心情地点 / 同作者朝代 / 其它大类
function siblingHTML(cfg, entry, R, meta) {
  let items = [];
  if (cfg.kind === 'scene') {
    items = Object.entries(meta.scenes || {})
      .filter(([, v]) => v.g === entry.g && v.name !== entry.name)
      .map(([sid, v]) => ({ name: v.name, url: `${R}scenes/?id=${sid}` }));
  } else if (cfg.kind === 'author') {
    if (entry.folk) {
      items = Object.entries(meta.authors || {})
        .filter(([, v]) => v.folk && v.name !== entry.name).slice(0, 12)
        .map(([slug, v]) => ({ name: v.name, url: `${R}authors/?id=${slug}` }));
    } else {
      items = Object.entries(meta.authors || {})
        .filter(([, v]) => !v.folk && v.d === entry.d && v.name !== entry.name).slice(0, 12)
        .map(([slug, v]) => ({ name: v.name, url: `${R}authors/?id=${slug}` }));
    }
  } else {
    items = Object.entries(meta[cfg.nameKey] || {})
      .filter(([, v]) => v.name !== entry.name)
      .map(([xid, v]) => ({ name: v.name, url: `${R}${cfg.plural}/?id=${xid}` }));
  }
  if (!items.length) return '';
  const alsoTitle = (cfg.kind === 'author' && entry.folk) ? '民间类型' : cfg.title;
  return `<section class="also"><h2>换个${alsoTitle}</h2>
    <div class="also-list">${items.map(it => `<a href="${it.url}">${esc(it.name)}</a>`).join('')}</div></section>`;
}

function showGroupDetail(id) {
  const R = baseHref();
  const root = document.getElementById('detail-root');
  if (!root) return;
  initRecords(R).then(async () => {
    const meta = await loadMeta(); setMeta(meta);
    const g = (meta.groups || {})[id];
    if (!g) return notFound(root, '没有找到这个大类：' + id);
    const gids = await cardsForFilter({ g: id, ...toFilterQuery(detailFiltersFromURL()) });
    const recs = await getCards(gids.slice(0, PAGE));
    const f = detailFiltersFromURL();
    const sceneCards = Object.entries(meta.scenes || {})
      .filter(([, v]) => v.g === id)
      .map(([sid, v]) => `<a class="s-card" href="${R}scenes/?id=${sid}"><b>${esc(v.name)}</b><i>${esc(v.desc || '')}</i></a>`)
      .join('');
    const otherGroups = Object.entries(meta.groups || {})
      .filter(([, v]) => v.name !== g.name)
      .map(([gid, v]) => `<a href="${R}scenes/?type=g&id=${gid}">${esc(v.name)}</a>`).join('');
    hideChrome(root);
    root.innerHTML = `<section class="page-hero"><div class="wrap">
      <nav class="crumb"><a href="${R}">首页</a> › <a href="${R}scenes/">全部场景</a> › <span>${esc(g.name)}</span></nav>
      <h1>${esc(g.name)}</h1><p class="lead">${esc(g.tag || '')} · ${gids.length} 句</p>
    </div></section>
    <div class="wrap"><div class="s-grid big">${sceneCards}</div>
    ${filterBarHTML(f)}
    <div data-dlist>${detailCardsHTML(recs, R, gids.length)}</div>
    <section class="also"><h2>换一类看看</h2><div class="also-list">${otherGroups}</div></section></div>`;
    document.title = `${g.name} - 词句`;
    bindDetailList(root, 'g', id);
    LIST = { root, gids, shown: Math.min(PAGE, gids.length), R };
  }).catch(e => console.error('[group]', e));
}

function showJqDetail(id) {
  const R = baseHref();
  const root = document.getElementById('detail-root');
  if (!root) return;
  initRecords(R).then(async () => {
    const meta = await loadMeta(); setMeta(meta);
    const arr = meta.jq || [];
    const j = arr.find(x => x.id === id);
    if (!j) return notFound(root, '没有找到这个节气：' + id);
    const sid = j.scene || j.id;
    const gids = await cardsForFilter({ s: sid });
    const recs = await getCards(gids.slice(0, PAGE));
    const i = arr.indexOf(j);
    const prev = arr[(i + arr.length - 1) % arr.length];
    const next = arr[(i + 1) % arr.length];
    const sceneName = (meta.scenes[sid] || {}).name || sid;
    hideChrome(root);
    root.innerHTML = `<section class="page-hero"><div class="wrap">
      <nav class="crumb"><a href="${R}">首页</a> › <a href="${R}?view=jq">二十四节气</a> › <span>${esc(j.name)}</span></nav>
      <h1>${esc(j.name)}</h1><p class="lead">${esc(j.date || '')} · ${esc(j.desc || '')}</p>
    </div></section>
    <div class="wrap">
      <div class="jq-culture">
        <div class="jq-item"><b>三候</b><span>${esc(j.time || '')}</span></div>
        <div class="jq-item"><b>民俗</b><span>${esc(j.folk || '')}</span></div>
        <div class="jq-item"><b>农谚</b><span>${esc(j.proverb || '')}</span></div>
        <div class="jq-item"><b>饮食</b><span>${esc(j.food || '')}</span></div>
      </div>
      ${recs.length ? `<p class="jq-link">相关场景：<a href="${R}scenes/?id=${sid}">${esc(sceneName)}（${gids.length} 句）</a></p>` : ''}
      ${recs.length ? `<div class="q-list">${recs.map(r => renderCard(r, { R })).join('')}</div>` : '<p class="lead">词句整理中…</p>'}
      <div class="jq-nav">
        <a class="chip" href="${R}scenes/?type=jq&id=${prev.id}">← ${esc(prev.name)}</a>
        <a class="chip" href="${R}scenes/?type=jq&id=${next.id}">${esc(next.name)} →</a>
      </div>
    </div>`;
    document.title = `${j.name} · 二十四节气 - 词句`;
  }).catch(e => console.error('[jq]', e));
}
