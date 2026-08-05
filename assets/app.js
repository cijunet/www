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
      bar.innerHTML = r.ids.map(function (id) { return '<a href="' + R + 's/' + id + '/">' + esc(r.smap[id]) + '</a>'; }).join('')
        + '<button class="hot-random" type="button" data-random>随便来一句</button>';
      var q = $('.hero-search input[name="q"]');
      if (q) q.placeholder = '你现在是什么处境？' + r.ids.slice(0, 4).map(function (id) { return shortName(r.smap[id]); }).join('、') + '…';
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
        box.innerHTML = head + evHtml + phHtml;
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
