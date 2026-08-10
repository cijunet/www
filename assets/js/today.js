// 今日 · 历史上的今天 + 节气/节日 + 配几句词句。
// 数据源（架构 7.x）：构建期预生成的 data/today.json（366 天事件→配句 gid）+ 今日迷你分片，
// 首页今日板块不再依赖 index / 主分片 —— 首屏数据从 ~1.9MB 降到 ~0.5MB，且渲染不被索引下载阻塞。
// 渲染分两段：第一段（today.json + meta 就绪）立刻出标题/事件/热词；第二段迷你分片到货后渐进补卡片。
import { renderCard, setMeta } from './card.js';
import { loadMeta } from './meta.js';
import { baseHref, esc as _esc } from './util.js';
import { fetchJSON, fetchBytes, pickCompress } from './hashsearch.js';
import { decompress, decodeMsgpack, sha256hex } from './codec.js';
import { dbGet, dbPut } from './db.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const CHIP_CAL = [
  { f: '0101', t: '0105', ids: ['kuanian', 'yanhuo', 'jijie'] },
  { f: '0106', t: '0228', ids: ['chuxue', 'handong', 'mianhua'] },
  { f: '0301', t: '0415', ids: ['chuchun', 'chunhua', 'jiangnan'] },
  { f: '0416', t: '0531', ids: ['songchun', 'xianju', 'xingzou'] },
  { f: '0520', t: '0715', ids: ['biye', 'songbie', 'tongchuang'] },
  { f: '0615', t: '0810', ids: ['fangbang', 'dengding', 'luobang'] },
  { f: '0601', t: '0831', ids: ['chengxia', 'tinghe', 'yutian', 'kanhai'] },
  { f: '0815', t: '0920', ids: ['kaoyan', 'dushu', 'shaonian'] },
  { f: '0901', t: '1031', ids: ['qiuyi', 'yeshi', 'huaiwu'] },
  { f: '1101', t: '1219', ids: ['handong', 'jijie', 'chuxue'] },
  { f: '1220', t: '1231', ids: ['kuanian', 'shousui', 'yanhuo'] }
];
const THEME_CHIPS = {
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

function mmdd(now) {
  return ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
}
function shortName(name) { return name.split(/[、·，]/)[0]; }

// 主线程首次 msgpack 解码前注入解码器（经典脚本，与 search-worker importScripts 同一个文件；幂等）
let _mpReady = null;
function ensureMsgpackGlobal() {
  if (globalThis.msgpack) return Promise.resolve();
  if (_mpReady) return _mpReady;
  _mpReady = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = baseHref() + 'assets/msgpack.min.js';
    s.onload = () => res();
    s.onerror = () => { _mpReady = null; rej(new Error('msgpack 加载失败')); };
    document.head.appendChild(s);
  });
  return _mpReady;
}

// 迷你分片：IDB 缓存优先（哈希名内容不可变 → 缓存安全）→ miss 则拉取 + 校验 + 落库。
// 与主分片同模式（datacache fetchVerify），版本变化时 dbClear 一并清空，不会残留旧数据。
async function loadTodayShards(R, shards) {
  await ensureMsgpackGlobal();
  const out = new Map();
  const ext = pickCompress();
  await Promise.all(shards.map(async s => {
    let buf = null, useExt = ext;
    const cached = await dbGet('blobs', s.n).catch(() => null);
    if (cached && cached.buf) {
      const got = await sha256hex(cached.buf);
      if (got === (cached.ext === 'br' ? s.hbr : s.hgz)) { buf = cached.buf; useExt = cached.ext; }
    }
    if (!buf) {
      buf = await fetchBytes(R, s.n, ext, { timeout: 45000 });
      const want = ext === 'br' ? s.hbr : s.hgz;
      const got = await sha256hex(buf);
      if (got !== want) throw new Error('今日分片校验失败: ' + s.n + '.' + ext);
      dbPut('blobs', s.n, { buf, ext }).catch(() => {});
    }
    const dec = await decompress(buf, useExt);
    const pack = await decodeMsgpack(dec);
    for (const x of (pack.pieces || [])) {
      if (x && x.r) { x.r._gid = x.g; out.set(x.g, x.r); }
    }
  }));
  return out;
}

