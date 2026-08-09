// 相关推荐「类似此刻」：给带 data-gid 的卡片各补 3 条同类词句。
// 取句优先级与旧版一致：同场景 → 同心情 → 同作者。
//
// 两条硬约束决定了这里的写法：
//  1) 批量化 —— 详情页一屏可能有 80+ 张卡，逐卡问 Worker 会产生数百次往返，
//     故「同类分面合并查一次 + 相关记录一次性取回」，往返数与卡片数无关。
//  2) 懒加载 —— 取整条记录要加载对应分片，一次性处理全页卡片等于把整库拖下来，
//     违背「首页/分类页零数据可用」。故只处理滚动进视口的卡片，用多少载多少。
import { initRecords, getCards, cardsForFilter } from './records.js';
import { esc } from './card.js';
import { loadMeta } from './meta.js';
import { baseHref } from './util.js';

const PER_CARD = 3;
const BATCH = 12;          // 每批最多处理的卡片数
const FALLBACK_N = 6;      // 无 IntersectionObserver 时只处理前几张

export async function mountRelated(root = document) {
  const scope = root.querySelector('[data-related]') || root;
  const all = Array.prototype.slice.call(scope.querySelectorAll('.q[data-gid]'));
  if (!all.length) return;

  const R = baseHref();
  let ready = null;                 // 延迟到「真的有卡进视口」再启动数据运行时
  const boot = () => (ready || (ready = (async () => {
    await initRecords(R);
    return loadMeta();
  })()));

  const pools = new Map();          // "s:aimei" → gid[]，跨批次复用
  const done = new WeakSet();

  async function process(cards) {
    cards = cards.filter(c => !done.has(c) && !c.querySelector('.q-rel'));
    if (!cards.length) return;
    cards.forEach(c => done.add(c));

    const meta = await boot();
    const gidOf = new Map();
    for (const c of cards) {
      const g = parseInt(c.getAttribute('data-gid'), 10);
      if (Number.isInteger(g) && g >= 0) gidOf.set(c, g);
    }
    if (!gidOf.size) return;

    // ① 一次取回这批卡片的记录
    const selfRecs = await getCards([...gidOf.values()]);
    const recOf = new Map(selfRecs.map(r => [r._gid, r]));

    // ② 合并同类分面，每种只查一次（已查过的走缓存）
    const want = new Set();
    const slugOf = r => (r.a && meta.aslug ? meta.aslug[r.a] : '');
    for (const r of selfRecs) {
      (r.s || []).forEach(id => want.add('s:' + id));
      (r.m || []).forEach(id => want.add('m:' + id));
      const sl = slugOf(r); if (sl) want.add('a:' + sl);
    }
    await Promise.all([...want].filter(k => !pools.has(k)).map(async key => {
      const kind = key.slice(0, 1), val = key.slice(2);
      const f = kind === 's' ? { s: val } : kind === 'm' ? { m: val } : { a: val };
      try { pools.set(key, await cardsForFilter(f)); } catch (e) { pools.set(key, []); }
    }));

    // ③ 为每张卡挑 3 条。用自身 gid 做旋转偏移，避免同场景的卡片推荐出一模一样的三句。
    const pick = (r) => {
      const out = [], seen = new Set([r._gid]);
      const drain = (list) => {
        if (!list || !list.length || out.length >= PER_CARD) return;
        const off = r._gid % list.length;
        for (let k = 0; k < list.length && out.length < PER_CARD; k++) {
          const g = list[(off + k) % list.length];
          if (!seen.has(g)) { seen.add(g); out.push(g); }
        }
      };
      (r.s || []).forEach(id => drain(pools.get('s:' + id)));
      (r.m || []).forEach(id => drain(pools.get('m:' + id)));
      const sl = slugOf(r); if (sl) drain(pools.get('a:' + sl));
      return out;
    };

    const plan = new Map(), need = new Set();
    for (const [card, gid] of gidOf) {
      const r = recOf.get(gid);
      if (!r) continue;
      const chosen = pick(r);
      if (!chosen.length) continue;
      plan.set(card, chosen);
      chosen.forEach(g => need.add(g));
    }
    if (!need.size) return;

    // ④ 一次取回全部被推荐的记录，再统一注入 DOM
    const relRecs = await getCards([...need]);
    const relOf = new Map(relRecs.map(r => [r._gid, r]));
    for (const [card, chosen] of plan) {
      const items = chosen.map(g => relOf.get(g)).filter(Boolean);
      if (!items.length || card.querySelector('.q-rel')) continue;
      card.insertAdjacentHTML('beforeend',
        '<div class="q-rel"><div class="q-rel-h">类似此刻</div>'
        + items.map(r => {
          const src = [r.a, r.w ? `《${r.w}》` : ''].filter(Boolean).join(' ');
          const q = encodeURIComponent((r.t || '').slice(0, 12));
          return `<a class="q-rel-item" href="${R}search/?q=${q}">`
            + `<span class="q-rel-t">${esc(r.t)}</span>`
            + `<span class="q-rel-s">${esc(src || '佚名')}</span></a>`;
        }).join('')
        + '</div>');
    }
  }

  if (typeof IntersectionObserver !== 'function') {
    return process(all.slice(0, FALLBACK_N)).catch(e => console.error('[related]', e));
  }

  let queue = [], timer = 0;
  const flush = () => {
    timer = 0;
    const batch = queue.splice(0, BATCH);
    if (batch.length) process(batch).catch(e => console.error('[related]', e));
    if (queue.length) timer = setTimeout(flush, 200);
  };
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      io.unobserve(en.target);
      queue.push(en.target);
    }
    if (queue.length && !timer) timer = setTimeout(flush, 120);
  }, { rootMargin: '200px 0px' });
  all.forEach(c => io.observe(c));
}
