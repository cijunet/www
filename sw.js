const APP='ciju-app-b597c0d1';        // 缓存版本：随数据指纹自动变化，旧缓存自动失效（无需手改）
const SHELL=['./','./index.html','./assets/style.css','./assets/msgpack.min.js','./assets/manifest.webmanifest','./assets/icon.svg','./404.html','./scenes/','./moods/','./places/','./authors/','./works/','./games/','./search/','./data/today.json.gz','./data/meta.json.gz','./data/geo.json.gz','./assets/js/bootstrap.js','./assets/js/card.js','./assets/js/clipboard.js','./assets/js/codec.js','./assets/js/datacache.js','./assets/js/db.js','./assets/js/detail.js','./assets/js/game-common.js','./assets/js/game-daily.js','./assets/js/game-feihua.js','./assets/js/game-fill.js','./assets/js/game-guess.js','./assets/js/game-lianju.js','./assets/js/game-rebuild.js','./assets/js/game-scene.js','./assets/js/games.js','./assets/js/hashsearch.js','./assets/js/i18n.js','./assets/js/meta.js','./assets/js/nav.js','./assets/js/nearme.js','./assets/js/perf.js','./assets/js/preload.js','./assets/js/random.js','./assets/js/records.js','./assets/js/related.js','./assets/js/router.js','./assets/js/search-delegate.js','./assets/js/search-ui.js','./assets/js/search-worker.js','./assets/js/site.js','./assets/js/suggest.js','./assets/js/theme.js','./assets/js/today.js','./assets/js/tts.js','./assets/js/util.js','./assets/js/worker-client.js','./assets/js/works.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(APP).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>true));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==APP).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  const indexPage=()=>caches.match('./index.html');
  // 导航请求（页面跳转 / 点桌面图标 / 刷新）统一走「页面」策略：cache-first，命中 404 或离线一律回退缓存的 index.html。
  // 覆盖历史坑：旧版 manifest 的 start_url 写成相对 "./" 被解析成 /assets/，点桌面图标会 404「这句还没收」；
  // 以及 iOS/部分平台会给 start_url 追加 ?source=pwa 参数。任何导航 404/失败都回退首页，图标点击永不白屏。
  if(req.mode==='navigate'){
    e.respondWith(caches.match(req).then(m=>m||fetch(req).then(r=>{
      if(r&&r.ok){const cp=r.clone();caches.open(APP).then(c=>c.put(req,cp));}
      return r&&r.ok?r:indexPage();
    }).catch(indexPage)));
    return;
  }
  const cacheFirst=()=>caches.match(req).then(m=>m||fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(APP).then(c=>c.put(req,cp));}return r;}).catch(indexPage));
  const networkFirst=()=>fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(APP).then(c=>c.put(req,cp));}return r;}).catch(()=>caches.match(req).then(m=>m||indexPage));
  // 业务数据：.mpack（索引/分片/词典）与 manifest（版本原子性）由 HashSearch 统管（内存 + IndexedDB），不进 SW 缓存（架构 5.3）
  // 小 JSON（today/history/meta/geo）：网络优先 + 落 SW 缓存（安装期已预缓存，二次访问秒开）
  if(url.pathname.indexOf('/data/')>=0){
    if(url.pathname.indexOf('.mpack')>=0||/manifest.json$/.test(url.pathname)){
      e.respondWith(fetch(req));
      return;
    }
    e.respondWith(networkFirst());
    return;
  }
  // 前端静态资源（ES 模块 / msgpack / css / 图标）：网络优先——改了代码立刻生效，旧缓存永不挡路；仅离线时回退缓存
  if(url.pathname.indexOf('/assets/')>=0){
    e.respondWith(networkFirst());
    return;
  }
  // 页面：cache-first（构建期不可变，版本号已变即换新缓存）
  e.respondWith(cacheFirst());
});