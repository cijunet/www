// 搜索交互层（架构 3.6 / 3.7）：输入防抖 → Worker 求交 → 分块虚拟滚动渲染。
//
// 虚拟滚动采用「分块占位」模型：结果按 30 条切块，每块一个占位 div。
// 进入视口附近才向 Worker 要这一块的记录并渲染；离开视口则量下真实高度、清空内容、
// 用 min-height 撑住 —— DOM 里始终只有可视区附近的几十张卡，滚动条却始终是真实长度。
// 卡片高度天然参差（有的带白话、有的带「怎么用」），所以不能用固定行高的那套算法。
import { on, query, fetchItems, shardOf, ensurePinyin } from './worker-client.js';
import { prioritize, yieldToUser } from './preload.js';
import * as router from './router.js';
import { mountSuggest, pushHistory, history, clearHistory } from './suggest.js';
import { esc } from './util.js';
import { lengthTier, tierLabel } from './card.js';
import { normalizeQuery, displayText } from './i18n.js';

const BLOCK = 30;         // 每块条数
const EST_H = 172;        // 单卡估高（未测量时先用它撑住滚动条）
const DEBOUNCE = 180;

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let R = '';                       // 站点根相对路径
let NAMES = null;                 // 索引里带来的名称表
let sceneName = new Map(), moodName = new Map(), placeName = new Map(), authorSlug = new Map();

let GIDS = new Int32Array(0);
let blocks = [];
let listGen = 0;                  // 结果集换代号：渐进精确化会中途换一整批块
let io = null;
let curRid = -1;
let curTerms = [];
let lastState = {};

let elForm, elInput, elResults, elStatus, elEmpty, elFilters, elClear;
let elHistory, elHistList, elHistClear;

/* ── 历史搜索（页面内可见区块：搜索框下方、试试上方） ── */
function renderHistory() {
  if (!elHistory) return;
  const list = history();
  if (!list.length) { elHistory.hidden = true; elHistList.innerHTML = ''; return; }
  elHistList.innerHTML = list.map(q => `<button type="button" class="chip" data-hq="${esc(q)}">${esc(q)}</button>`).join('');
  elHistory.hidden = false;
}

/* ── 名称表 ── */
function setNames(nm) {
  NAMES = nm || {};
  sceneName = new Map((NAMES.scenes || []).map(s => [s.id, s.name]));
  moodName = new Map((NAMES.moods || []).map(m => [m.id, m.name]));
  placeName = new Map((NAMES.places || []).map(p => [p.id, p.name]));
  authorSlug = new Map((NAMES.authors || []).map(a => [a.name, a.slug]));
}

