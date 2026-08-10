// 站点聚合引导：所有页面统一加载本模块，按 DOM 钩子挂载各项功能。
// 各模块自带守卫——搜索页(v2)的搜索框由 search-ui 接管(search-delegate 自动让位)，
// 无对应钩子的页面相关模块直接 no-op，互不干扰。
import { mountTheme } from './theme.js';
import { mountClipboard } from './clipboard.js';
import { mountTTS } from './tts.js';
import { mountNav, mountFilters } from './nav.js';
import { mountRandom } from './random.js';
import { mountToday } from './today.js';
import { mountNearMe } from './nearme.js';
import { mountRelated } from './related.js';
import { mountSearchDelegate, isV2 } from './search-delegate.js';
import { mountDetail } from './detail.js';
import { mountPerf } from './perf.js';
import { baseHref } from './util.js';
import { getManifest, getShard, getSuggest } from './datacache.js';
import { initSearch, pushShard, ensurePinyin } from './worker-client.js';

// 首页后台预载全量数据：今日板块从主分片取句（单一数据源，无独立重复包），
// 同时把索引/全部分片/拼音/建议喂给搜索 Worker，使搜索首屏即可用。
// 渲染不被阻塞——HTML 已即时可见，数据在后台渐进下载；datacache 去重保证每份只下一遍。
function prefetchAll() {
  const base = baseHref();
  (async () => {
    try {
      const m = await getManifest();
      // 先并行触发全量主分片下载（今日板块 + 搜索记录共用同一份，datacache 去重只下一遍）
      const shardP = m.shards.map((_, i) => getShard(i).catch(() => {}));
      // 同时启动搜索 Worker（下索引），与分片下载并行，不互相阻塞
      const initP = initSearch(base).catch(() => {});
      await Promise.all(shardP);
      await initP;
      // 把已下载的分片喂给 Worker（命中缓存不再请求网络）
      for (let i = 0; i < m.shards.length; i++) pushShard(i);
      ensurePinyin();
      getSuggest().catch(() => {});
    } catch (e) { console.error('[prefetch] 后台预载失败', e); }
  })();
}

function boot() {
  // 兼容量：旧 app.js 曾在这里写 window.__CIJU_V2，站内样式/第三方脚本可能读它
  window.__CIJU_V2 = isV2();
  // 纯 DOM 功能（同步、必成功）
  mountTheme();
  mountClipboard();
  mountTTS();
  mountNav();
  mountFilters();
  mountSearchDelegate();

  // 数据驱动功能（异步、可能失败，互不拖累）
  mountRandom().catch(e => console.error('[random]', e));
  mountToday().catch(e => console.error('[today]', e));
  mountNearMe().catch(e => console.error('[nearme]', e));
  mountRelated().catch(e => console.error('[related]', e));

  // 阶段 I：详情/关于/节气视图（查询字符串驱动，复用 records/card/meta）
  mountDetail();

  // 后台预载全量数据（今日取句 + 搜索就绪），不阻塞首屏渲染
  prefetchAll();

  // 性能观测（阶段 G3）：采集 LCP/INP/CLS，仅打点不阻塞
  mountPerf();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
