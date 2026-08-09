// 壳启动（架构 3.1 / 3.5）：页面本身零数据可用，脚本起来后才去挂搜索能力。
// 顺序严格按「先能用、再变快、最后变全」：
//   骨架已在 HTML 里 → manifest（版本原子性）→ 核心索引（搜索即刻可用）→ 后台补分片（结果逐步精确）。
import { initSearch, on, shardCount } from './worker-client.js';
import { startPreload, onProgress } from './preload.js';
import { mountSearch } from './search-ui.js';
import { baseHref } from './util.js';

/* ── 顶部就绪进度条：只在真的还没载完时露脸，载完淡出 ── */
function mountProgressBar() {
  const bar = document.createElement('div');
  bar.className = 'dl-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', '词句数据加载进度');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  bar.innerHTML = '<i></i>';
  document.body.appendChild(bar);
  const fill = bar.querySelector('i');
  let hidden = false;
  return p => {
    if (!p.total) return;
    const pct = Math.round(p.loaded / p.total * 100);
    fill.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', String(pct));
    bar.dataset.text = `${p.loaded}/${p.total}`;
    if (p.done && !hidden) {
      hidden = true;
      bar.classList.add('done');
      setTimeout(() => bar.remove(), 900);
    }
  };
}

async function boot() {
  const base = baseHref();
  const paint = mountProgressBar();
  onProgress(paint);

  // 索引一到位就开搜；分片在后台慢慢补，结果会自己从「候选」收敛成「精确」
  on('ready', m => { if (m.what === 'idx') startPreload(); });

  try {
    await initSearch(base);
  } catch (e) {
    const st = document.querySelector('[data-status]');
    if (st) st.textContent = '搜索数据加载失败：' + (e && e.message || e) + '。请检查网络后刷新。';
    console.error(e);
    return;
  }

  // 页面隐藏时不必继续抢带宽（回来再续，已载分片不会重下）
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shardCount()) startPreload();
  });
}

if (document.querySelector('[data-search-form]')) {
  mountSearch({ base: baseHref() });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
