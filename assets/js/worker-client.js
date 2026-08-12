// 搜索 Worker 的主线程客户端：负责「喂字节 + 收结果」，本身不解码不求交。
// 所有字节都先经 datacache（内存/IDB/校验和）→ HashSearch（唯一请求出口，架构 3.3）取得，
// 再 postMessage 送进 Worker，保证全站只有一个网络出口。
import {
  setDataBase, getManifest, getIndex, getPinyin, getShard
} from './datacache.js';
import { baseHref } from './util.js';

let W = null;
let BASE = '';
let MANIFEST = null;
let rid = 0, itemSeq = 0;

const itemWaiters = new Map();               // itemRid -> resolve
const shardInflight = new Map();             // shardIndex -> Promise
const inWorker = new Set();                  // 已送进 Worker 的分片号
const bus = { ready: new Set(), res: new Set(), err: new Set(), shard: new Set() };

export function on(type, fn) {
  (bus[type] || (bus[type] = new Set())).add(fn);
  return () => bus[type].delete(fn);
}
function emit(type, payload) {
  (bus[type] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
}

export function manifest() { return MANIFEST; }
export function shardCount() { return MANIFEST ? MANIFEST.shards.length : 0; }
export function shardSize() { return MANIFEST ? MANIFEST.shardSize : 1900; }
export function shardOf(gid) { return Math.floor(gid / shardSize()); }
export function isShardInWorker(i) { return inWorker.has(i); }
export function workerShardCount() { return inWorker.size; }

// 索引就绪门闩：Worker 处理 'idx' 是异步解压，若紧接着发查询会被判「索引尚未就绪」。
// ensureIndex() 内部 await 它；records.js 的 queryPromise 在每次查询前自动 ensureIndex()。
let idxReady = false, idxResolve = null;
const idxReadyP = new Promise(res => { idxResolve = res; });
export function whenIndexReady() { return idxReady ? Promise.resolve() : idxReadyP; }

function onMessage(e) {
  const m = e.data || {};
  if (m.t === 'items') {
    const w = itemWaiters.get(m.rid);
    if (w) { itemWaiters.delete(m.rid); w(m); }
    return;
  }
  if (m.t === 'res') emit('res', m);
  else if (m.t === 'ready') {
    if (m.what === 'idx' && !idxReady) { idxReady = true; idxResolve(); }
    emit('ready', m);
  }
  else if (m.t === 'err') emit('err', m);
}

// 启动：manifest → 核心索引 → Worker 就绪。分片不在这里载，交给 preload 后台慢慢补。
// 幂等：搜索页（bootstrap.js）与全站模块（site.js）都会调 —— 缓存的是「同一个 Promise」而不是
// 只判断 W 是否存在，否则并发第二个调用者会在 manifest 还没到手时就拿到 null 提前返回。
let INIT = null;
export function initSearch(baseUrl) {
  if (INIT) return INIT;
  INIT = (async () => {
    BASE = baseUrl;
    setDataBase(BASE);
    W = new Worker(BASE + 'assets/js/search-worker.js');
    W.onmessage = onMessage;
    W.onerror = () => emit('err', { msg: '搜索 Worker 启动失败' });

    MANIFEST = await getManifest();
    emit('ready', { what: 'manifest', manifest: MANIFEST });
    // 仅把 manifest 交给 Worker（提供 shardSize 用于 gid→分片映射）。
    // 核心索引(526KB)不再随首屏加载——由 ensureIndex() 在真正搜索时才拉取。
    W.postMessage({ t: 'manifest', m: MANIFEST });
    return MANIFEST;
  })().catch(err => { INIT = null; W = null; throw err; });
  return INIT;
}

// 加载核心搜索索引（仅搜索页需要）。幂等、可并发。首屏卡片渲染不依赖它。
let IDX_P = null;
export function ensureIndex() {
  if (IDX_P) return IDX_P;
  IDX_P = (async () => {
    if (!W) await initSearch(BASE || baseHref());
    const { buf, ext } = await getIndex();
    W.postMessage({ t: 'idx', buf, ext });
    await whenIndexReady();
    return true;
  })().catch(err => { IDX_P = null; throw err; });
  return IDX_P;
}

export function query(o) {
  if (!W) return -1;
  const id = ++rid;
  W.postMessage({
    t: 'q', rid: id,
    q: o.q || '', mode: o.mode || 'auto',
    f: o.f || null, sort: o.sort || ''
  });
  return id;
}

// 取整条记录用于渲染。返回 {items:[{gid,r}|null], need:[分片号]}
export function fetchItems(gids) {
  return new Promise((resolve, reject) => {
    if (!W) return reject(new Error('搜索服务未就绪'));
    const id = 'i' + (++itemSeq);
    itemWaiters.set(id, resolve);
    W.postMessage({ t: 'items', rid: id, gids });
    setTimeout(() => {
      if (itemWaiters.has(id)) { itemWaiters.delete(id); reject(new Error('取记录超时')); }
    }, 20000);
  });
}

// 载入某分片并送进 Worker。重复调用自动去重；Worker 收到后会自动重算上一次查询（渐进精确化）。
export function pushShard(i, opts) {
  if (inWorker.has(i)) return Promise.resolve(false);
  if (shardInflight.has(i)) return shardInflight.get(i);
  const p = getShard(i, opts)
    .then(({ buf, ext }) => {
      if (!W || inWorker.has(i)) return false;
      W.postMessage({ t: 'shard', i, buf, ext });
      inWorker.add(i);
      emit('shard', { i, loaded: inWorker.size, total: shardCount() });
      return true;
    })
    .finally(() => shardInflight.delete(i));
  shardInflight.set(i, p);
  return p;
}

let pyState = 0;   // 0 未请求 1 在途 2 已送达
export async function ensurePinyin() {
  if (pyState) return;
  pyState = 1;
  try {
    const { buf, ext } = await getPinyin();
    W.postMessage({ t: 'py', buf, ext });
    pyState = 2;
  } catch (e) {
    pyState = 0;
    emit('err', { msg: '拼音索引加载失败：' + (e && e.message || e) });
  }
}
