(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 页面加载位置固定：禁止浏览器恢复横向/纵向滚动位置（避免跳转后先偏右再回中的抖动） */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('pageshow', function () { window.scrollTo(0, 0); });

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
      var seen = Object.create(null);
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!state.tier || c.dataset.tier === state.tier)
          && (!state.origin || c.dataset.origin === state.origin)
          && (!state.mood || (' ' + c.dataset.moods + ' ').indexOf(' ' + state.mood + ' ') > -1)
          && (!state.place || (' ' + (c.dataset.places || '') + ' ').indexOf(' ' + state.place + ' ') > -1);
        c.classList.toggle('hide', !ok);
        // 同一条词句可能出现在多个场景分组里 → 计数按 pid 去重，避免「共 N 句」虚高
        if (ok) { var pid = c.dataset.pid; if (!seen[pid]) { seen[pid] = 1; n++; } }
      });
      // 筛选后若某场景分组被筛空，连标题一起隐藏
      $$('.q-group').forEach(function (g) {
        g.classList.toggle('hide', !g.querySelector('.q:not(.hide)'));
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

  /* 随机一句：优先从"今日主题"（节气/节日/时令）相关词句里出，每天跟着今天走 */
  function showRandom() {
    var box = $('[data-random-box]'); if (!box) return;
    Promise.all([fetchIndex(), fetchHistory().catch(function () { return null; })]).then(function (res) {
      var data = res[0], hist = res[1];
      var now = new Date();
      var theme = todayTheme(hist, now.getFullYear(), todayMMDD(now), now.getMonth() + 1);
      var pool = collectPieces(theme, data);
      var src = pool.length ? pool : data.pieces;
      var p = src[Math.floor(Math.random() * src.length)];
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
    }).then(function (data) {
      // 挂场景/地点名称映射，供「一句多用」标签展示
      var S = {}, P = {};
      (data.scenes || []).forEach(function (x) { S[x.id] = x.name; });
      (data.places || []).forEach(function (x) { P[x.id] = x.name; });
      window.__CJN = { S: S, P: P };
      return data;
    });
    return _idx;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function tierOf(l) { return l <= 12 ? 'short' : l <= 28 ? 'mid' : 'long'; }
  function tierName(t) { return { short: '极短', mid: '适中', long: '偏长' }[t]; }

  function renderCard(p, R) {
    var src = [p.a, p.w ? '《' + p.w + '》' : ''].filter(Boolean).join(' ');
    var t = tierOf(p.l);
    var CJN = window.__CJN, extra = [];
    if (CJN && p.s && p.s.length > 1) extra.push('适用场景：' + p.s.map(function (id) { return CJN.S[id] || id; }).join('、'));
    if (CJN && p.pl && p.pl.length > 1) extra.push('地点：' + p.pl.map(function (id) { return CJN.P[id] || id; }).join('、'));
    return '<article class="q" data-tier="' + t + '">'
      + '<blockquote class="q-text">' + esc(p.t) + '</blockquote>'
      + (p.fo ? '<p class="q-o">' + esc(p.fo) + '</p>' : '')
      + (p.x ? '<p class="q-x">' + esc(p.x) + '</p>' : '')
      + '<div class="q-meta"><span class="q-src">' + esc(src) + '</span>'
      + (p.d ? '<span class="q-dyn">' + esc(p.d) + '</span>' : '')
      + '<span class="q-tier t-' + t + '">' + tierName(t) + '</span></div>'
      + (p.n ? '<p class="q-note"><span>怎么用</span>' + esc(p.n) + '</p>' : '')
      + (extra.length ? '<p class="q-extra">' + extra.join(' · ') + '</p>' : '')
      + '<div class="q-act"><button class="btn-fav" data-fav="' + p.id + '" aria-label="收藏这句">☆</button>'
      + '<button class="btn-copy" data-copy="' + esc(p.t) + '" aria-label="复制这句">复制</button>'
      + '<button class="btn-copy alt" data-copy="' + esc(p.t + (src ? ' —— ' + src : '')) + '" aria-label="复制带出处">带出处复制</button></div>'
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
        var all = data.pieces.map(function (p) {
          var s = 0;
          terms.forEach(function (t) { s += score(p, t); });
          return { p: p, s: s };
        }).filter(function (h) { return h.s > 0; })
          .sort(function (a, b) { return b.s - a.s || a.p.l - b.p.l; });
        var total = all.length;
        var PAGE = 60;
        var shown = run._shown || 0;
        if (shown > all.length) shown = all.length;
        var hits = all.slice(0, Math.min(shown + PAGE, total));
        run._shown = Math.min(shown + PAGE, total);
        run._all = all;
        emptyEl.hidden = hits.length > 0;
        results.innerHTML = hits.map(function (h) { return renderCard(h.p, baseHref()); }).join('')
          + (hits.length < total ? '<p class="q-trunc">已显示 ' + hits.length + ' / 共 ' + total + ' 条，<button class="btn-loadmore" data-loadmore>加载更多</button></p>' : '');
        history.replaceState(null, '', '?q=' + encodeURIComponent(kw));
      }).catch(function () { toast('搜索失败：数据加载出错，请检查网络后重试'); });
    }
    // 加载更多：复用最近一次搜索结果，追加一页
    var t;
    input.addEventListener('input', function () { run._shown = 0; clearTimeout(t); t = setTimeout(run, 180); });
    if (input.value) run();
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-loadmore]');
      if (!b) return;
      e.preventDefault();
      if (run._all) run();
    });
    })();

    /* ── 今日 · 这一天在历史上 + 节日/节气 + 配几句词句 ── */
    var SEASON_SCENES = {
      spring: ['chuchun', 'chunhua', 'songchun', 'jiangnan'],
      summer: ['chengxia', 'tinghe', 'jiangnan', 'yutian'],
      autumn: ['qiuyi', 'yexing', 'rilo', 'guancha'],
      winter: ['chuxue', 'handong', 'mianhua']
    };
    var SEASON_KW = {
      spring: ['春', '花', '柳', '燕', '莺', '桃', '杏', '草', '绿', '风'],
      summer: ['夏', '暑', '荷', '蝉', '凉', '扇', '蛙', '雷', '骤雨', '荔枝', '瓜'],
      autumn: ['秋', '月', '霜', '枫', '菊', '雁', '桂', '梧', '黄叶', '愁'],
      winter: ['雪', '寒', '梅', '炉', '冬', '冰', '炭', '腊', '岁暮']
    };
    var SEASON_LABEL = { spring: '春日', summer: '夏日', autumn: '秋日', winter: '冬日' };
    var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

    function seasonByMonth(m) {
      return (m >= 3 && m <= 5) ? 'spring' : (m >= 6 && m <= 8) ? 'summer' : (m >= 9 && m <= 11) ? 'autumn' : 'winter';
    }

    var _hist = null;
    function fetchHistory() {
      if (_hist) return _hist;
      _hist = fetch(baseHref() + 'data/history.json').then(function (r) {
        if (!r.ok) throw new Error('no history');
        return r.json();
      });
      return _hist;
    }

    // 主题：先查当年日历（节日/节气，构建期已预推多年），再兜底时令
    function todayTheme(hist, y, mmdd, month) {
      var cal = (hist && hist.years) ? hist.years[y] : null;
      if (cal && cal[mmdd]) {
        var f = cal[mmdd];
        return { n: f.n, kind: f.kind || '节日', scenes: f.scenes || [], kw: f.kw || [], s: f.s };
      }
      if (hist && hist.terms && hist.terms[mmdd]) {
        var t = hist.terms[mmdd];
        return { n: t.n, kind: '节气', scenes: [], kw: [], s: t.s };
      }
      var s = seasonByMonth(month);
      return { n: SEASON_LABEL[s], kind: '时令', scenes: [], kw: [], s: s };
    }
    function collectPieces(theme, data) {
      var seen = {}, out = [];
      function add(p) { if (p && !seen[p.i]) { seen[p.i] = 1; out.push(p); } }
      (theme.scenes || []).forEach(function (sid) {
        data.pieces.forEach(function (p) { if (p.s.indexOf(sid) > -1) add(p); });
      });
      (theme.kw || []).forEach(function (kw) {
        data.pieces.forEach(function (p) { if (p.t.indexOf(kw) > -1) add(p); });
      });
      if (out.length < 4 && theme.s) {
        (SEASON_SCENES[theme.s] || []).forEach(function (sid) {
          data.pieces.forEach(function (p) { if (p.s.indexOf(sid) > -1) add(p); });
        });
      }
      if (!out.length) return out;
      var sk = (theme.s && SEASON_KW[theme.s]) || [];
      out.sort(function (a, b) {
        var sa = 0, sb = 0;
        (theme.scenes || []).forEach(function (sid) { if (a.s.indexOf(sid) > -1) sa += 100; if (b.s.indexOf(sid) > -1) sb += 100; });
        (theme.kw || []).forEach(function (kw) { if (a.t.indexOf(kw) > -1) sa += 60; if (b.t.indexOf(kw) > -1) sb += 60; });
        sk.forEach(function (kw) { if (a.t.indexOf(kw) > -1) sa += 25; if (b.t.indexOf(kw) > -1) sb += 25; });
        sa -= a.l * 0.1; sb -= b.l * 0.1;
        return sb - sa || a.l - b.l;
      });
      return out.slice(0, 8);
    }
    // 历史事件 → 词句：事件自带构建期算好的关键词。一次扫描同时得出总数与前 cap 条
    function hitPiece(p, kw) {
      return (p.t && p.t.indexOf(kw) > -1) || (p.k && p.k.indexOf(kw) > -1);
    }
    function eventResults(ev, data, cap) {
      if (!ev.kw || !ev.kw.length) return { count: 0, list: [] };
      var count = 0, picked = [];
      for (var j = 0; j < data.pieces.length; j++) {
        var p = data.pieces[j], hitN = 0;
        for (var i = 0; i < ev.kw.length; i++) if (hitPiece(p, ev.kw[i])) hitN++;
        if (!hitN) continue;
        count++;
        if (picked.length < cap) picked.push({ p: p, hit: hitN });
      }
      picked.sort(function (a, b) { return b.hit - a.hit || a.p.l - b.p.l; });
      return { count: count, list: picked.map(function (x) { return x.p; }) };
    }

    /* ── 提示词按日期排：今日节日/节气 + 时令处境 + 常驻常用 ── */
    var CHIP_CAL = [
      { f: '0101', t: '0105', ids: ['kuanian', 'yanhuo', 'jijie'] },          // 新年余温
      { f: '0106', t: '0228', ids: ['chuxue', 'handong', 'mianhua'] },        // 深冬
      { f: '0301', t: '0415', ids: ['chuchun', 'chunhua', 'jiangnan'] },      // 春来了
      { f: '0401', t: '0410', ids: ['qingming', 'daonian'] },                 // 清明前后
      { f: '0416', t: '0531', ids: ['songchun', 'xianju', 'xingzou'] },       // 暮春
      { f: '0520', t: '0715', ids: ['biye', 'songbie', 'tongchuang'] },       // 毕业季
      { f: '0615', t: '0810', ids: ['fangbang', 'dengding', 'luobang'] },     // 放榜季
      { f: '0601', t: '0831', ids: ['chengxia', 'tinghe', 'yutian', 'kanhai'] }, // 盛夏
      { f: '0815', t: '0920', ids: ['kaoyan', 'dushu', 'shaonian'] },         // 开学季
      { f: '0901', t: '1031', ids: ['qiuyi', 'yeshi', 'huaiwu'] },            // 秋
      { f: '1101', t: '1219', ids: ['handong', 'jijie', 'chuxue'] },          // 入冬
      { f: '1220', t: '1231', ids: ['kuanian', 'shousui', 'yanhuo'] }         // 年关
    ];
    var THEME_CHIPS = {
      '元旦': ['kuanian', 'yanhuo'], '春节': ['kuanian', 'yanhuo', 'shousui'], '除夕': ['shousui', 'kuanian'],
      '小年': ['kuanian'], '腊八': ['chihe'], '元宵节': ['yanhuo'], '龙抬头': ['chuchun'],
      '情人节': ['biaobai', 'relian'], '七夕': ['anlian', 'biaobai', 'relian'],
      '清明节': ['qingming', 'daonian'], '劳动节': ['jianchi'], '青年节': ['shaonian', 'chufa'],
      '儿童节': ['tongnian'], '母亲节': ['fumu', 'xiangnian'], '父亲节': ['fumu'],
      '世界读书日': ['dushu'], '教师节': ['dushu', 'zhiji'], '国庆节': ['lvxing', 'huaiwu'],
      '中秋节': ['zhongqiu', 'yexing', 'sixiang'], '重阳节': ['chongyang', 'dengding'], '中元节': ['zhongyuan', 'meng'],
      '平安夜': ['anjing'], '圣诞节': ['chuxue'], '跨年夜': ['kuanian', 'yanhuo'],
      '立春': ['chuchun'], '雨水': ['yutian'], '惊蛰': ['chuchun'], '春分': ['chunhua'], '谷雨': ['chunhua'],
      '立夏': ['chengxia'], '小满': ['chengxia'], '芒种': ['guyuan'], '夏至': ['chengxia', 'yexing'],
      '小暑': ['chengxia', 'tinghe'], '大暑': ['chengxia', 'tinghe', 'yutian'],
      '立秋': ['qiuyi', 'jijie'], '处暑': ['qiuyi'], '白露': ['qiuyi', 'yeshi'], '秋分': ['qiuyi'],
      '寒露': ['qiuyi'], '霜降': ['qiuyi', 'mianhua'],
      '立冬': ['handong'], '小雪': ['chuxue'], '大雪': ['chuxue', 'mianhua'], '冬至': ['handong', 'chihe']
    };
    function dateChipIds(data, theme, mmdd, cap) {
      var smap = {};
      (data.scenes || []).forEach(function (s) { smap[s.id] = s.name; });
      var picked = [];
      function push(id) { if (smap[id] && picked.indexOf(id) < 0 && picked.length < cap) picked.push(id); }
      if (theme && THEME_CHIPS[theme.n]) THEME_CHIPS[theme.n].forEach(push);
      CHIP_CAL.forEach(function (r) { if (r.f <= mmdd && mmdd <= r.t) r.ids.forEach(push); });
      ['jiaban', 'xiangnian', 'yigeren', 'shengri'].forEach(push);
      return { ids: picked, smap: smap };
    }
    function shortName(name) { return name.split(/[、·，]/)[0]; }
    function todayMMDD(now) { return ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2); }
    function paintHotChips(data, theme, mmdd) {
      var bar = $('.hero-hot'); if (!bar) return;
      var r = dateChipIds(data, theme, mmdd, 10);
      if (r.ids.length < 3) return; // 数据异常时保留服务端渲染的兜底提示词
      var R = baseHref();
      var todayBadge = (theme && theme.n) ? '<span class="hot-today" data-hot-today>今日·' + esc(shortName(theme.n)) + '</span>' : '';
      bar.innerHTML = todayBadge + r.ids.map(function (id) { return '<a href="' + R + 's/' + id + '/">' + esc(r.smap[id]) + '</a>'; }).join('')
        + '<button class="hot-random" type="button" data-random>随便来一句</button>';
      var q = $('.hero-search input[name="q"]');
      if (q) {
        var prefix = (theme && theme.n) ? '今日' + shortName(theme.n) + '，' : '';
        q.placeholder = prefix + '你现在是什么处境？' + r.ids.slice(0, 4).map(function (id) { return shortName(r.smap[id]); }).join('、') + '…';
      }
    }

    /* ── 搜索页：「试试」提示词与占位提示也按今天的日期换 ── */
    (function searchHints() {
      var hint = $('.s-hint'), q = $('#q');
      if (!hint && !q) return;
      Promise.all([fetchIndex(), fetchHistory().catch(function () { return null; })]).then(function (res) {
        var data = res[0], hist = res[1];
        var now = new Date();
        var mmdd = todayMMDD(now);
        var theme = todayTheme(hist, now.getFullYear(), mmdd, now.getMonth() + 1);
        var r = dateChipIds(data, theme, mmdd, 8);
        if (r.ids.length < 3) return;
        if (hint) {
          hint.innerHTML = '试试：' + r.ids.map(function (id) {
            return '<button class="chip" data-fill="' + esc(r.smap[id]) + '">' + esc(r.smap[id]) + '</button>';
          }).join('');
        }
        if (q) {
          q.placeholder = '比如：' + r.ids.slice(0, 4).map(function (id) { return shortName(r.smap[id]); }).join(' / ') + ' / 想家';
        }
      }).catch(function () {});
    })();

    (function today() {
      var box = $('[data-today]'); if (!box) return;
      Promise.all([fetchIndex(), fetchHistory().catch(function () { return null; })]).then(function (res) {
        var data = res[0], hist = res[1];
        var now = new Date();
        var y = now.getFullYear();
        var mmdd = ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
        var theme = todayTheme(hist, y, mmdd, now.getMonth() + 1);
        paintHotChips(data, theme, mmdd);
        var events = ((hist && hist.days) ? hist.days[mmdd] : null) || [];

        // 每个事件算出可配词句（总数 + 前 16 条），能配句的排前面
        var ranked = events.map(function (ev) {
          var r = eventResults(ev, data, 16);
          return { ev: ev, mc: r.count, list: r.list };
        }).sort(function (a, b) { return (b.mc > 0 ? 1 : 0) - (a.mc > 0 ? 1 : 0) || a.ev.y - b.ev.y; });
        var showEv = ranked.slice(0, 4);

        var themeP = collectPieces(theme, data);
        var seen = {}, all = [];
        themeP.forEach(function (p) { if (!seen[p.i]) { seen[p.i] = 1; all.push(p); } });
        showEv.forEach(function (e) { e.list.forEach(function (p) { if (!seen[p.i]) { seen[p.i] = 1; all.push(p); } }); });
        all = all.slice(0, 16);
        if (!all.length && !showEv.length) { box.hidden = true; return; }

        var R = baseHref();
        var head = '<div class="t-head"><h2>今日 <span class="t-date">' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · 星期' + WEEK[now.getDay()] + '</span></h2>'
          + '<span class="t-tag">' + theme.kind + '·' + esc(theme.n) + '</span></div>';
        // 今日节气文化条：三候 / 民俗 / 农谚 / 饮食（节气日显示）
        var jqHtml = '';
        if (theme && theme.kind === '节气' && window.__JQ_DATA) {
          var jq = window.__JQ_DATA.filter(function (x) { return x.name === theme.n; })[0];
          if (jq) {
            jqHtml = '<div class="t-jq"><div class="t-jq-head"><b>' + esc(jq.name) + '</b><span>' + esc(jq.date) + '</span></div>'
              + '<p><i>三候</i>' + esc(jq.time) + '</p>'
              + '<p><i>民俗</i>' + esc(jq.folk) + '</p>'
              + '<p><i>农谚</i>' + esc(jq.proverb) + '</p>'
              + '<p><i>饮食</i>' + esc(jq.food) + '</p></div>';
          }
        }
        var evHtml = '';
        if (showEv.length) {
          evHtml = '<div class="t-sub-title">历史上的今天</div><ul class="t-events">'
            + showEv.map(function (e, i) {
              var click = e.mc > 0;
              return '<li' + (click ? ' class="t-ev-link" role="button" tabindex="0"' : '') + ' data-ev="' + i + '">'
                + '<b>' + e.ev.y + '</b><span>' + esc(e.ev.t) + '</span>'
                + (click ? '<em>可配 ' + e.mc + ' 句 ▸</em>' : '') + '</li>';
            }).join('')
            + '</ul>';
        }
        var phHtml = '';
        if (all.length) {
          phHtml = '<div class="t-sub-title" data-today-label>此日此句</div><div class="q-list" data-today-list></div>'
            + '<div class="t-foot"><button type="button" data-today-next>换一批</button><span class="t-page" data-today-page></span>'
            + '<button type="button" class="t-back" data-today-back hidden>← 返回全部</button></div>';
        }
        box.innerHTML = head + jqHtml + evHtml + phHtml;
        box.hidden = false;
        if (!all.length) return;

        var PAGE = 4, cur = 0, mode = -1; // mode=-1 全部，>=0 选中事件下标
        var listEl = box.querySelector('[data-today-list]');
        var labelEl = box.querySelector('[data-today-label]');
        var nextBtn = box.querySelector('[data-today-next]');
        var backBtn = box.querySelector('[data-today-back]');
        var pageEl = box.querySelector('[data-today-page]');
        var evEls = $$('.t-events li', box);
        function activeList() { return mode < 0 ? all : (showEv[mode].list || []); }
        function paint() {
          var list = activeList();
          var pages = Math.max(1, Math.ceil(list.length / PAGE));
          if (cur >= pages) cur = 0;
          listEl.innerHTML = list.slice(cur * PAGE, cur * PAGE + PAGE).map(function (p) { return renderCard(p, R); }).join('');
          if (pageEl) pageEl.textContent = pages > 1 ? ((cur + 1) + ' / ' + pages) : '';
          if (nextBtn) nextBtn.hidden = pages <= 1;
        }
        function setMode(idx) {
          mode = idx; cur = 0;
          evEls.forEach(function (el, i) { el.classList.toggle('on', i === idx); });
          if (idx < 0) {
            labelEl.textContent = '此日此句';
            backBtn.hidden = true;
          } else {
            var e = showEv[idx];
            labelEl.textContent = '为「' + e.ev.y + '年·' + e.ev.t + '」配的句子';
            backBtn.hidden = false;
          }
          paint();
        }
        box.addEventListener('click', function (e) {
          var li = e.target.closest('[data-ev]');
          if (li && li.classList.contains('t-ev-link')) {
            var idx = Number(li.getAttribute('data-ev'));
            if (!showEv[idx] || !showEv[idx].list.length) return;
            setMode(mode === idx ? -1 : idx);
            if (mode >= 0) labelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
          }
          if (e.target.closest('[data-today-back]')) { setMode(-1); return; }
          if (e.target.closest('[data-today-next]')) {
            var pages = Math.max(1, Math.ceil(activeList().length / PAGE));
            cur = (cur + 1) % pages; paint();
          }
        });
        box.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          var li = e.target.closest ? e.target.closest('[data-ev]') : null;
          if (li && li.classList.contains('t-ev-link')) { e.preventDefault(); li.click(); }
        });
        setMode(-1);
      }).catch(function () { box.hidden = true; });
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
      var origLabel = btn.textContent;

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

      function resetBtn() { btn.disabled = false; btn.textContent = origLabel; }

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
          body = '<p class="nm-empty">这一带暂时没有收录相关的词句。可以直接点下面的地点卡片，或去「全部场景」里翻翻。</p>';
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
          btn.disabled = false; btn.textContent = origLabel;
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


