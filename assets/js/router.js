// 路由（架构 3.6）：URL 的 query 参数是唯一状态源 —— 可分享、可前进后退、刷新可还原。
// 参数刻意保持「人话」：origin=classic、tier=short，而不是内部编码；
// 送进 Worker 前再由 toFilter() 翻译成索引里的分面编码（#c0/#c1/#c2、字数档 0/1/2）。
const KEYS = ['q', 'mode', 's', 'm', 'pl', 'a', 'g', 'origin', 'tier', 'sort'];

const ORIGIN_CODE = { classic: 0, modern: 1, world: 2 };
const TIER_CODE = { short: 0, mid: 1, long: 2 };

export function readState(search) {
  const sp = new URLSearchParams(search === undefined ? location.search : search);
  const st = {};
  for (const k of KEYS) {
    const v = sp.get(k);
    if (v !== null && v !== '') st[k] = v;
  }
  return st;
}

export function toSearchString(st) {
  const sp = new URLSearchParams();
  for (const k of KEYS) if (st[k]) sp.set(k, st[k]);
  const s = sp.toString();
  return s ? '?' + s : location.pathname;
}

// 输入过程用 replaceState（不制造几十条历史），确定性动作（点联想/点筛选）用 pushState
export function writeState(st, { replace = true } = {}) {
  const url = location.pathname + (toSearchString(st).startsWith('?') ? toSearchString(st) : '');
  try {
    if (replace) history.replaceState({ st }, '', url);
    else history.pushState({ st }, '', url);
  } catch { /* file:// 下 history 受限，忽略 */ }
}

export function subscribe(fn) {
  const h = () => fn(readState());
  window.addEventListener('popstate', h);
  return () => window.removeEventListener('popstate', h);
}

// state → Worker 的筛选对象。空值一律不下发，避免 Worker 拿空 token 求交出 0 结果。
export function toFilter(st) {
  const f = {};
  if (st.s) f.s = st.s;
  if (st.m) f.m = st.m;
  if (st.pl) f.pl = st.pl;
  if (st.a) f.a = st.a;
  if (st.g) f.g = st.g;
  if (st.origin && ORIGIN_CODE[st.origin] !== undefined) f.c = ORIGIN_CODE[st.origin];
  if (st.tier && TIER_CODE[st.tier] !== undefined) f.tier = TIER_CODE[st.tier];
  return Object.keys(f).length ? f : null;
}

export function hasFilter(st) { return !!toFilter(st); }

// 「/」聚焦搜索框、Esc 退出（不打断正在输入的人：焦点已在输入框内时不拦截）
export function bindShortcuts(input) {
  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key === 'Escape' && e.target === input) {
      input.blur();
    }
  });
}
