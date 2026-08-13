// 作品原文字典（「原文」功能，方案 A，见 data/原文功能计划-2026-08-12.md）：
// 懒加载 data/works.json.gz（fetchJSON 通道）——卡片「查看原文」跳转详情页与搜索二次召回共用。
// 字典 key = 作品名（与分片记录 w 字段一致），分片协议零改动。
//
// v2 两级数据：
//   works.meta.json.gz —— 栏目页目录（list:[{n,a,d,mode,type,era,c,g}]，无全文，~73KB）
//   works.json.gz      —— 详情页全文（items: name → {n,a,d,mode,t,src,note,g}，g=同篇拆句 gid[]）
// 栏目页只拉 meta；详情页按需拉全文（fetchJSON 通道，IDB 缓存后秒开）。
import { fetchJSON } from './hashsearch.js';
import { baseHref, esc } from './util.js';
import { initRecords, getCards } from './records.js';
import { loadMeta } from './meta.js';
import { speakText } from './tts.js';

let _promise = null;
let _items = null;
let _metaPromise = null;
let _meta = null;

export async function ensureWorks() {
  if (_promise) return _promise;
  _promise = (async () => {
    try { _items = ((await fetchJSON(baseHref(), 'works.json')) || {}).items || {}; }
    catch (e) { _items = {}; console.error('[works] 作品原文加载失败', e); }
    return _items;
  })();
  return _promise;
}

// 栏目页目录（轻量，含 type/era/gid）
export async function ensureWorksMeta() {
  if (_metaPromise) return _metaPromise;
  _metaPromise = (async () => {
    try {
      const j = await fetchJSON(baseHref(), 'works.meta.json');
      _meta = { list: (j && j.list) || [], meta: (j && j.meta) || {} };
    } catch (e) { _meta = { list: [], meta: {} }; console.error('[works] 原文目录加载失败', e); }
    return _meta;
  })();
  return _metaPromise;
}

// 作品名 → 原文条目（{n,a,d,mode,t,src,note,g}），无则 null
export async function workOf(w) {
  if (!w) return null;
  const items = await ensureWorks();
  return items[w] || null;
}

/* ── 原文栏目页（/works/）────────────────────────── */
const TYPE_LABEL = {
  '诗': '诗', '词': '词', '曲': '曲', '文': '文', '赋': '赋',
  '史传': '史', '子部': '子', '蒙学': '蒙', '佛经': '佛', '道经': '道',
  '医典': '医', '近现代': '近', '外国': '外'
};
const ERA_ORDER = ['先秦', '汉魏六朝', '隋唐', '两宋', '元明清', '近现代', '外国', '其他', ''];
const escH = encodeURIComponent;

function workHref(R, name) {
  return R + 'works/?w=' + encodeURIComponent(name);
}

