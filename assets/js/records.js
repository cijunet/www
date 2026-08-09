// 非搜索功能的数据门面：在搜索 Worker 之上，为「随机/相关/今日/附近/按筛选取卡」提供
// 与主线程渲染之间的唯一数据出口（架构 3.3：所有字节仍经 HashSearch → datacache → Worker）。
// 复用搜索页已建立的那个 Worker（initSearch 幂等），不会自建第二个。
import {
  initSearch, whenIndexReady, manifest, shardOf, pushShard, fetchItems, query, on
} from './worker-client.js';
import { loadMeta } from './meta.js';

let initP = null;

// 幂等且并发安全：缓存 Promise 本身，谁先调谁建，后来者复用同一次启动。
export function initRecords(base) {
  if (!initP) {
    initP = initSearch(base)
      .then(() => whenIndexReady())
      .catch(err => { initP = null; throw err; });
  }
  return initP;
}

// 取一批 gid 的完整记录。先确保对应分片已送进 Worker，再取；若有缺口补载后重试一次。
// 返回顺序与 Worker 的 items 顺序一致，每条记录挂上 _gid 供卡片烘焙 data-gid。
export async function getCards(gids) {
  gids = Array.from(new Set((gids || []).map(Number).filter(g => Number.isInteger(g) && g >= 0)));
  if (!gids.length) return [];
  const shards = [...new Set(gids.map(shardOf))];
  await Promise.all(shards.map(i => pushShard(i)));
  let res = await fetchItems(gids);
  // pushShard 在 postMessage 后即返回，而 Worker 内 loadShard（DecompressionStream）要晚几拍才解码完。
  // 若首次取到缺口（分片未就绪），补载并小步重试，直到补齐或到达上限，避免偶发空卡。
  let tries = 0;
  while (res.need && res.need.length && tries < 30) {
    await Promise.all(res.need.map(i => pushShard(i)));
    await new Promise(r => setTimeout(r, 20));
    res = await fetchItems(gids);
    tries++;
  }
  const out = [];
  for (const it of (res.items || [])) {
    if (!it || !it.r) continue;
    it.r._gid = it.gid;
    out.push(it.r);
  }
  return out;
}

export async function randomCards(n = 1) {
  const man = manifest();
  const total = man && man.total ? man.total : 0;
  if (!total) return [];
  const set = new Set();
  const k = Math.min(n, total);
  while (set.size < k) set.add(Math.floor(Math.random() * total));
  return getCards([...set]);
}

// 单次查询 → gid 数组。gids 是 Int32Array（可转移对象），统一转成普通数组，
// 否则调用方一 push/concat 就炸（定型数组没有 push）。
function queryPromise(f, q = '', sort = '') {
  return new Promise((resolve, reject) => {
    const rid = query({ q, f, sort, mode: q ? 'exact' : 'auto' });
    if (rid < 0) return reject(new Error('搜索服务未就绪'));
    const timer = setTimeout(() => { off(); reject(new Error('查询超时')); }, 20000);
    const off = on('res', m => {
      if (m.rid !== rid) return;
      clearTimeout(timer);
      off();
      resolve(Array.from(m.gids || []));
    });
  });
}

// 分面筛选：只取 gid 列表（走倒排 posting，不加载分片，快）。
// f = { s 场景 | m 心情 | pl 地点 | a 作者slug | g 场景大类 | gw 题咏地 | gd 写到地 | geo 地名(题咏∪写到) | c 来源 | tier 长度档 }
export async function cardsForFilter(f, { limit = 0, exclude = -1 } = {}) {
  let gids = await queryPromise(f, '');
  if (exclude >= 0) gids = gids.filter(g => g !== exclude);
  if (limit > 0) gids = gids.slice(0, limit);
  return gids;
}

// 纯关键词查询（走倒排，不加载分片），返回 gid 列表。供今日「历史事件→配句」等用。
export async function gidsForQuery(q, { limit = 0 } = {}) {
  if (!q || !String(q).trim()) return [];
  let gids = await queryPromise(null, String(q).trim());
  if (limit > 0) gids = gids.slice(0, limit);
  return gids;
}

// 相关推荐：先读源记录拿作者/场景/心情，再按「同作者 → 同场景 → 同心情」依次补足。
// 注意：分面 #a 存的是作者 slug，而记录里的 a 是作者名，需经 meta.aslug 反查。
export async function relatedCards(gid, n = 8) {
  const [r] = await getCards([gid]);
  if (!r) return [];
  const meta = await loadMeta();
  const slug = r.a && meta.aslug ? meta.aslug[r.a] : '';

  const gids = [];
  const seen = new Set([gid]);
  const take = list => { for (const g of list) if (!seen.has(g)) { seen.add(g); gids.push(g); } };

  if (slug) take(await cardsForFilter({ a: slug }));
  if (gids.length < n && r.s && r.s.length) take(await cardsForFilter({ s: r.s[0] }));
  if (gids.length < n && r.m && r.m.length) take(await cardsForFilter({ m: r.m[0] }));

  return getCards(gids.slice(0, n));
}
