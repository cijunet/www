// 附近的诗句：地理定位 → 按距离分级（就在此处 / 就在附近 / 这一带）→ 每地取若干句。
// 地理坐标来自 data/geo.json（构建期由 gazetteer 导出），词句按地理标注经倒排 #w/#d 分面取 gid，
// 全程走新分片运行时，不再依赖 pieces.msgpack。
import { initRecords, getCards, cardsForFilter } from './records.js';
import { renderCard, setMeta } from './card.js';
import { loadMeta } from './meta.js';
import { baseHref, esc as _esc } from './util.js';
import { fetchJSON } from './hashsearch.js';

const RINGS = [
  { max: 30, title: '就在此处', sub: '30 公里内' },
  { max: 120, title: '就在附近', sub: '120 公里内' },
  { max: 350, title: '这一带', sub: '350 公里内' }
];
const PER_SPOT = 24, MAX_SPOTS = 14, REGION_CAP = 36;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function fmtDist(km) {
  if (km < 1) return '不到 1 公里';
  if (km < 10) return '约 ' + km + ' 公里';
  return '约 ' + (km >= 100 ? Math.round(km / 10) * 10 : km) + ' 公里';
}

async function loadGeo(R) {
  try {
    return await fetchJSON(R, 'geo.json');
  } catch (e) {}
  return [];
}