export function mountWorksIndex(root = document) {
  const box = root.querySelector('[data-works-index]');
  if (!box) return;
  const R = baseHref();
  const statEl = box.querySelector('[data-works-stat]');
  const resEl = box.querySelector('#w-results');
  const qEl = box.querySelector('#wq');
  const clearEl = box.querySelector('#wq-clear');
  let LIST = null;       // 当前过滤后的 list
  let state = { type: '', tab: 'era', q: '' };

  const modeLabel = m => m === 'ctx' ? '节选' : m === 'para' ? '选段' : '全文';

  function cardHTML(x) {
    const t = TYPE_LABEL[x.type] || x.type || '篇';
    const c = x.c || 0;
    const g = (x.g || []).length;
    return `<a class="w-card" href="${workHref(R, x.n)}">
      <span class="w-card-t">${esc(t)}</span>
      <b>${esc(x.n)}</b>
      <i>${esc(x.a || '佚名')}${x.d ? ' · ' + esc(x.d) : ''}</i>
      <em>${modeLabel(x.mode)}${c ? ` · ${c} 句` : ''}</em>
    </a>`;
  }

  function groupCards(list) {
    const groups = [];
    if (state.tab === 'era') {
      for (const era of ERA_ORDER) {
        const sub = list.filter(x => (x.era || '') === era);
        if (!sub.length) continue;
        groups.push({ title: era || '未标注', sub });
      }
    } else if (state.tab === 'author') {
      const byA = new Map();
      for (const x of list) {
        const k = x.a || '佚名';
        if (!byA.has(k)) byA.set(k, []);
        byA.get(k).push(x);
      }
      for (const [a, sub] of [...byA.entries()].sort((a, b) => b[1].length - a[1].length)) {
        groups.push({ title: a, count: sub.length, sub });
      }
    } else {
      groups.push({ title: '', sub: list });
    }
    return groups;
  }

  function render() {
    const list = LIST || [];
    statEl.textContent = `原文库共 ${list.length} 篇${state.type ? ' · ' + state.type : ''}${state.q ? ' · 检索「' + state.q + '」' : ''}`;
    if (!list.length) { resEl.innerHTML = '<p class="empty">没有匹配的篇目。</p>'; return; }
    resEl.innerHTML = groupCards(list).map(g => {
      const head = g.title ? `<h3 class="w-group-h">${esc(g.title)}<em>${g.count || g.sub.length} 篇</em></h3>` : '';
      return `<section class="w-group">${head}<div class="w-grid">${g.sub.map(cardHTML).join('')}</div></section>`;
    }).join('');
  }

  function applyFilter() {
    let list = (_meta && _meta.list) || [];
    if (state.type) list = list.filter(x => x.type === state.type);
    if (state.q) {
      const q = state.q.toLowerCase();
      list = list.filter(x =>
        (x.n || '').toLowerCase().includes(q) ||
        (x.a || '').toLowerCase().includes(q) ||
        (x.d || '').toLowerCase().includes(q));
    }
    LIST = list;
    render();
  }

  ensureWorksMeta().then(meta => {
    _meta = meta;
    statEl.textContent = `原文库共 ${meta.list.length} 篇 · 覆盖拆句 ${meta.meta.covered || 0} 条 · 作者 ${meta.meta.byAuthor || 0} 位`;
    applyFilter();
  }).catch(() => {
    statEl.textContent = '原文库加载失败，请刷新重试';
  });

  box.querySelectorAll('.w-type-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      box.querySelectorAll('.w-type-chip').forEach(b => b.classList.toggle('on', b === btn));
      state.type = btn.dataset.wtype || '';
      applyFilter();
    });
  });
  box.querySelectorAll('.w-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      box.querySelectorAll('.w-tab').forEach(b => b.classList.toggle('on', b === btn));
      state.tab = btn.dataset.wtab;
      applyFilter();
    });
  });
  if (qEl) {
    let timer = 0;
    qEl.addEventListener('input', () => {
      if (clearEl) clearEl.hidden = !qEl.value;
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = qEl.value.trim(); applyFilter(); }, 180);
    });
    if (clearEl) clearEl.addEventListener('click', () => { qEl.value = ''; clearEl.hidden = true; state.q = ''; applyFilter(); qEl.focus(); });
  }
}

/* ── 原文详情页（/works/?w=作品名）────────────────── */
function hideChrome() {
  document.querySelectorAll('.hero,.page-hero').forEach(e => e.hidden = true);
  const idx = document.getElementById('hub-index');
  if (idx) idx.hidden = true;
}

export function mountWorksDetail(root = document) {
  const sp = new URLSearchParams(location.search);
  const w = sp.get('w');
  const p = location.pathname.replace(/index\.html$/, '/');
  if (!(p.endsWith('works/')) || !w) return;
  const R = baseHref();
  const droot = root.querySelector('#detail-root');
  if (!droot) return;
  hideChrome();
  (async () => {
    try {
      const work = await workOf(w);
      if (!work) {
        droot.hidden = false;
        droot.innerHTML = `<section class="page-hero"><div class="wrap"><h1>没有找到</h1>
          <p class="lead">原文库中没有「${esc(w)}」这篇。可能尚未收录，或链接有误。</p>
          <p><a href="${R}works/">返回原文库</a> · <a href="${R}search/?q=${escH(w)}">在全站搜一下</a></p>
        </div></section>`;
        droot.scrollIntoView();
        return;
      }
      droot.hidden = false;
      droot.innerHTML = await detailHTML(work, R);
      // 朗读全文：speakText 自动处理 播放/停止 状态切换与文案恢复
      const speakBtn = droot.querySelector('[data-work-speak]');
      if (speakBtn) {
        const fullText = (droot.querySelector('.q-work-text') || { textContent: '' }).textContent;
        speakBtn.addEventListener('click', () => speakText(speakBtn, fullText));
      }
      droot.scrollIntoView();
      document.title = `${work.n} · ${work.a || '佚名'} - 原文库 - 词句`;
    } catch (e) {
      console.error('[works] 详情加载失败', e);
      droot.hidden = false;
      droot.innerHTML = '<section class="page-hero"><div class="wrap"><h1>加载失败</h1><p class="lead">请刷新重试。</p></div></section>';
    }
  })();
}

