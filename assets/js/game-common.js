// assets/js/game-common.js — 游戏共享框架
// 古筝单音（WebAudio）+ 金粉/墨渍粒子 + 星级结算 + 段位系统 + 答题讲解（怎么用/白话）+ 错题本
import { esc, baseHref } from './util.js';
import { getShardRecords, getManifest } from './datacache.js';

let _ctx = null;
function actx() {
  if (!_ctx) { try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}
// 单音：古筝拨弦感（基频 + 快速衰减泛音）
function pluck(freq, t0, dur = 0.9, vol = 0.12) {
  const c = actx(); if (!c) return;
  const o1 = c.createOscillator(), o2 = c.createOscillator();
  const g = c.createGain();
  o1.type = 'sine'; o1.frequency.value = freq;
  o2.type = 'triangle'; o2.frequency.value = freq * 2.001;
  const o2g = c.createGain(); o2g.gain.value = 0.35;
  o1.connect(g); o2.connect(o2g); o2g.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o1.start(t0); o2.start(t0); o1.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
}
// ── 音效开关（本地持久化）────────────────────────────
let _muted = null;
export function isMuted() {
  if (_muted == null) { try { _muted = localStorage.getItem('ciju.games.mute') === '1'; } catch { _muted = false; } }
  return _muted;
}
export function toggleMute() {
  _muted = !isMuted();
  try { localStorage.setItem('ciju.games.mute', _muted ? '1' : '0'); } catch {}
  return _muted;
}

export const sfx = {
  right() { if (isMuted()) return; const c = actx(); if (!c) return; const t = c.currentTime; pluck(523.25, t, 0.6); pluck(659.25, t + 0.07, 0.6); pluck(783.99, t + 0.14, 0.8); },
  combo(n) { if (isMuted()) return; const c = actx(); if (!c) return; const t = c.currentTime; const base = 523.25 * Math.pow(1.06, Math.min(n, 8)); pluck(base, t, 0.7, 0.1); },
  wrong() { if (isMuted()) return; const c = actx(); if (!c) return; pluck(196, c.currentTime, 0.5, 0.14); },
  win() { if (isMuted()) return; const c = actx(); if (!c) return; const t = c.currentTime; [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(f, t + i * 0.11, 0.9, 0.11)); },
};

// 在元素位置撒金粉（正确）或墨渍（错误）
export function burst(el, kind = 'gold') {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const chars = kind === 'gold' ? ['✦', '·', '❋', '·', '✦'] : ['•', '·', '•'];
  const n = kind === 'gold' ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'g-burst ' + kind;
    s.textContent = chars[i % chars.length];
    s.style.left = cx + 'px';
    s.style.top = cy + 'px';
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 70;
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(ang) * dist - 30 + 'px');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

export const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 简易计分局 UI
export function scoreBar(root, { max }) {
  const el = document.createElement('div');
  el.className = 'g-score';
  el.innerHTML = `<span class="g-score-cur">0</span><span class="g-score-max">/ ${max}</span><span class="g-score-combo"></span>`;
  root.appendChild(el);
  return {
    el,
    set(cur, combo = 0) {
      el.querySelector('.g-score-cur').textContent = cur;
      const c = el.querySelector('.g-score-combo');
      c.textContent = combo > 1 ? `连击 ×${combo}` : '';
      c.style.opacity = combo > 1 ? 1 : 0;
    }
  };
}

// 玩法外壳（返回导航 + 题面 + 选项区 + 反馈区（讲解）+ 底部出处 + 音效开关）
// ignore-opencc：游戏题面/选项/讲解全程保持简体——玩法校验读的是 DOM 简体文本，繁体模式下不能转换。
export function wrap(root, title) {
  root.innerHTML = `<div class="g-play ignore-opencc">
    <p class="g-back"><a href="${baseHref()}games/"><span>‹</span> 返回游戏</a></p>
    <h2 class="g-play-title"><span>${title}</span><button type="button" class="g-mute" data-mute aria-label="音效开关" title="音效开关">${isMuted() ? '🔇' : '🔊'}</button></h2>
    <div class="g-stage"></div>
    <div class="g-opts"></div>
    <div class="g-feedback"></div>
    <p class="g-src"></p>
  </div>`;
  const play = root.querySelector('.g-play');
  const muteBtn = play.querySelector('[data-mute]');
  if (muteBtn) {
    muteBtn.onclick = () => { muteBtn.textContent = toggleMute() ? '🔇' : '🔊'; };
  }
  const t0 = Date.now();
  return {
    stage: root.querySelector('.g-stage'),
    opts: root.querySelector('.g-opts'),
    fb: root.querySelector('.g-feedback'),
    src: root.querySelector('.g-src'),
    play,
    // 本局用时（秒）：结算页展示
    elapsed: () => Math.round((Date.now() - t0) / 1000),
  };
}

// 用时格式化：45 秒 / 1 分 23 秒
export function fmtElapsed(secs) {
  return secs < 60 ? secs + ' 秒' : Math.floor(secs / 60) + ' 分 ' + (secs % 60) + ' 秒';
}

// 结算页「更多玩法」入口（回到栏目页挑别的玩法）
export function moreLink(R) {
  return `<a class="g-btn ghost sm" href="${R}games/">更多玩法 ›</a>`;
}

// ── 段位系统（本地持久化，跨玩法累计星星）────────────────
export const RANKS = [
  { name: '蒙童', sub: '初入诗境', min: 0 },
  { name: '秀才', sub: '略通文墨', min: 10 },
  { name: '举人', sub: '出口成章', min: 30 },
  { name: '贡士', sub: '腹有诗书', min: 60 },
  { name: '进士', sub: '博闻强识', min: 100 },
  { name: '翰林', sub: '才高八斗', min: 150 },
  { name: '状元', sub: '独占鳌头', min: 220 },
];
const RANK_KEY = 'ciju.games.rank';

export function getRankState() {
  try {
    const raw = JSON.parse(localStorage.getItem(RANK_KEY) || '{}');
    return {
      stars: Number(raw.stars) || 0,
      best: raw.best || {},           // 各玩法历史最佳星 { fill, scene, rebuild, feihua, daily }
      plays: Number(raw.plays) || 0,  // 累计完局次数
    };
  } catch { return { stars: 0, best: {}, plays: 0 }; }
}
function saveRank(s) { try { localStorage.setItem(RANK_KEY, JSON.stringify(s)); } catch {} }

export function rankOf(stars) {
  let r = RANKS[0];
  for (const x of RANKS) if (stars >= x.min) r = x;
  return r;
}
export function nextRank(stars) {
  for (const x of RANKS) if (stars < x.min) return x;
  return null;
}

// 结算一局：返回 {stars, rank, next, prog}；同玩法重复玩只取历史最佳计星（防刷）
export function settleGame(mode, stars) {
  const s = getRankState();
  const oldBest = s.best[mode] || 0;
  const gain = stars > oldBest ? stars : 0;   // 破纪录才加星
  s.best[mode] = Math.max(oldBest, stars);
  s.stars += gain;
  s.plays++;
  saveRank(s);
  const cur = rankOf(s.stars);
  const nx = nextRank(s.stars);
  return {
    stars, gain, total: s.stars, rank: cur, next: nx,
    prog: nx ? Math.min(1, (s.stars - cur.min) / Math.max(1, nx.min - cur.min)) : 1,
    broke: gain > 0,
  };
}

// 段位徽章 HTML（朱文印样式，可嵌栏目页/结算页）
// 兼容两种入参：settleGame 返回值（有 total）或 getRankState 返回值（只有 stars）
export function rankBadge(st, size = '') {
  const total = st.total || st.stars || 0;
  const cur = rankOf(total);
  return `<span class="g-rank${size ? ' g-rank-' + size : ''}" title="${cur.name}·${cur.sub}">${cur.name}</span>
    <span class="g-rank-stars">★ ${total}</span>`;
}

// 星级渲染：★★☆
export function starHTML(n) {
  return '<span class="g-stars" aria-label="' + n + ' 星">' + '★'.repeat(Math.max(1, Math.min(3, n))) + '<i>' + '★'.repeat(Math.max(0, 3 - n)) + '</i></span>';
}

// ── 答题讲解（怎么用/白话/出处，按 gid 从主分片取记录）─────
// 按 gid 取记录：分片 → 解压 → 解码，全部走 datacache 共享链路（getShardRecords 有整片解码缓存）。
// 记录级缓存最近 64 条，避免重复取。
const _recCache = new Map();
export async function recordFor(gid) {
  if (gid == null) return null;
  if (_recCache.has(gid)) return _recCache.get(gid);
  try {
    const m = await getManifest();
    const shardSize = m.shardSize || 1900;
    const si = Math.floor(gid / shardSize);
    const pieces = await getShardRecords(si);
    const rec = pieces[gid % shardSize] || null;
    if (rec) { rec._gid = gid; if (_recCache.size > 64) _recCache.clear(); _recCache.set(gid, rec); }
    return rec;
  } catch (e) { console.error('[game] 记录取数失败', gid, e); return null; }
}

// 讲解框 HTML：怎么用 + 白话 + 出处 + 查看原文。rec 可为分片记录或 {t,a,w,d,n,x}
export function explainBox(rec, R, { wrong = false } = {}) {
  if (!rec) return '';
  const n = rec.n || '', x = rec.x || '';
  const parts = [];
  if (n) parts.push(`<span class="g-ex-kind">怎么用</span><p class="g-ex-n">${esc(n)}</p>`);
  if (x) parts.push(`<span class="g-ex-kind">白话</span><p class="g-ex-x">${esc(x)}</p>`);
  const srcLine = [rec.a, rec.w ? '《' + rec.w + '》' : '', rec.d].filter(Boolean).join(' · ');
  let links = '';
  if (R && rec.w) links += `<a class="g-wlink" href="${R}works/?w=${encodeURIComponent(rec.w)}">查看原文 ↗</a>`;
  if (R && rec.s && rec.s[0]) links += `<a class="g-wlink" href="${R}scenes/?id=${rec.s[0]}">这个场景 ↗</a>`;
  return `<div class="g-explain${wrong ? ' wrong' : ''}">${parts.join('')}${srcLine ? `<p class="g-ex-src">${esc(srcLine)}</p>` : ''}${links ? `<p class="g-ex-links">${links}</p>` : ''}</div>`;
}

// ── 错题本（本地持久化，上限 60）────────────────────────
const MIST_KEY = 'ciju.games.mistakes';
export function recordMistake(rec, mode) {
  if (!rec || !rec.t) return;
  try {
    let list = JSON.parse(localStorage.getItem(MIST_KEY) || '[]');
    if (!Array.isArray(list)) list = [];
    list.unshift({
      t: rec.t, a: rec.a || '', w: rec.w || '', n: rec.n || '', x: rec.x || '',
      s: (rec.s && rec.s[0]) || '',
      mode, when: Date.now()
    });
    // 去重（同正文只留最新）
    const seen = new Set();
    list = list.filter(m => { const k = m.t + '|' + m.w; if (seen.has(k)) return false; seen.add(k); return true; });
    list = list.slice(0, 60);
    localStorage.setItem(MIST_KEY, JSON.stringify(list));
  } catch {}
}
export function getMistakes() {
  try {
    const list = JSON.parse(localStorage.getItem(MIST_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
export function clearMistakes() { try { localStorage.removeItem(MIST_KEY); } catch {} }

// 难度爬坡排序：名篇（作品拆句频次 f 高）在前，冷门在后；同档内打乱
export function tierOrder(pool) {
  const copy = pool.slice();
  copy.sort((a, b) => (b.f || 0) - (a.f || 0) || Math.random() - 0.5);
  return copy;
}

// 确定性随机（mulberry32）：诗谜每日抽取 / 每日挑战出题共用（同 seed 结果一致）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 本局回顾（学习复盘）：结算页列全部题目 + 对错 + 出处 ──
export function reviewHTML(items) {
  if (!items || !items.length) return '';
  return `<div class="g-review"><h4>本局回顾 <span>（共 ${items.length} 题）</span></h4>
    ${items.map((it, i) => `<div class="g-rv-item${it.ok ? '' : ' miss'}">
      <i>${it.ok ? '✓' : '✗'}</i>
      <p class="g-rv-t">${esc(it.t)}${it.w ? `<span>— ${esc(it.a || '佚名')}《${esc(it.w)}》</span>` : ''}</p>
      ${it.n ? `<p class="g-rv-n">${esc(it.n)}</p>` : ''}
    </div>`).join('')}
  </div>`;
}
export function reviewButton(label = '回顾本局') {
  return `<button type="button" class="g-btn ghost" data-review>${label}</button>`;
}