export async function mountToday(root = document) {
  const box = root.querySelector('[data-today]');
  if (!box) return;
  const R = baseHref();

  // 第一段：只依赖 today.json + meta（合计 ~150KB），今日板块即刻可见
  const meta = await loadMeta().catch(() => ({})); setMeta(meta);
  const now = new Date();
  const md = mmdd(now);

  let tj = null;
  try { tj = await fetchJSON(R, 'today.json'); } catch (e) { console.error('[today] 今日数据包加载失败', e); }
  const td = (tj && tj.days) ? tj.days[md] : null;
  if (!td) {
    // 数据缺失（闰日 0229 等无数据天）：正常降级，不误报网络错误
    box.innerHTML = '<div class="t-head"><h2>今日</h2></div>'
      + `<p class="empty">${now.getMonth() + 1}月${now.getDate()}日暂无历史事件记录，换个日子看看。</p>`;
    box.hidden = false;
    return;
  }

  const theme = td.theme || { n: '今日', kind: '', scenes: [], kw: [], s: '' };
  // 事件排序：有配句的优先 + 年份升序（与旧版 ranked.sort 一致）
  const showEv = (td.ev || []).slice()
    .sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0) || a.y - b.y)
    .slice(0, 4);

  paintHotChips(R, meta, theme, md);

  const head = `<div class="t-head"><h2>今日 <span class="t-date">${now.getMonth() + 1}月${now.getDate()}日 · 星期${WEEK[now.getDay()]}</span></h2>`
    + `<span class="t-tag">${theme.kind || ''}·${_esc(theme.n)}</span></div>`;
  const evHtml = showEv.length
    ? '<div class="t-sub-title">历史上的今天</div><ul class="t-events">'
      + showEv.map((e, i) => `<li class="t-ev-link" role="button" tabindex="0" data-ev="${i}">`
        + `<b>${e.y}</b><span>${_esc(e.t)}</span>${e.gids.length > 0 ? '<em>可配 ' + e.gids.length + ' 句 ▸</em>' : '<em>查看 ▸</em>'}</li>`).join('')
      + '</ul>'
    : '';
  const phHtml = '<div class="t-sub-title" data-today-label>此日此句</div><div class="q-list" data-today-list></div>'
    + '<div class="t-foot"><button type="button" data-today-next>换一批</button><span class="t-page" data-today-page></span>'
    + '<button type="button" class="t-back" data-today-back hidden>← 返回全部</button></div>';
  box.innerHTML = head + evHtml + phHtml;
  box.hidden = false;

  const listEl = box.querySelector('[data-today-list]');
  if (listEl) listEl.innerHTML = '<p class="empty">正在配句子…</p>';

  // 第二段：迷你分片到货 → 卡片渐进补渲染（标题/事件早已显示）
  let recs = new Map();
  try {
    recs = await loadTodayShards(R, tj.shards || []);
  } catch (e) { console.error('[today] 迷你分片加载失败', e); }

  const themeCards = td.themeGids.map(g => recs.get(g)).filter(Boolean);
  showEv.forEach(e => { e.cards = e.gids.map(g => recs.get(g)).filter(Boolean); });

  if (!recs.size) {
    if (listEl) listEl.innerHTML = '<p class="empty">配句数据加载失败，稍后刷新再看看。</p>';
    return;
  }
  if (!themeCards.length && !showEv.some(e => e.cards.length)) {
    if (listEl) listEl.innerHTML = '<p class="empty">今天暂时没配到合适的句子，换个别的看看。</p>';
    return;
  }

  const PAGE = 4;
  const labelEl = box.querySelector('[data-today-label]');
  const nextBtn = box.querySelector('[data-today-next]');
  const backBtn = box.querySelector('[data-today-back]');
  const pageEl = box.querySelector('[data-today-page]');
  const evEls = Array.prototype.slice.call(box.querySelectorAll('.t-events li'));
  let cur = 0, mode = -1;
  const activeList = () => mode < 0 ? themeCards : (showEv[mode].cards || []);
  const paint = () => {
    const list = activeList();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (cur >= pages) cur = 0;
    if (listEl) listEl.innerHTML = list.length
      ? list.slice(cur * PAGE, cur * PAGE + PAGE).map(c => renderCard(c, { R })).join('')
      : '<p class="empty">这个事件暂时没配到合适的句子，换个别的看看。</p>';
    if (pageEl) pageEl.textContent = pages > 1 ? ((cur + 1) + ' / ' + pages) : '';
    if (nextBtn) nextBtn.hidden = pages <= 1;
  };
  const setMode = idx => {
    mode = idx; cur = 0;
    evEls.forEach((el, i) => el.classList.toggle('on', i === idx));
    if (idx < 0) { if (labelEl) labelEl.textContent = '此日此句'; if (backBtn) backBtn.hidden = true; }
    else { const e = showEv[idx]; if (labelEl) labelEl.textContent = `为「${e.y}年·${e.t}」配的句子`; if (backBtn) backBtn.hidden = false; }
    paint();
  };
  box.addEventListener('click', e => {
    const li = e.target.closest('[data-ev]');
    if (li) {
      const idx = Number(li.getAttribute('data-ev'));
      if (showEv[idx] == null) return;
      setMode(mode === idx ? -1 : idx);
      if (mode >= 0 && labelEl) labelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    if (e.target.closest('[data-today-back]')) { setMode(-1); return; }
    if (e.target.closest('[data-today-next]')) {
      const pages = Math.max(1, Math.ceil(activeList().length / PAGE));
      cur = (cur + 1) % pages; paint();
    }
  });
  setMode(-1);
}

function paintHotChips(R, meta, theme, md) {
  const bar = document.querySelector('.hero-hot');
  if (!bar) return;
  const smap = meta.scenes || {};
  const picked = [];
  const push = id => { if (smap[id] && smap[id].name && picked.indexOf(id) < 0 && picked.length < 10) picked.push(id); };
  if (theme && THEME_CHIPS[theme.n]) THEME_CHIPS[theme.n].forEach(push);
  CHIP_CAL.forEach(r => { if (r.f <= md && md <= r.t) r.ids.forEach(push); });
  ['jiaban', 'xiangnian', 'yigeren', 'shengri'].forEach(push);
  if (picked.length < 3) return;
  const badge = (theme && theme.n) ? `<span class="hot-today" data-hot-today>今日·${_esc(shortName(theme.n))}</span>` : '';
  bar.innerHTML = badge + picked.map(id => `<a href="${R}scenes/?id=${id}">${_esc(smap[id].name)}</a>`).join('')
    + '<button class="hot-random" type="button" data-random>随便来一句</button>';
  const q = document.querySelector('.hero-search input[name="q"]');
  if (q) {
    const prefix = (theme && theme.n) ? '今日' + shortName(theme.n) + '，' : '';
    q.placeholder = prefix + '你现在是什么处境？' + picked.slice(0, 4).map(id => shortName(smap[id].name)).join('、') + '…';
  }
}