/* ── 增强：分享卡片 · 暗色模式 · 反馈入口（追加，不影响既有逻辑） ── */
(function enhance() {
  var doc = document;

  /* 1. 分享卡片（canvas 生成可下载 PNG） */
  function shareImage(p) {
    var W = 900, H = 560;
    var c = doc.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#a8322d'); g.addColorStop(1, '#72201c');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '22px Georgia,serif'; x.textAlign = 'left';
    x.fillText('词句 · 此刻，说句好的', 58, 64);
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(58, 88); x.lineTo(W - 58, 88); x.stroke();
    x.fillStyle = '#fffdf8'; x.font = '44px "Noto Serif SC","Songti SC",serif';
    var maxW = W - 116, lines = [], cur = '';
    var txt = p.t || '';
    for (var i = 0; i < txt.length; i++) {
      cur += txt[i];
      if (x.measureText(cur).width > maxW) { lines.push(cur.slice(0, -1)); cur = txt[i]; }
    }
    if (cur) lines.push(cur);
    var y = 190;
    lines.forEach(function (ln) { x.fillText(ln, 58, y); y += 64; });
    var src = [p.a, p.w ? '《' + p.w + '》' : ''].filter(Boolean).join(' ');
    x.fillStyle = 'rgba(255,255,255,.88)'; x.font = '26px "Noto Serif SC",serif'; x.textAlign = 'right';
    x.fillText(src || '佚名', W - 58, H - 88);
    if (p.n) { x.fillStyle = 'rgba(255,255,255,.72)'; x.font = '20px sans-serif'; x.fillText(p.n, W - 58, H - 52); }
    return c;
  }
  doc.addEventListener('click', function (e) {
    var b = e.target.closest('[data-share]');
    if (!b) return;
    var id = b.getAttribute('data-share');
    fetchIndex().then(function (data) {
      var p = data.pieces.find(function (z) { return z.i === id; });
      if (!p) { toast('没找到这句'); return; }
      var c = shareImage(p);
      var a = doc.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = '词句-' + (p.a || '佚名') + '.png';
      doc.body.appendChild(a); a.click(); a.remove();
      toast('分享卡片已生成，已开始下载');
    });
  });
  function injectShare() {
    doc.querySelectorAll('.q-act').forEach(function (act) {
      if (act.querySelector('[data-share]')) return;
      var fav = act.querySelector('[data-fav]');
      var id = fav ? fav.getAttribute('data-fav') : '';
      if (!id) return;
      var b = doc.createElement('button');
      b.className = 'btn-copy share'; b.type = 'button'; b.setAttribute('data-share', id); b.textContent = '分享图';
      b.setAttribute('aria-label', '生成分享卡片');
      act.appendChild(b);
    });
  }
  setTimeout(injectShare, 300);
  if ('MutationObserver' in window) {
    var mo = new MutationObserver(function () { injectShare(); });
    if (doc.body) mo.observe(doc.body, { childList: true, subtree: true });
  }

  /* 2. 暗色模式（localStorage 优先，其次系统偏好） */
  var KEY = 'ciju.theme';
  function applyTheme(t) { doc.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light'); }
  var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) applyTheme(saved);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) applyTheme('dark');
  function themeIcon() { return doc.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '🌙'; }
  setTimeout(function () {
    var head = doc.querySelector('.head-inner');
    if (!head || doc.querySelector('[data-theme-toggle]')) return;
    var b = doc.createElement('button');
    b.className = 'theme-toggle'; b.type = 'button'; b.setAttribute('data-theme-toggle', '');
    b.setAttribute('aria-label', '切换明暗模式'); b.title = '切换明暗模式';
    b.textContent = themeIcon();
    head.appendChild(b);
  }, 200);
  doc.addEventListener('click', function (e) {
    var t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    var dark = doc.documentElement.getAttribute('data-theme') === 'dark';
    var next = dark ? 'light' : 'dark';
    applyTheme(next); t.textContent = themeIcon();
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();

/* ── U5 语音朗读 + U6 搜索增强 + U7 相关推荐（第二轮第 3 批） ── */
(function round2() {
  var doc = document;

  /* ========== U5 语音朗读（TTS，Web Speech API，零 CDN） ========== */
  var SYN = window.speechSynthesis;
  function miniToast(msg) {
    var el = doc.querySelector('.round2-toast');
    if (!el) { el = doc.createElement('div'); el.className = 'round2-toast'; doc.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(miniToast._t);
    miniToast._t = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }
  function speakText(txt, rate) {
    if (!SYN || !('SpeechSynthesisUtterance' in window)) { miniToast('当前浏览器不支持语音朗读'); return; }
    SYN.cancel();
    var u = new SpeechSynthesisUtterance(txt);
    u.lang = 'zh-CN';
    u.rate = rate || 0.9;
    // 优先中文音色
    var vs = SYN.getVoices();
    for (var i = 0; i < vs.length; i++) {
      if (/zh|cmn|Chinese/i.test(vs[i].lang + vs[i].name)) { u.voice = vs[i]; break; }
    }
    SYN.speak(u);
  }
  function injectSpeak() {
    doc.querySelectorAll('.q').forEach(function (card) {
      if (card.querySelector('[data-speak]')) return;
      var text = card.querySelector('.q-text');
      var plain = card.querySelector('.q-x');
      if (!text) return;
      var b = doc.createElement('button');
      b.className = 'btn-copy speak'; b.type = 'button'; b.setAttribute('data-speak', '');
      b.textContent = '朗读';
      b.title = '朗读这句';
      b.setAttribute('aria-label', '朗读这句');
      b.setAttribute('aria-pressed', 'false');
      var act = card.querySelector('.q-act');
      if (!act) return;
      var txt = text.textContent + (plain ? '。' + plain.textContent : '');
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (SYN && SYN.speaking) { SYN.cancel(); b.classList.remove('on'); b.textContent = '朗读'; b.setAttribute('aria-pressed', 'false'); }
        else { speakText(txt, 0.9); b.classList.add('on'); b.textContent = '停止'; b.setAttribute('aria-pressed', 'true'); }
      });
      function resetSpeak() { b.classList.remove('on'); b.textContent = '朗读'; b.setAttribute('aria-pressed', 'false'); }
      SYN && SYN.addEventListener('end', resetSpeak);
      SYN && SYN.addEventListener('error', resetSpeak);
      act.insertBefore(b, act.firstChild);
    });
  }
  setTimeout(injectSpeak, 300);
  if ('MutationObserver' in window) {
    new MutationObserver(injectSpeak).observe(doc.body, { childList: true, subtree: true });
  }

  /* ========== U6a 搜索命中高亮 ========== */
  /* 在搜索结果渲染后，给 .q-text/.q-src 中的命中词包 <mark> */
  function highlight(container, kw) {
    if (!kw || !container) return;
    var terms = kw.split(/\s+/).filter(Boolean);
    if (!terms.length) return;
    container.querySelectorAll('.q-text, .q-src, .q-x, .q-note').forEach(function (el) {
      if (el.querySelector('mark')) return;
      var html = el.innerHTML;
      terms.forEach(function (t) {
        if (!t) return;
        var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'g');
        html = html.replace(re, '<mark>$1</mark>');
      });
      el.innerHTML = html;
    });
  }
  var _lastKw = '';
  var _origRender = null;
  // 在搜索 run() 输出后调用：通过轮询结果容器文本变化触发（避免改 run 内部）
  var _hlTimer = null;
  function pollHighlight() {
    var input = doc.querySelector('#q');
    var results = doc.querySelector('#results');
    if (!input || !results) return;
    var kw = input.value.trim();
    if (kw && kw !== _lastKw) {
      _lastKw = kw;
      // 延迟到渲染完成后高亮
      clearTimeout(_hlTimer);
      _hlTimer = setTimeout(function () { highlight(results, kw); }, 120);
    }
  }
  if (doc.querySelector('#q')) {
    doc.querySelector('#q').addEventListener('input', pollHighlight);
    // 事件驱动替代轮询：结果容器变化时重新高亮（输入事件 + 容器变化双保险）
    var _hlResults = doc.querySelector('#results');
    if (_hlResults && 'MutationObserver' in window) {
      new MutationObserver(function () {
        var kw = (doc.querySelector('#q') || {}).value;
        if (kw) { clearTimeout(_hlTimer); _hlTimer = setTimeout(function () { highlight(_hlResults, kw); }, 100); }
      }).observe(_hlResults, { childList: true, subtree: true });
    }
  }

  /* ========== U6b 拼音首字母检索 ========== */
  /* 内置常用作者/关键词拼音首字母映射（离线、体积小）；输入如 "sls" 命中"苏轼" */
  var PY = {
    'sls': ['苏轼'], 'libai': ['李白'], 'lib': ['李白'], 'df': ['杜甫'], 'dfu': ['杜甫'], 'bjy': ['白居易'],
    'byj': ['白居易'], 'tjy': ['陶渊明'], 'wangwei': ['王维'], 'ww': ['王维'], 'liqingzhao': ['李清照'],
    'lqz': ['李清照'], 'xinqiji': ['辛弃疾'], 'xqj': ['辛弃疾'], 'luyou': ['陆游'], 'ly': ['陆游'],
    'yangwanli': ['杨万里'], 'ywl': ['杨万里'], 'dumu': ['杜牧'], 'dm': ['杜牧'], 'lishangyin': ['李商隐'],
    'lsy': ['李商隐'], 'liuyuxi': ['刘禹锡'], 'lyx': ['刘禹锡'], 'meng-haoran': ['孟浩然'], 'mhr': ['孟浩然'],
    'zhangjiuling': ['张九龄'], 'zjl': ['张九龄'], 'wanganshi': ['王安石'], 'was': ['王安石'],
    'ouyangxiu': ['欧阳修'], 'oyx': ['欧阳修'], 'liuyong': ['柳永'], 'qinguan': ['秦观'], 'zhoubangyan': ['周邦彦'],
    'nawlanxingde': ['纳兰性德'], 'na': ['纳兰性德'], 'zhuyuanzhang': ['毛泽东'], 'mzd': ['毛泽东'],
    'luyin': ['鲁迅'], 'taigeer': ['泰戈尔'], 'tge': ['泰戈尔'], 'jiyueqin': ['纪伯伦'],
    'nicai': ['尼采'], 'haizi': ['海子'], 'mu-xin': ['木心'], 'zhangailing': ['张爱玲'], 'zal': ['张爱玲'],
    'sanmao': ['三毛'], 'laoshe': ['老舍'], 'bingxin': ['冰心'], 'zhuziqing': ['朱自清'], 'zzq': ['朱自清'],
    'xiwan': ['席慕蓉'], 'gucheng': ['顾城'], 'beidao': ['北岛'], 'yuguangzhong': ['余光中'], 'ygz': ['余光中']
  };
  function pinyinExpand(kw) {
    var k = kw.toLowerCase().replace(/[^a-z]/g, '');
    if (!k || k.length < 2) return kw;
    var names = PY[k];
    if (!names) return kw;
    // 输出 "kw 苏东坡|苏轼" 形式的扩展提示：直接并入搜索词（OR 语义）
    return kw + ' ' + names.join(' ');
  }
  var _origInputVal = '';
  var _pyTimer = null;
  function pollPinyin() {
    var input = doc.querySelector('#q');
    if (!input) return;
    var v = input.value;
    if (/^[a-zA-Z]{2,6}$/.test(v.trim())) {
      var k = v.trim().toLowerCase();
      if (PY[k] && v !== _origInputVal) {
        _origInputVal = v;
        clearTimeout(_pyTimer);
        _pyTimer = setTimeout(function () {
          if (input.value === v) {
            input.value = pinyinExpand(v);
            input.dispatchEvent(new Event('input'));
          }
        }, 500);
      }
    } else _origInputVal = '';
  }
  if (doc.querySelector('#q')) {
    doc.querySelector('#q').addEventListener('input', pollPinyin);
  }

  /* ========== U7 相关推荐（同场景/同心情/同作者，纯前端标签网络） ========== */
  var _relIdx = null;
  function relIndex() {
    if (_relIdx) return _relIdx;
    _relIdx = fetchIndexCached();
    return _relIdx;
  }
  function fetchIndexCached() {
    // 独立加载（浏览器 HTTP 缓存兜底），结构同主模块
    if (fetchIndexCached._p) return fetchIndexCached._p;
    var R = doc.querySelector('link[rel=stylesheet]') ? doc.querySelector('link[rel=stylesheet]').getAttribute('href').replace(/assets\/style\.css$/, '') : './';
    var mp = fetch(R + 'data/pieces.msgpack')
      .then(function (r) { if (!r.ok) throw new Error('no msgpack'); return r.arrayBuffer(); })
      .then(function (buf) { return msgpack.decode(new Uint8Array(buf)); });
    fetchIndexCached._p = mp.catch(function () {
      return fetch(R + 'data/index.json').then(function (r) { return r.json(); });
    }).then(function (data) {
      if (!window.__CJN) {
        var S = {}, P = {};
        (data.scenes || []).forEach(function (x) { S[x.id] = x.name; });
        (data.places || []).forEach(function (x) { P[x.id] = x.name; });
        window.__CJN = { S: S, P: P };
      }
      return data;
    });
    return fetchIndexCached._p;
  }
  function buildRelMap(data) {
    var byS = {}, byM = {}, byA = {};
    (data.pieces || []).forEach(function (p) {
      (p.s || []).forEach(function (sid) { (byS[sid] = byS[sid] || []).push(p); });
      (p.m || []).forEach(function (mid) { (byM[mid] = byM[mid] || []).push(p); });
      if (p.a) (byA[p.a] = byA[p.a] || []).push(p);
    });
    return { byS: byS, byM: byM, byA: byA };
  }
  function pickRel(pool, selfId, n) {
    var out = [], used = {};
    used[selfId] = 1;
    for (var i = 0; i < (pool || []).length && out.length < n; i++) {
      var c = pool[i];
      if (used[c.i]) continue;
      used[c.i] = 1;
      out.push(c);
    }
    return out;
  }
  function injectRel() {
    if (!window.__CJN) return;
    doc.querySelectorAll('.q').forEach(function (card) {
      if (card.querySelector('.q-rel')) return;
      var shareBtn = card.querySelector('[data-share]');
      if (!shareBtn) return;
      var id = shareBtn.getAttribute('data-share');
      if (!id) return;
      relIndex().then(function (data) {
        var me = (data.pieces || []).find(function (z) { return z.i === id; });
        if (!me) return;
        var rm = buildRelMap(data);
        var pool = [];
        var seen = {};
        (me.s || []).forEach(function (sid) {
          (rm.byS[sid] || []).forEach(function (p) { if (!seen[p.i]) { seen[p.i] = 1; pool.push(p); } });
        });
        if (pool.length < 3) {
          (me.m || []).forEach(function (mid) {
            (rm.byM[mid] || []).forEach(function (p) { if (!seen[p.i]) { seen[p.i] = 1; pool.push(p); } });
          });
        }
        if (pool.length < 3 && me.a) {
          (rm.byA[me.a] || []).forEach(function (p) { if (!seen[p.i]) { seen[p.i] = 1; pool.push(p); } });
        }
        var rel = pickRel(pool, me.i, 3);
        if (!rel.length) return;
        var html = '<div class="q-rel"><div class="q-rel-h">类似此刻</div>';
        rel.forEach(function (r) {
          var rsrc = [r.a, r.w ? '《' + r.w + '》' : ''].filter(Boolean).join(' ');
          html += '<a class="q-rel-item" href="?q=' + encodeURIComponent(r.t.slice(0, 12)) + '" data-rel="' + r.i + '">'
            + '<span class="q-rel-t">' + escRel(r.t) + '</span>'
            + '<span class="q-rel-s">' + escRel(rsrc || '佚名') + '</span></a>';
        });
        html += '</div>';
        card.insertAdjacentHTML('beforeend', html);
      });
    });
  }
  function escRel(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  var _relTimer = null;
  function pollRel() {
    if (!window.__CJN) return;
    clearTimeout(_relTimer);
    _relTimer = setTimeout(injectRel, 400);
  }
  setTimeout(pollRel, 600);
  if ('MutationObserver' in window) {
    new MutationObserver(function () { if (doc.querySelector('.q')) pollRel(); }).observe(doc.body, { childList: true, subtree: true });
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('[data-rel]');
    if (!a) return;
    e.preventDefault();
    var q = doc.querySelector('#q');
    if (q) {
      // 站内搜索框存在：直接复用搜索，不跳转
      q.value = (a.getAttribute('data-rel-q') || '');
      q.dispatchEvent(new Event('input'));
      var head = q.closest('header, .head, form');
      if (head && head.scrollIntoView) head.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (a.getAttribute('href')) {
      location.href = a.getAttribute('href');
    }
  });
})();

/* ── U9 收藏导出 / 导入（第二轮第 4 批） ── */
(function favSync() {
  var doc = document;
  var FAV_KEY = 'ciju.fav';
  function getFav() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } }
  function setFav(a) { try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch (e) {} }

  function loadData() {
    // 独立加载索引（浏览器 HTTP 缓存兜底）
    var R = doc.querySelector('link[rel=stylesheet]') ? doc.querySelector('link[rel=stylesheet]').getAttribute('href').replace(/assets\/style\.css$/, '') : './';
    var mp = fetch(R + 'data/pieces.msgpack')
      .then(function (r) { if (!r.ok) throw new Error('no msgpack'); return r.arrayBuffer(); })
      .then(function (buf) { return msgpack.decode(new Uint8Array(buf)); });
    return mp.catch(function () { return fetch(R + 'data/index.json').then(function (r) { return r.json(); }); });
  }

  /* 导出：生成 Markdown 文本并下载 */
  function exportMd() {
    var fav = getFav();
    if (!fav.length) { miniToast('还没有收藏任何句子'); return; }
    loadData().then(function (data) {
      var byId = {};
      (data.pieces || []).forEach(function (p) { byId[p.i] = p; });
      var lines = ['# 我的词句收藏', '', '共 ' + fav.length + ' 句 · 导出时间 ' + new Date().toLocaleString('zh-CN'), ''];
      fav.forEach(function (id) {
        var p = byId[id];
        if (!p) return;
        var src = [p.a, p.w ? '《' + p.w + '》' : ''].filter(Boolean).join(' ');
        lines.push('- ' + p.t + (src ? ' —— ' + src : ''));
      });
      var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
      var a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '词句收藏.md';
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      miniToast('已导出 ' + fav.length + ' 句收藏');
    });
  }

  /* 导出 JSON（供导入还原 id） */
  function exportJson() {
    var fav = getFav();
    if (!fav.length) { miniToast('还没有收藏任何句子'); return; }
    loadData().then(function (data) {
      var byId = {};
      (data.pieces || []).forEach(function (p) { byId[p.i] = p; });
      var out = fav.map(function (id) { var p = byId[id]; return p ? { i: p.i, t: p.t, a: p.a, w: p.w } : null; }).filter(Boolean);
      var blob = new Blob([JSON.stringify(out, null, 0)], { type: 'application/json;charset=utf-8' });
      var a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '词句收藏.json';
      doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      miniToast('已导出 JSON 备份');
    });
  }

  /* 导入：合并去重 */
  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var raw = String(reader.result);
        var arr;
        if (/^\s*\[/.test(raw)) arr = JSON.parse(raw);           // JSON 备份
        else {                                                    // Markdown 行
          arr = raw.split('\n').filter(function (l) { return /^- /.test(l.trim()); })
            .map(function (l) { return { t: l.trim().replace(/^- /, '').split(' —— ')[0] }; });
        }
        if (!Array.isArray(arr) || !arr.length) throw new Error('empty');
        loadData().then(function (data) {
          var normT = function (s) { return String(s || '').replace(/[\s，。、？！；：“”"''（）()《》·—…\-.,!?;:]/g, ''); };
          var byT = {};
          (data.pieces || []).forEach(function (p) { byT[normT(p.t)] = byT[normT(p.t)] || p.i; });
          var cur = getFav(), set = new Set(cur), added = 0;
          arr.forEach(function (it) {
            var id = it.i || byT[normT(it.t)];
            if (id && !set.has(id)) { set.add(id); added++; }
          });
          var merged = Array.from(set);
          setFav(merged);
          miniToast('导入完成：新增 ' + added + ' 句，现有 ' + merged.length + ' 句');
          if (window.__favRefresh) window.__favRefresh();
        });
      } catch (e) {
        miniToast('文件格式无法识别');
      }
    };
    reader.readAsText(file);
  }

  function miniToast(msg) {
    var el = doc.querySelector('.round2-toast');
    if (!el) { el = doc.createElement('div'); el.className = 'round2-toast'; doc.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(miniToast._t);
    miniToast._t = setTimeout(function () { el.classList.remove('show'); }, 2000);
  }
})();