// 定位 para 档（古籍选章）中拆句所在段落（±1 句）
const _normSeg = s => String(s || '').replace(/[\s，。！？；：、…—\-_""''“”‘’（）()《》〈〉「」『』【】\[\]·]/g, '');
function locatePara(full, sentence) {
  const nS = _normSeg(sentence);
  if (!nS) return null;
  const segs = String(full).split(/(?<=[。！？；])/).map(s => s.trim()).filter(Boolean);
  const idx = segs.findIndex(s => _normSeg(s).includes(nS));
  if (idx < 0) return null;
  const from = Math.max(0, idx - 1), to = Math.min(segs.length, idx + 2);
  return { para: segs.slice(from, to).join(''), exact: idx >= 0 };
}

async function detailHTML(work, R) {
  const isCtx = work.mode === 'ctx';
  const isPara = work.mode === 'para';
  const modeLabel = isCtx ? '节选（版权引述）' : isPara ? '选段' : '全文';
  let body = work.t;
  let tail = '';
  if (isPara) {
    const loc = locatePara(work.t, '');
    if (loc) { body = loc.para; }
  }
  // 同篇拆句：直接按 g 取记录（gid 内嵌，零索引依赖）
  const gids = (work.g || []).slice(0, 30);
  let piecesHTML = '<p class="w-no-piece">本篇暂无已收录拆句。</p>';
  try {
    await initRecords(R);
    const recs = await getCards(gids);
    if (recs.length) {
      piecesHTML = recs.map(r => {
        const q = encodeURIComponent((r.t || '').slice(0, 12));
        return `<a class="w-piece" href="${R}search/?q=${q}"><span class="w-piece-t">${esc(r.t)}</span><span class="w-piece-s">${esc(r.a || '佚名')}${r.w ? `《${esc(r.w)}》` : ''}</span></a>`;
      }).join('');
    }
  } catch (e) { console.error('[works] 同篇拆句加载失败', e); }

  // 作者档案卡（阶段 D）
  let authorCard = '';
  if (work.a && work.a !== '佚名') {
    try {
      const meta = await loadMeta();
      const info = (meta.authorInfo || {})[work.a];
      const slug = (meta.aslug || {})[work.a];
      const href = slug ? `${R}authors/?id=${slug}` : `${R}search/?q=${encodeURIComponent(work.a)}`;
      if (info) {
        const bits = [info.years, info.zi, info.home].filter(Boolean).join(' · ');
        authorCard = `<section class="wd-author">
          <h3 class="w-group-h">作者<em>${esc(work.a)}</em></h3>
          <div class="wd-author-body">
            ${bits ? `<p class="wd-author-info">${esc(bits)}</p>` : ''}
            ${info.desc ? `<p class="wd-author-desc">${esc(info.desc)}</p>` : ''}
            <p class="wd-author-more"><a href="${href}">查看 ${esc(work.a)} 的全部词句 →</a></p>
          </div>
        </section>`;
      } else {
        authorCard = `<section class="wd-author">
          <h3 class="w-group-h">作者<em>${esc(work.a)}</em></h3>
          <div class="wd-author-body"><p class="wd-author-more"><a href="${href}">查看 ${esc(work.a)} 的全部词句 →</a></p></div>
        </section>`;
      }
    } catch (e) { /* 作者卡失败不致命 */ }
  }

  const srcLine = [work.a ? esc(work.a) : '', work.n ? `《${esc(work.n)}》` : ''].filter(Boolean).join(' ')
    + (work.d ? `（${esc(work.d)}）` : '');
  const srcNote = work.src ? ` · ${esc(work.src)}` : '';
  return `<section class="page-hero wd-hero"><div class="wrap">
    <nav class="crumb"><a href="${R}">首页</a> › <a href="${R}works/">原文库</a> › <span>${esc(work.n)}</span></nav>
    <h1>${esc(work.n)}</h1>
    <p class="wd-meta">${srcLine}<span class="w-mode-badge">${esc(modeLabel)}</span></p>
  </div></section>
  <div class="wrap">
    <section class="wd-body">
      <div class="q-work-text">${esc(body)}${tail ? `<i class="q-work-tail">${esc(tail)}</i>` : ''}</div>
      <div class="q-work-src"><span class="wd-src-txt">${srcLine}${srcNote}${isCtx ? ' · 版权保护期内，仅摘引短句并标注出处' : ''}</span>
        <button type="button" class="wd-speak" data-work-speak aria-pressed="false" title="朗读全文">🔊 朗读全文</button>
      </div>
    </section>
    ${authorCard}
    <section class="wd-pieces">
      <h3 class="w-group-h">本篇已收录拆句<em>${gids.length} 句</em></h3>
      <div class="w-pieces">${piecesHTML}</div>
    </section>
    <p class="wd-back"><a href="${R}works/">← 返回原文库</a></p>
  </div>`;
}