/* ── 命中高亮：在「原文」上匹配、逐段转义，避免把 &amp; 这类实体切坏 ── */
function hl(text, terms) {
  const src = String(text == null ? '' : text);
  if (!terms.length) return esc(src);
  let re;
  try { re = new RegExp('(' + terms.map(escRe).join('|') + ')', 'gi'); }
  catch { return esc(src); }
  let out = '', last = 0, m;
  while ((m = re.exec(src)) !== null) {
    if (m[0] === '') { re.lastIndex++; continue; }
    out += esc(src.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  return out + esc(src.slice(last));
}

/* ── 卡片：字段口径与构建期 templates.mjs 的 card() 保持一致 ── */
function cardHTML(rec, gid, terms) {
  const tier = lengthTier(rec.l || 0);
  const src = [rec.a, rec.w ? `《${rec.w}》` : ''].filter(Boolean).join(' ');
  const slug = authorSlug.get(rec.a);
  const scenes = (rec.s || []).map(id => sceneName.has(id)
    ? `<a href="${R}scenes/?id=${id}">${esc(sceneName.get(id))}</a>` : '').join('');
  const copyPlain = esc(rec.t);
  const copyFull = esc(rec.t + (src ? ' —— ' + src : ''));
  return `<article class="q" data-gid="${gid}" data-tier="${tier}">
  <blockquote class="q-text">${hl(rec.t, terms)}</blockquote>
  ${rec.o ? `<p class="q-o">${hl(rec.o, terms)}</p>` : ''}
  ${rec.x ? `<p class="q-x">${hl(rec.x, terms)}</p>` : ''}
  <div class="q-meta">
    ${slug ? `<a class="q-src" href="${R}authors/?id=${slug}">${esc(src || rec.a || '佚名')}</a>`
      : `<span class="q-src">${esc(src)}</span>`}
    ${rec.d ? `<span class="q-dyn">${esc(rec.d)}</span>` : ''}
    <span class="q-tier t-${tier}">${tierLabel[tier]}</span>
  </div>
  ${rec.n ? `<p class="q-note"><span>怎么用</span>${esc(rec.n)}</p>` : ''}
  ${scenes ? `<div class="q-scenes">${scenes}</div>` : ''}
  ${rec.w ? `<a class="q-work" href="${R}works/?w=${encodeURIComponent(rec.w)}">查看原文 <i>↗</i></a>` : ''}
  <div class="q-act">
    <button class="btn-copy" data-copy="${copyPlain}">复制</button>
    <button class="btn-copy alt" data-copy="${copyFull}">带出处复制</button>
  </div>
</article>`;
}
function skeletonHTML(gid) {
  return `<article class="q q-skel" data-gid="${gid}" data-shard="${shardOf(gid)}" aria-busy="true">
  <div class="sk sk-l"></div><div class="sk sk-m"></div><div class="sk sk-s"></div></article>`;
}

/* ── 虚拟列表 ── */
function ensureObserver() {
  if (io) return io;
  io = new IntersectionObserver(entries => {
    for (const en of entries) {
      const b = Number(en.target.dataset.b);
      if (en.isIntersecting) renderBlock(b);
      else collapseBlock(b);
    }
  }, { root: null, rootMargin: '800px 0px', threshold: 0 });
  return io;
}

function clearList() {
  if (io) io.disconnect();
  io = null;
  blocks = [];
  elResults.innerHTML = '';
}

function renderList(gids) {
  GIDS = gids;
  listGen++;
  clearList();
  if (!gids.length) { elEmpty.hidden = false; return; }
  elEmpty.hidden = true;
  const ob = ensureObserver();
  const n = Math.ceil(gids.length / BLOCK);
  const frag = document.createDocumentFragment();
  for (let b = 0; b < n; b++) {
    const cnt = Math.min(BLOCK, gids.length - b * BLOCK);
    const el = document.createElement('div');
    el.className = 'vb';
    el.dataset.b = String(b);
    el.style.minHeight = (cnt * EST_H) + 'px';
    frag.appendChild(el);
    blocks.push({ el, cnt, h: cnt * EST_H, rendered: false, partial: false, seq: 0 });
  }
  elResults.appendChild(frag);
  blocks.forEach(blk => ob.observe(blk.el));
}

async function renderBlock(b) {
  const blk = blocks[b];
  if (!blk || (blk.rendered && !blk.partial)) return;
  const seq = ++blk.seq;
  const gen = listGen;
  blk.rendered = true;
  const from = b * BLOCK;
  const gids = Array.from(GIDS.subarray(from, from + blk.cnt));
  let res;
  try { res = await fetchItems(gids); } catch { blk.rendered = false; return; }
  // 取数期间结果集可能已整体换代（分片到货后重算），旧块此时已脱离文档，写进去等于白写
  if (gen !== listGen || blocks[b] !== blk || seq !== blk.seq) return;
  if (res.need && res.need.length) prioritize(res.need);
  blk.partial = !!(res.need && res.need.length);
  blk.el.innerHTML = res.items
    .map((it, i) => (it ? cardHTML(it.r, it.gid, curTerms) : skeletonHTML(gids[i])))
    .join('');
  blk.el.style.minHeight = '';
  blk.h = blk.el.offsetHeight || blk.h;
}

function collapseBlock(b) {
  const blk = blocks[b];
  if (!blk || !blk.rendered) return;
  blk.h = blk.el.offsetHeight || blk.h;
  blk.el.style.minHeight = blk.h + 'px';
  blk.el.innerHTML = '';
  blk.rendered = false;
  blk.seq++;
}

// 分片到货：把还带骨架的块补全（只重画那几块，不动滚动位置）
function refreshPartials() {
  blocks.forEach((blk, b) => {
    if (blk.rendered && blk.partial) { blk.partial = false; blk.rendered = false; renderBlock(b); }
  });
}

/* ── 状态条（aria-live 通报条数） ── */
function setStatus(m, st) {
  if (!elStatus) return;
  if (m === null) { elStatus.textContent = '正在准备搜索…'; return; }
  const bits = [];
  bits.push(`共 ${m.total} 句`);
  if (m.pending > 0) bits.push(`其中 ${m.pending} 条待校验（正在补数据）`);
  if (st && st.mode === 'fuzzy') bits.push('模糊/拼音');
  elStatus.textContent = bits.join(' · ');
}

/* ── 查询编排 ── */
function currentState() {
  const st = router.readState();
  st.q = elInput.value.trim();
  return st;
}

function runQuery(st, { push = false } = {}) {
  lastState = st;
  // 简体归一后再分词：高亮在「简体原文」上匹配，命中后整卡转繁体时 <mark> 内容会一并转回
  const q = normalizeQuery(st.q || '');
  curTerms = q
    ? (st.mode === 'exact' ? [q] : q.split(/[\s,，、]+/).filter(Boolean))
    : [];
  if (st.mode === 'fuzzy' && !/[\u4e00-\u9fa5]/.test(q)) curTerms = [];   // 拼音查中文，字面高亮无意义
  // 纯拼音（全拉丁字母）查询提前拉拼音索引：智能/模糊模式都能直接按拼音召回汉字
  if (q && !/[\u4e00-\u9fa5]/.test(q) && /^[a-z0-9\s]+$/i.test(q)) ensurePinyin();

  router.writeState(st, { replace: !push });
  paintChips(st);
  curRid = query({ q, mode: st.mode || 'auto', f: router.toFilter(st), sort: st.sort || '' });
}

function onRes(m) {
  if (m.rid !== curRid) return;
  if (m.needPinyin) ensurePinyin();
  setStatus(m, lastState);
  const same = GIDS.length === m.gids.length && (() => {
    for (let i = 0; i < GIDS.length; i++) if (GIDS[i] !== m.gids[i]) return false;
    return true;
  })();
  // 不做 window.scrollTo：结果集更新（打字防抖/分片精化）时页面保持原位，
  // 搜索框与输入内容不被跳到下面的结果遮住。
  if (!same) renderList(m.gids);
  else refreshPartials();
  if (!m.refresh && (lastState.q || '').length >= 2) { pushHistory(lastState.q); renderHistory(); }
}

/* ── 筛选条 ── */
function paintChips(st) {
  if (!elFilters) return;
  elFilters.querySelectorAll('[data-f]').forEach(btn => {
    const f = btn.dataset.f, v = btn.dataset.v || '';
    btn.classList.toggle('on', (st[f] || '') === v);
    btn.setAttribute('aria-pressed', (st[f] || '') === v ? 'true' : 'false');
  });
}

/* ── 挂载 ── */
export function mountSearch({ base }) {
  R = base;
  elForm = document.querySelector('[data-search-form]');
  if (!elForm) return false;
  elInput = document.querySelector('#q');
  elResults = document.querySelector('#results');
  elStatus = document.querySelector('[data-status]');
  elEmpty = document.querySelector('[data-search-empty]');
  elFilters = document.querySelector('[data-sfilters]');
  elClear = document.querySelector('[data-clear]');
  elHistory = document.querySelector('[data-history]');
  elHistList = document.querySelector('[data-history-list]');
  elHistClear = document.querySelector('[data-history-clear]');
  if (!elInput || !elResults) return false;

  const st0 = router.readState();
  if (st0.q) elInput.value = st0.q;
  setStatus(null);
  renderHistory();

  // 历史搜索：点词条直接再搜；清空按钮移除全部
  if (elHistList) {
    elHistList.addEventListener('click', e => {
      const b = e.target.closest('[data-hq]');
      if (!b) return;
      elInput.value = b.dataset.hq;
      runQuery({ q: b.dataset.hq }, { push: true });
      elInput.blur();
    });
  }
  if (elHistClear) {
    elHistClear.addEventListener('click', () => { clearHistory(); renderHistory(); });
  }

  // 索引就绪 → 名称表到手 → 跑第一次查询（URL 里带 q/筛选就直接出结果）
  on('ready', m => {
    if (m.what !== 'idx') return;
    setNames(m.names);
    runQuery(currentState());
  });
  on('res', onRes);
  on('shard', () => refreshPartials());
  on('err', m => { if (elStatus) elStatus.textContent = m.msg || '搜索出错，请刷新重试'; });

  let timer = null;
  elInput.addEventListener('input', () => {
    yieldToUser();                                  // 用户在打字，后台预载让路
    if (elClear) elClear.hidden = !elInput.value;
    clearTimeout(timer);
    timer = setTimeout(() => runQuery(currentState()), DEBOUNCE);
  });
  elForm.addEventListener('submit', e => {
    e.preventDefault();
    clearTimeout(timer);
    runQuery(currentState(), { push: true });
    elInput.blur();
  });
  if (elClear) {
    elClear.hidden = !elInput.value;
    elClear.addEventListener('click', () => {
      elInput.value = ''; elClear.hidden = true; elInput.focus();
      runQuery(currentState());
    });
  }

  if (elFilters) {
    elFilters.addEventListener('click', e => {
      const btn = e.target.closest('[data-f]');
      if (!btn) return;
      const st = currentState();
      st[btn.dataset.f] = btn.dataset.v || '';
      if (!st[btn.dataset.f]) delete st[btn.dataset.f];
      runQuery(st, { push: true });
    });
  }

  // 点到还没数据的骨架卡 → 把它所在分片插到队首
  elResults.addEventListener('click', e => {
    const sk = e.target.closest('.q-skel');
    if (sk) prioritize([Number(sk.dataset.shard)]);
  });

  const box = document.querySelector('[data-suggest]');
  if (box) {
    mountSuggest(elInput, box, {
      onPick(r) {
        const st = {};
        const sp = new URLSearchParams(r.q);
        for (const [k, v] of sp) st[k] = v;
        if (st.q) elInput.value = st.q; else elInput.value = '';
        if (!st.q && r.text) elInput.placeholder = displayText(r.text);
        runQuery({ ...st, q: st.q || '' }, { push: true });
      }
    });
  }

  router.bindShortcuts(elInput);
  router.subscribe(st => {                      // 前进/后退：完整还原
    elInput.value = st.q || '';
    runQuery(st);
  });
  return true;
}
