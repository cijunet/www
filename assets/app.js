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
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }

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
    var state = { tier: '', origin: '', mood: '' };
    var cards = $$('.q');
    var countEl = $('[data-count]');
    function apply() {
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!state.tier || c.dataset.tier === state.tier)
          && (!state.origin || c.dataset.origin === state.origin)
          && (!state.mood || (' ' + c.dataset.moods + ' ').indexOf(' ' + state.mood + ' ') > -1);
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
})();