export async function mountNearMe(root = document) {
  const box = root.querySelector('[data-nearme]');
  if (!box) return;
  const btn = box.querySelector('[data-geo-btn]');
  const out = box.querySelector('[data-geo-out]');
  if (!btn || !out) return;

  const R = baseHref();
  await initRecords(R);
  setMeta(await loadMeta());
  const geo = await loadGeo(R);
  if (!geo.length) { renderError('地名数据没加载上，稍后刷新再试。', true); return; }

  const geoName = {}; geo.forEach(g => { geoName[g.i] = g.n; });
  const origLabel = btn.textContent;
  const resetBtn = () => { btn.disabled = false; btn.textContent = origLabel; };

  function renderError(msg, withCards) {
    out.innerHTML = '<div class="nm-err">' + msg + (withCards ? ' 也可以直接点下面的地点卡片挑选。' : '') + '</div>';
  }
  function render(nearest, rings, region, regionNames, total) {
    const head = '<div class="nm-spot"><span class="nm-pin">📍</span><div>'
      + '<b>离你最近的是「' + (nearest.city ? _esc(nearest.city) + '·' : '') + _esc(nearest.name) + '」</b>'
      + '<span class="nm-dist">' + fmtDist(nearest.d) + ' · 一共找到 ' + total + ' 句</span></div></div>';
    const body = rings.map(r => '<section class="nm-ring"><h3>' + r.conf.title + '<em>' + r.conf.sub + '</em></h3>'
      + r.spots.map(s => {
        const meta = (s.poi.city ? _esc(s.poi.city) + ' · ' : '') + fmtDist(s.poi.d) + ' · ' + s.list.length + ' 句';
        return '<div class="nm-spotgrp"><h4>' + _esc(s.poi.name) + '<em>' + meta + '</em></h4>'
          + '<div class="q-list">' + s.list.map(c => renderCard(c, { R })).join('') + '</div></div>';
      }).join('') + '</section>').join('');
    let b = body;
    if (region.length) {
      b += '<section class="nm-ring"><h3>这一方水土<em>'
        + (regionNames.length ? regionNames.map(_esc).join(' · ') : '同一片') + '</em></h3>'
        + '<div class="q-list">' + region.map(c => renderCard(c, { R })).join('') + '</div></section>';
    }
    if (!b) b = '<p class="nm-empty">这一带暂时没有收录相关的词句。可以直接点下面的地点卡片，或去「全部场景」里翻翻。</p>';
    else if (nearest.d > 350) b = '<p class="nm-empty">你离本站收录的古地名有点远，下面按由近及远排。</p>' + b;
    out.innerHTML = head + b
      + '<div class="nm-actions"><button type="button" data-geo-again>重新定位</button>'
      + '<button type="button" data-geo-clear>收起</button></div>';
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const again = out.querySelector('[data-geo-again]');
    if (again) again.addEventListener('click', locate);
    const clear = out.querySelector('[data-geo-clear]');
    if (clear) clear.addEventListener('click', () => { out.innerHTML = ''; });
  }

  async function run(lat, lng) {
    btn.disabled = true; btn.textContent = '定位中…';
    try {
      const pois = geo.map(g => ({
        id: g.i, name: g.n, city: g.c, region: g.r || [],
        d: haversine(lat, lng, g.y, g.x)
      })).sort((a, b) => a.d - b.d);

      const byGid = {};           // poiId -> [gid]
      const needGids = new Set();
      const fetchGids = async (pid) => {
        if (byGid[pid]) return byGid[pid];
        // geo = 题咏地(#w) ∪ 写到地(#d)，与旧版「gw/gd 命中即算」口径一致；
        // 注意不能写成 { g: pid }——那是「场景大类」分面，会取到完全无关的句子。
        const g = await cardsForFilter({ geo: pid });
        byGid[pid] = g;
        g.forEach(x => needGids.add(x));
        return g;
      };

      const used = {};
      let total = 0, spotCount = 0, lo = 0;
      const rings = [];
      for (const conf of RINGS) {
        const spots = [];
        for (const poi of pois) {
          if (poi.d < lo || poi.d >= conf.max || spotCount >= MAX_SPOTS) continue;
          const list = (await fetchGids(poi.id)).filter(g => !used[g]).slice(0, PER_SPOT);
          if (!list.length) continue;
          list.forEach(g => { used[g] = 1; });
          spots.push({ poi, list });
          total += list.length; spotCount++;
        }
        lo = conf.max;
        if (spots.length) rings.push({ conf, spots });
      }

      // 文化区兜底
      const regionIds = [];
      pois.slice(0, 6).forEach(p => (p.region || []).forEach(r => { if (regionIds.indexOf(r) < 0) regionIds.push(r); }));
      const regionNames = regionIds.map(id => geoName[id]).filter(Boolean);
      let region = [];
      if (regionIds.length) {
        const regPois = pois.filter(p => (p.region || []).some(r => regionIds.indexOf(r) >= 0));
        for (const poi of regPois) {
          const g = (await fetchGids(poi.id)).filter(x => !used[x]);
          g.forEach(x => { if (!used[x]) { used[x] = 1; region.push(x); } });
          if (region.length >= REGION_CAP) break;
        }
      }

      const all = [...needGids];
      const cards = await getCards(all);
      const byGidMap = new Map();
      cards.forEach(c => { if (c) byGidMap.set(c._gid, c); });
      const toCards = gids => gids.map(g => byGidMap.get(g)).filter(Boolean);
      rings.forEach(r => r.spots.forEach(s => { s.list = toCards(s.list); }));
      const regionCards = toCards(region);

      render(pois[0], rings, regionCards, regionNames, total + regionCards.length);
      resetBtn();
    } catch (e) {
      renderError('诗句数据加载失败，检查网络后重试。', true);
      resetBtn();
    }
  }

  function locate() {
    if (!('geolocation' in navigator)) { renderError('当前浏览器不支持定位。你也可以直接点下面的地点卡片挑选。', true); return; }
    btn.disabled = true; btn.textContent = '定位中…';
    out.innerHTML = '<div class="nm-err">正在获取你的位置……请在浏览器弹窗里允许定位。</div>';
    navigator.geolocation.getCurrentPosition(
      pos => run(pos.coords.latitude, pos.coords.longitude),
      err => {
        resetBtn();
        let msg = '没能获取到你的位置。';
        if (err && err.code === err.PERMISSION_DENIED) msg = '你拒绝了定位授权，没法按地点找。';
        else if (err && err.code === err.TIMEOUT) msg = '定位超时了，换个开阔的地方再试。';
        else if (err && err.code === err.POSITION_UNAVAILABLE) msg = '当前定位信息不可用，检查手机定位是否开启。';
        renderError(msg, true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  btn.addEventListener('click', locate);
}
