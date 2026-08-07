const APP='ciju-app-0a36cd25';        // 缓存版本：随数据指纹自动变化，旧缓存自动失效（无需手改）
const SHELL=['./','./index.html','./assets/style.css','./assets/app.js','./assets/msgpack.min.js','./assets/manifest.webmanifest','./assets/icon.svg','./404.html','./scenes/','./moods/','./places/','./authors/','./search/','./about/'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(APP).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>true));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==APP).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  const cacheFirst=()=>caches.match(req).then(m=>m||fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(APP).then(c=>c.put(req,cp));}return r;}).catch(()=>caches.match('./index.html')));
  // 数据文件：stale-while-revalidate（先取缓存秒开，后台静默更新）
  if(url.pathname.indexOf('/data/')>=0){
    e.respondWith(caches.open(APP).then(async c=>{const cached=await c.match(req);const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone());return r;}).catch(()=>cached);return cached||net;}));
    return;
  }
  // 页面与静态资源：cache-first（构建期不可变，版本号已变即换新缓存）
  e.respondWith(cacheFirst());
});