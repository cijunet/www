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
import { getManifest, getShard, getIndex, getPinyin, getSuggest } from './datacache.js';

// 首页后台预载：只下载主分片（今日板块取句 + 搜索记录共用同一份，datacache 去重只下一遍）。
// 渐进优先预载（顺序补齐，全程 fire-and-forget，不阻塞首屏 paint）：
//   P1 首屏数据(today.json + meta + geo) 已由挂载函数拉起 —— 体积小，首屏立即可见；
//   P2 主分片 ×6（首页随机/相关/今日卡片、全站浏览）—— 先下，保证首屏词句最快出现；
//   P3 搜索索引 + 拼音 + 建议(共 906KB) —— P2 完成后再下，后台补齐，用户随时搜索/筛选都即时。
// datacache 的 inflight 去重 + IDB 缓存保证：搜索页 ensureIndex 直接复用，绝不重复下载。
function prefetchAll() {
  (async () => {
    try {
      const m = await getManifest();
      // P2：主分片（首页卡片、全站浏览所需）—— 优先，首屏词句最快出现
      await Promise.all(m.shards.map((_, i) => getShard(i).catch(() => {})));
      // P3：搜索数据（搜索/筛选即时；落 IDB 缓存后搜索页无需再下）
      await Promise.all([
        getIndex().catch(() => {}),
        getPinyin().catch(() => {}),
        getSuggest().catch(() => {}),
      ]);
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
