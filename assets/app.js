(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* toast */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* 全局错误可视化：把被静默吞掉的异常显示出来，方便真机排查 */
  (function globalErrorOverlay() {
    function showErr(msg) {
      var el = document.getElementById('ciju-err');
      if (!el) {
        el = document.createElement('div'); el.id = 'ciju-err';
        el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;max-height:42vh;overflow:auto;background:#2a0d0c;color:#ffd9d6;font:12px/1.5 ui-monospace,monospace;padding:10px 12px;border:1px solid #a8322d;border-radius:10px;white-space:pre-wrap;box-shadow:0 10px 30px rgba(0,0,0,.45)';
        document.body.appendChild(el);
      }
      el.textContent = '⚠️ ' + msg + '\n' + el.textContent;
      el.style.display = '';
      clearTimeout(showErr._t); showErr._t = setTimeout(function () { el.style.display = 'none'; el.textContent = ''; }, 15000);
    }
    window.addEventListener('error', function (e) { showErr((e.message || 'error') + (e.filename ? (' @ ' + e.filename.split('/').pop() + ':' + e.lineno) : '')); });
    window.addEventListener('unhandledrejection', function (e) { var r = e.reason; showErr('Promise: ' + (r && (r.message || r.stack) || r)); });
  })();

  /* 复制 */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); res(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy]');
    if (btn) {
      copyText(btn.getAttribute('data-copy')).then(function () {
        var old = btn.textContent;
        btn.textContent = '已复制'; btn.classList.add('done');
        toast('已复制，去粘贴吧');
        setTimeout(function () { btn.textContent = old; btn.classList.remove('done'); }, 1400);
      }).catch(function () { toast('复制失败，请手动选中'); });
      return;
    }
    var fav = e.target.closest('[data-fav]');
    if (fav) { toggleFav(fav); return; }
    var fill = e.target.closest('[data-fill]');
    if (fill) { var q = $('#q'); if (q) { q.value = fill.getAttribute('data-fill'); q.dispatchEvent(new Event('input')); q.focus(); } return; }
    var nt = e.target.closest('[data-nav-toggle]');
    if (nt) { $('.nav').classList.toggle('open'); return; }
    var rnd = e.target.closest('[data-random]');
    if (rnd) { showRandom(); return; }
  });

  /* 收藏 */
  var FAV_KEY = 'ciju.fav';
  function getFav() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } }
  function setFav(a) { try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch (e) {} }
  function toggleFav(btn) {
    var id = btn.getAttribute('data-fav'), list = getFav(), i = list.indexOf(id);
    if (i < 0) { list.push(id); btn.classList.add('on'); btn.textContent = '★'; toast('已收藏'); }
    else { list.splice(i, 1); btn.classList.remove('on'); btn.textContent = '☆'; }
    setFav(list);
  }
  (function paintFav() {
    var list = getFav(); if (!list.length) return;
    $$('[data-fav]').forEach(function (b) {
      if (list.indexOf(b.getAttribute('data-fav')) > -1) { b.classList.add('on'); b.textContent = '★'; }
    });
  })();

  /* 筛选 */
  (function filters() {
    var bar = $('[data-filters]'); if (!bar) return;
    var state = { tier: '', origin: '', mood: '', place: '' };
    var cards = $$('.q');
    var countEl = $('[data-count]');
    function apply() {
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!state.tier || c.dataset.tier === state.tier)
          && (!state.origin || c.dataset.origin === state.origin)
          && (!state.mood || (' ' + c.dataset.moods + ' ').indexOf(' ' + state.mood + ' ') > -1)
          && (!state.place || (' ' + (c.dataset.places || '') + ' ').indexOf(' ' + state.place + ' ') > -1);
        c.classList.toggle('hide', !ok);
        if (ok) n++;
      });
      if (countEl) countEl.textContent = n;
    }
    bar.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip'); if (!chip) return;
      var f = chip.getAttribute('data-f');
      state[f] = chip.getAttribute('data-v');
      $$('[data-f="' + f + '"]', bar).forEach(function (c) { c.classList.toggle('on', c === chip); });
      apply();
    });
    apply();
  })();

  /* 随机一句 */
  function showRandom() {
    var box = $('[data-random-box]'); if (!box) return;
    fetchIndex().then(function (data) {
      var p = data.pieces[Math.floor(Math.random() * data.pieces.length)];
      box.hidden = false;
      box.innerHTML = renderCard(p, baseHref());
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* 索引与搜索 */
  var _idx = null;
  function baseHref() {
    var l = document.querySelector('link[rel=stylesheet]').getAttribute('href');
    return l.replace(/assets\/style\.css$/, '');
  }
  function fetchIndex() {
    if (_idx) return _idx;
    var R = baseHref();
    // 优先加载 MessagePack（体积更小、解析更快）；失败时回退 JSON
    var mp = fetch(R + 'data/pieces.msgpack')
      .then(function (r) { if (!r.ok) throw new Error('no msgpack'); return r.arrayBuffer(); })
      .then(function (buf) {
        if (typeof msgpack === 'undefined') throw new Error('no decoder');
        return msgpack.decode(new Uint8Array(buf));
      });
    _idx = mp.catch(function () {
      return fetch(R + 'data/index.json').then(function (r) { return r.json(); });
    });
    return _idx;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function tierOf(l) { return l <= 12 ? 'short' : l <= 28 ? 'mid' : 'long'; }
  function tierName(t) { return { short: '极短', mid: '适中', long: '偏长' }[t]; }

  function renderCard(p, R) {
    var src = [p.a, p.w ? '《' + p.w + '》' : ''].filter(Boolean).join(' ');
    var t = tierOf(p.l);
    return '<article class="q" data-tier="' + t + '">'
      + '<blockquote class="q-text">' + esc(p.t) + '</blockquote>'
      + (p.fo ? '<p class="q-o">' + esc(p.fo) + '</p>' : '')
      + (p.x ? '<p class="q-x">' + esc(p.x) + '</p>' : '')
      + '<div class="q-meta"><span class="q-src">' + esc(src) + '</span>'
      + (p.d ? '<span class="q-dyn">' + esc(p.d) + '</span>' : '')
      + '<span class="q-tier t-' + t + '">' + tierName(t) + '</span></div>'
      + (p.n ? '<p class="q-note"><span>怎么用</span>' + esc(p.n) + '</p>' : '')
      + '<div class="q-act"><button class="btn-copy" data-copy="' + esc(p.t) + '">复制</button>'
      + '<button class="btn-copy alt" data-copy="' + esc(p.t + (src ? ' —— ' + src : '')) + '">带出处复制</button></div>'
      + '</article>';
  }

  (function search() {
    var input = $('#q'); if (!input) return;
    var results = $('#results'), emptyEl = $('[data-search-empty]');
    var params = new URLSearchParams(location.search);
    if (params.get('q')) input.value = params.get('q');

    function score(p, kw) {
      var s = 0;
      if (p.t.indexOf(kw) > -1) s += 10;
      if (p.a && p.a.indexOf(kw) > -1) s += 6;
      if (p.w && p.w.indexOf(kw) > -1) s += 5;
      if (p.k && p.k.indexOf(kw) > -1) s += 4;
      if (p.n && p.n.indexOf(kw) > -1) s += 2;
      return s;
    }
    function run() {
      var kw = input.value.trim();
      if (!kw) { results.innerHTML = ''; emptyEl.hidden = true; return; }
      fetchIndex().then(function (data) {
        var terms = kw.split(/\s+/).filter(Boolean);
        var hits = data.pieces.map(function (p) {
          var s = 0;
          terms.forEach(function (t) { s += score(p, t); });
          return { p: p, s: s };
        }).filter(function (h) { return h.s > 0; })
          .sort(function (a, b) { return b.s - a.s || a.p.l - b.p.l; })
          .slice(0, 120);
        emptyEl.hidden = hits.length > 0;
        results.innerHTML = hits.map(function (h) { return renderCard(h.p, baseHref()); }).join('');
        history.replaceState(null, '', '?q=' + encodeURIComponent(kw));
      });
    }
    var t;
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 180); });
    if (input.value) run();
  })();


    /* ── 安装到主屏提示（App 体验）── */
    var deferredPrompt = null;
    var installBar = document.createElement('div');
    installBar.className = 'install-bar';
    installBar.hidden = true;
    installBar.innerHTML = '<span class="ib-txt">把「词句」装到主屏，随时说一句找好句</span><button class="ib-btn" type="button">安装</button><button class="ib-x" type="button" aria-label="关闭">✕</button>';
    document.body.appendChild(installBar);
    function installDismissed() { try { return localStorage.getItem('ciju.install_dismissed') === '1'; } catch (e) { return false; } }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferredPrompt = e;
      if (!installDismissed()) setTimeout(function () { installBar.hidden = false; }, 2600);
    });
    installBar.querySelector('.ib-btn').addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; installBar.hidden = true; });
    });
    installBar.querySelector('.ib-x').addEventListener('click', function () {
      installBar.hidden = true;
      try { localStorage.setItem('ciju.install_dismissed', '1'); } catch (e) {}
    });

    /* ── Service Worker：App 离线/秒开 ── */
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        // 站点根：资源根(assets/)的上一级，绝对地址，子页面/子目录部署都成立
        var _sheet = document.querySelector('link[rel=stylesheet]').getAttribute('href');
        var _assetRoot = new URL(_sheet, location.href).href.replace(/style\.css$/, '');
        var _siteRoot = new URL('..', _assetRoot).href;
        navigator.serviceWorker.register(_siteRoot + 'sw.js').catch(function () {});
      });
    }

    /* ── 底部标签栏高亮当前页 ── */
    (function highlightTab() {
      var path = location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      var map = { '': 'home', 'scenes': 'scenes', 'moods': 'moods', 'places': 'places', 'authors': 'authors', 'all': 'all' };
      var key = map[path];
      if (!key) {
        if (path.indexOf('s/') === 0) key = 'scenes';
        else if (path.indexOf('m/') === 0) key = 'moods';
        else if (path.indexOf('p/') === 0) key = 'places';
        else if (path.indexOf('a/') === 0) key = 'authors';
      }
      if (key) {
        var el = document.querySelector('.tabbar .tb[data-tb="' + key + '"]');
        if (el) el.classList.add('active');
      }
    })();

    /* ── 附近的诗句：地理定位 → 就近分级匹配 ── */
    (function nearMe() {
      var box = document.querySelector('[data-nearme]'); if (!box) return;
      var btn = box.querySelector('[data-geo-btn]');
      var out = box.querySelector('[data-geo-out]');
      if (!btn || !out) return;

      function haversine(lat1, lng1, lat2, lng2) {
        var R = 6371, toRad = Math.PI / 180;
        var dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      }
      function fmtDist(km) {
        if (km < 1) return '不到 1 公里';
        if (km < 10) return '约 ' + km + ' 公里';
        return '约 ' + (km >= 100 ? Math.round(km / 10) * 10 : km) + ' 公里';
      }
      function renderError(msg, withCards) {
        out.innerHTML = '<div class="nm-err">' + msg + (withCards ? ' 也可以直接点下面的地点卡片挑选。' : '') + '</div>';
      }

      // 由近及远分三环，每一环里再按「具体哪个地名」分组，尽量把相关的都露出来
      var RINGS = [
        { max: 30, title: '就在此处', sub: '30 公里内' },
        { max: 120, title: '就在附近', sub: '120 公里内' },
        { max: 350, title: '这一带', sub: '350 公里内' }
      ];
      var PER_SPOT = 24, MAX_SPOTS = 14, REGION_CAP = 36;

      function resetBtn() { btn.disabled = false; btn.textContent = '获取我的位置'; }

      function run(lat, lng) {
        btn.disabled = true; btn.textContent = '定位中…';
        fetchIndex().then(function (data) {
          var geo = data.geo || [];
          if (!geo.length) { renderError('地名数据没加载上，稍后刷新再试。', true); resetBtn(); return; }

          // 所有地名按离你的距离排序
          var pois = geo.map(function (g) {
            return {
              id: g.i, name: g.n, city: g.c, region: g.r || [],
              d: haversine(lat, lng, g.y, g.x)
            };
          }).sort(function (a, b) { return a.d - b.d; });

          // 地名 → 词句。gw（题咏于此）排在 gd（写到此地）前面
          var byPlace = {};
          data.pieces.forEach(function (p) {
            (p.gw || []).forEach(function (id) { (byPlace[id] || (byPlace[id] = [])).push({ p: p, w: 1 }); });
            (p.gd || []).forEach(function (id) { (byPlace[id] || (byPlace[id] = [])).push({ p: p, w: 0 }); });
          });
          Object.keys(byPlace).forEach(function (id) {
            byPlace[id].sort(function (a, b) { return b.w - a.w; });
          });

          var used = {}, total = 0, spotCount = 0, lo = 0, rings = [];
          RINGS.forEach(function (conf) {
            var spots = [];
            pois.forEach(function (poi) {
              if (poi.d < lo || poi.d >= conf.max || spotCount >= MAX_SPOTS) return;
              var list = (byPlace[poi.id] || []).filter(function (e) { return !used[e.p.i]; });
              if (!list.length) return;
              list = list.slice(0, PER_SPOT);
              list.forEach(function (e) { used[e.p.i] = 1; });
              spots.push({ poi: poi, list: list, wn: list.filter(function (e) { return e.w; }).length });
              total += list.length; spotCount++;
            });
            lo = conf.max;
            if (spots.length) rings.push({ conf: conf, spots: spots });
          });

          // 兜底：这一方水土（文化区标签）
          var regionIds = [];
          pois.slice(0, 6).forEach(function (poi) {
            (poi.region || []).forEach(function (r) { if (regionIds.indexOf(r) < 0) regionIds.push(r); });
          });
          var pmap = {}; (data.places || []).forEach(function (pl) { pmap[pl.id] = pl.name; });
          var regionNames = regionIds.map(function (id) { return pmap[id]; }).filter(Boolean);
          // 地名 → 它所属的文化区。这样「写于柳州、永州、夜郎」的诗也能算进「他乡」，
          // 不必等 Excel 手工标注，岭南、闽海这些地方才不至于只剩两三句。
          var geoRegion = {};
          geo.forEach(function (g) { geoRegion[g.i] = g.r || []; });
          function inRegionByGeo(p) {
            var ids = (p.gw || []).concat(p.gd || []);
            for (var k = 0; k < ids.length; k++) {
              var rs = geoRegion[ids[k]] || [];
              for (var m = 0; m < rs.length; m++) if (regionIds.indexOf(rs[m]) > -1) return true;
            }
            return false;
          }
          var region = data.pieces.filter(function (p) {
            if (used[p.i]) return false;
            var tagged = (p.pl || []).some(function (id) { return regionIds.indexOf(id) > -1; });
            var named = regionNames.some(function (nm) { return (p.t || '').indexOf(nm) > -1; });
            return tagged || named || inRegionByGeo(p);
          }).slice(0, REGION_CAP);
          total += region.length;

          render(pois[0], rings, region, regionNames, total);
          resetBtn();
        }).catch(function () {
          renderError('诗句数据加载失败，检查网络后重试。', true);
          resetBtn();
        });
      }

      function render(nearest, rings, region, regionNames, total) {
        var R = baseHref();
        var head = '<div class="nm-spot"><span class="nm-pin">📍</span><div>' +
          '<b>离你最近的是「' + (nearest.city ? esc(nearest.city) + '·' : '') + esc(nearest.name) + '」</b>' +
          '<span class="nm-dist">' + fmtDist(nearest.d) + ' · 一共找到 ' + total + ' 句</span></div></div>';

        var body = rings.map(function (r) {
          return '<section class="nm-ring"><h3>' + r.conf.title + '<em>' + r.conf.sub + '</em></h3>' +
            r.spots.map(function (s) {
              var meta = (s.poi.city ? esc(s.poi.city) + ' · ' : '') + fmtDist(s.poi.d) +
                ' · ' + s.list.length + ' 句' + (s.wn ? '（' + s.wn + ' 首题于此地）' : '');
              return '<div class="nm-spotgrp"><h4>' + esc(s.poi.name) + '<em>' + meta + '</em></h4>' +
                '<div class="q-list">' +
                s.list.map(function (e) { return renderCard(e.p, R); }).join('') +
                '</div></div>';
            }).join('') + '</section>';
        }).join('');

        if (region.length) {
          body += '<section class="nm-ring"><h3>这一方水土<em>' +
            (regionNames.length ? regionNames.map(esc).join(' · ') : '同一片') + '</em></h3>' +
            '<div class="q-list">' + region.map(function (p) { return renderCard(p, R); }).join('') +
            '</div></section>';
        }

        if (!body) {
          body = '<p class="nm-empty">这一带暂时没有收录相关的词句。可以直接点下面的地点卡片，或去「全部词句」里翻翻。</p>';
        } else if (nearest.d > 350) {
          body = '<p class="nm-empty">你离本站收录的古地名有点远，下面按由近及远排。</p>' + body;
        }

        out.innerHTML = head + body +
          '<div class="nm-actions"><button type="button" data-geo-again>重新定位</button>' +
          '<button type="button" data-geo-clear>收起</button></div>';
        out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        bindActions();
      }
      function bindActions() {
        var again = out.querySelector('[data-geo-again]'); if (again) again.addEventListener('click', locate);
        var clear = out.querySelector('[data-geo-clear]'); if (clear) clear.addEventListener('click', function () { out.innerHTML = ''; });
      }

      function locate() {
        if (!('geolocation' in navigator)) { renderError('当前浏览器不支持定位。你也可以直接点下面的地点卡片挑选。', true); return; }
        btn.disabled = true; btn.textContent = '定位中…';
        out.innerHTML = '<div class="nm-err">正在获取你的位置……请在浏览器弹窗里允许定位。</div>';
        navigator.geolocation.getCurrentPosition(function (pos) {
          run(pos.coords.latitude, pos.coords.longitude);
        }, function (err) {
          btn.disabled = false; btn.textContent = '获取我的位置';
          var msg = '没能获取到你的位置。';
          if (err && err.code === err.PERMISSION_DENIED) msg = '你拒绝了定位授权，没法按地点找。';
          else if (err && err.code === err.TIMEOUT) msg = '定位超时了，换个开阔的地方再试。';
          else if (err && err.code === err.POSITION_UNAVAILABLE) msg = '当前定位信息不可用，检查手机定位是否开启。';
          renderError(msg, true);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
      }

      btn.addEventListener('click', locate);
    })();
})();
