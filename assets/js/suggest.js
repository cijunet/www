// 联想下拉（架构 3.7）：前缀联想（读 suggest.mpack，二分查前缀）+ 本地搜索历史。
// 词典是「按需」加载的：用户第一次把光标落进搜索框才去取，不占首屏关键路径。
import { getSuggest } from './datacache.js';
import { decompress, decodeMsgpack } from './codec.js';
import { esc } from './util.js';
import { normalizeQuery } from './i18n.js';

const HIST_KEY = 'ciju.hist';
const HIST_MAX = 8;
const TYPE_LABEL = { scene: '场景', mood: '心情', place: '地点', author: '作者' };

let LIST = null;      // [{t 词条, ty 类型, q 目标查询串}]，按 t 升序
let loading = null;

export async function ensureSuggest() {
  if (LIST) return LIST;
  if (loading) return loading;
  loading = (async () => {
    const { buf, ext } = await getSuggest();
    LIST = await decodeMsgpack(await decompress(buf, ext));
    return LIST;
  })();
  return loading;
}

// 有序表的下界二分：第一个 >= key 的位置
function lowerBound(arr, key) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t < key) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export function prefixSearch(qRaw, limit = 8) {
  if (!LIST) return [];
  const q = normalizeQuery((qRaw || '').trim());   // 繁体查询先归一成简体再前缀匹配（词典全简体）
  if (!q) return [];
  const keys = [q];
  const lower = q.toLowerCase();
  if (lower !== q) keys.push(lower);       // 拼音词条统一小写存储

  const out = [], seen = new Set();
  for (const key of keys) {
    for (let i = lowerBound(LIST, key); i < LIST.length; i++) {
      const it = LIST[i];
      if (!it.t.startsWith(key)) break;
      const k = it.ty + '|' + it.q;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/* ── 本地历史 ── */
export function history() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; }
}
export function pushHistory(q) {
  const s = (q || '').trim();
  if (!s || s.length > 40) return;
  const list = history().filter(x => x !== s);
  list.unshift(s);
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, HIST_MAX))); } catch {}
}
export function clearHistory() { try { localStorage.removeItem(HIST_KEY); } catch {} }

/* ── 下拉挂载 ── */
export function mountSuggest(input, box, { onPick } = {}) {
  let rows = [];
  let active = -1;
  let open = false;

  function close() {
    open = false; active = -1;
    box.hidden = true; box.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  }
  function paint() {
    if (!rows.length) return close();
    box.innerHTML = rows.map((r, i) => {
      const tag = r.kind === 'hist' ? '历史' : (TYPE_LABEL[r.ty] || '词条');
      return `<li role="option" id="sg-${i}" class="sg-i${i === active ? ' on' : ''}" data-i="${i}" aria-selected="${i === active}">
        <span class="sg-t">${esc(r.text)}</span><span class="sg-ty">${esc(tag)}</span></li>`;
    }).join('');
    box.hidden = false;
    open = true;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', active >= 0 ? 'sg-' + active : '');
  }
  function build(q) {
    const list = [];
    if (!q) {
      history().forEach(h => list.push({ kind: 'hist', text: h, q: 'q=' + encodeURIComponent(h) }));
    } else {
      prefixSearch(q, 8).forEach(it => list.push({ kind: 'sg', text: it.t, ty: it.ty, q: it.q }));
      history().filter(h => h.startsWith(q)).slice(0, 3)
        .forEach(h => list.push({ kind: 'hist', text: h, q: 'q=' + encodeURIComponent(h) }));
    }
    rows = list.slice(0, 10);
    active = -1;
    paint();
  }
  function pick(i) {
    const r = rows[i];
    if (!r) return;
    close();
    if (onPick) onPick(r);
  }

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  box.setAttribute('role', 'listbox');

  input.addEventListener('focus', () => { ensureSuggest().then(() => build(input.value.trim())).catch(() => {}); });
  input.addEventListener('input', () => { ensureSuggest().then(() => build(input.value.trim())).catch(() => {}); });
  input.addEventListener('keydown', e => {
    if (!open || !rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % rows.length; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + rows.length) % rows.length; paint(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { close(); }
  });
  box.addEventListener('mousedown', e => {       // mousedown 先于 blur，避免下拉被关掉后点空
    const li = e.target.closest('[data-i]');
    if (!li) return;
    e.preventDefault();
    pick(Number(li.dataset.i));
  });
  document.addEventListener('click', e => {
    if (e.target !== input && !box.contains(e.target)) close();
  });

  return { close, refresh: () => build(input.value.trim()) };
}