// 卡片「查看原文」折叠（旧交互，保留兼容；新入口为超链接跳转详情页）
export function mountWorks(root = document) {
  root.addEventListener('click', async e => {
    const btn = e.target.closest('[data-work]');
    if (!btn) return;
    const card = btn.closest('.q');
    if (!card) return;
    e.preventDefault();
    const body = card.querySelector('.q-work-body');
    if (body) {
      body.remove();
      btn.classList.remove('on');
      btn.setAttribute('aria-expanded', 'false');
      const i = btn.querySelector('i');
      if (i) i.textContent = '▾';
      return;
    }
    const w = btn.getAttribute('data-work');
    const qText = (card.querySelector('.q-text') || {}).textContent || '';
    btn.disabled = true;
    btn.textContent = '加载中…';
    try {
      const work = await workOf(w);
      if (!work) {
        btn.textContent = '暂无原文';
        setTimeout(() => { btn.disabled = false; btn.textContent = '查看全文 ▾'; }, 1600);
        return;
      }
      const isCtx = work.mode === 'ctx';
      const isPara = work.mode === 'para';
      const label = isCtx ? '上下文' : (isPara ? '原文' : '全文');
      let displayText = work.t;
      let tail = '';
      if (isPara) {
        const loc = locatePara(work.t, qText);
        if (loc) { displayText = loc.para; tail = '（该句所在段落）'; }
        else { displayText = work.t.slice(0, 200) + (work.t.length > 200 ? '……' : ''); tail = '（此句为流传改写，原文见下）'; }
      }
      const srcLine = [work.a ? esc(work.a) : '', work.n ? `《${esc(work.n)}》` : ''].filter(Boolean).join(' ')
        + (work.d ? `（${esc(work.d)}）` : '');
      const srcNote = work.src ? ` · ${esc(work.src)}` : '';
      const bodyEl = document.createElement('div');
      bodyEl.className = 'q-work-body';
      bodyEl.innerHTML = `<div class="q-work-text">${esc(displayText)}${tail ? `<i class="q-work-tail">${esc(tail)}</i>` : ''}</div>`
        + `<div class="q-work-src">${srcLine}${srcNote}${isCtx ? ' · 节选' : ''}</div>`;
      card.appendChild(bodyEl);
      btn.classList.add('on');
      btn.setAttribute('aria-expanded', 'true');
      btn.textContent = '收起' + label + ' ▴';
      btn.disabled = false;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = '加载失败';
      console.error('[works]', err);
    }
  });
}
