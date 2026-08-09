// HashSearch：全站唯一请求出口（架构 3.3）。禁止在别处直接 fetch()。
// 必备能力：在途去重、超时取消(AbortController)、指数退避重试、失败抛错供 UI 降级（不白屏）。
const _inflight = new Map();  // url -> {p, ctrl}（在途去重 + 可取消）
let _paused = false;          // 预载暂停闸门（搜索/导航时让路，架构 3.5）

// 能力探测：是否支持 brotli 解压（决定默认压缩格式）
const _supportsBr = (() => {
  try { return typeof DecompressionStream !== 'undefined' && !!new DecompressionStream('brotli'); }
  catch { return false; }
})();
export function pickCompress() { return _supportsBr ? 'br' : 'gz'; }

export function pausePreload() { _paused = true; }
export function resumePreload() { _paused = false; }
export function isPaused() { return _paused; }

function _abortable(url, { timeout = 60000, retries = 3, signal, cache = 'default' } = {}) {
  const hit = _inflight.get(url);
  if (hit) return hit.p;                                  // 在途去重：同一 URL 并发只发一次
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);   // 超时取消
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  const p = (async () => {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await fetch(url, { signal: ctrl.signal, cache });
        if (!r.ok) throw new Error('HTTP ' + r.status + ' @ ' + url);
        const ab = await r.arrayBuffer();
        clearTimeout(timer);
        return ab;
      } catch (e) {
        lastErr = e;
        if (e.name === 'AbortError') { clearTimeout(timer); throw e; }  // 主动取消不重试
        if (attempt < retries) await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt))); // 退避重试
      }
    }
    clearTimeout(timer);
    throw lastErr;  // 全部失败 → 抛错，由调用方降级（回退已缓存 / 提示重试）
  })();
  const entry = { p, ctrl };
  _inflight.set(url, entry);
  p.catch(() => {}).finally(() => { if (_inflight.get(url) === entry) _inflight.delete(url); });
  return p;
}

// 拉取文本（manifest.json 不压缩，且必须 no-cache 以保证版本原子性，架构 2.4/6.2）
export async function fetchText(url) {
  const ab = await _abortable(url, { cache: 'no-cache' });
  return new TextDecoder().decode(new Uint8Array(ab));
}

// 拉取压缩数据字节。哈希命名 → 内容不可变，可放心让 HTTP 层长缓存（架构 6.2）
export async function fetchBytes(base, bareName, ext, opts) {
  const ab = await _abortable(base + 'data/' + bareName + '.' + ext, opts);
  return new Uint8Array(ab);
}
