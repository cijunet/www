// 后台预载调度（架构 3.5）：把全部分片在空闲时段悄悄补齐，让搜索从「候选」收敛到「精确」。
// 铁律：绝不跟用户抢带宽 —— 并发≤2、只在空闲回调里发起、用户一动手就暂停、省流量模式直接不跑。
import { pushShard, shardCount, isShardInWorker } from './worker-client.js';
import { pausePreload, resumePreload, isPaused } from './hashsearch.js';

const MAX_CONC = 2;
const RESUME_DELAY = 700;      // 用户停手多久后恢复后台预载

const ric = (typeof requestIdleCallback === 'function')
  ? requestIdleCallback
  : (cb => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 16 }), 120));

let queue = [];
let running = 0;
let started = false;
let stopped = false;
let resumeTimer = null;
const listeners = new Set();

function saveDataOn() {
  const c = navigator.connection;
  return !!(c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '')));
}

export function onProgress(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function report(extra) {
  const total = shardCount();
  let loaded = 0;
  for (let i = 0; i < total; i++) if (isShardInWorker(i)) loaded++;
  const p = { loaded, total, done: total > 0 && loaded >= total, ...extra };
  listeners.forEach(fn => { try { fn(p); } catch (e) { console.error(e); } });
  return p;
}

function pump() {
  if (stopped || isPaused()) return;
  while (running < MAX_CONC) {
    let i;
    do { i = queue.shift(); } while (i !== undefined && isShardInWorker(i));
    if (i === undefined) { if (running === 0) report({ idle: true }); return; }
    running++;
    pushShard(i, { timeout: 25000, retries: 2 })
      .catch(() => { /* 单片失败不影响整体：结果仍可用，只是该片内的句子暂不可精确校验 */ })
      .finally(() => {
        running--;
        report();
        if (!stopped) ric(() => pump());
      });
  }
}

// 断点续载：已在 Worker 里的分片直接跳过（回访命中 IndexedDB 时几乎瞬间跑完）
export function startPreload({ order } = {}) {
  if (started) return;
  started = true;
  const total = shardCount();
  queue = (order && order.length ? order : Array.from({ length: total }, (_, i) => i))
    .filter(i => !isShardInWorker(i));
  report({ start: true });
  if (saveDataOn()) { report({ skipped: 'saveData' }); return; }  // 省流量：只按需取，不预载
  ric(() => pump());
}

// 用户开始输入/导航 → 让路；停手一会儿再继续
export function yieldToUser() {
  pausePreload();
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    resumePreload();
    if (started && !stopped) ric(() => pump());
  }, RESUME_DELAY);
}

// 渲染窗口缺哪片就先要哪片：插队 + 立即发起（不受暂停闸门限制，这是用户当下就要看的东西）
export function prioritize(list) {
  if (!list || !list.length) return;
  const want = list.filter(i => !isShardInWorker(i));
  if (!want.length) return;
  queue = want.concat(queue.filter(i => !want.includes(i)));
  want.slice(0, MAX_CONC).forEach(i => {
    pushShard(i, { timeout: 20000, retries: 2 }).catch(() => {}).finally(() => report());
  });
}
