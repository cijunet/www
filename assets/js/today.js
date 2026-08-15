// 今日 · 历史上的今天 + 节气/节日 + 配几句词句。
// 数据源（架构 7.x 演进）：构建期只预生成 data/today.json（366 天事件→配句 gid 配置），
// 实际记录由「主分片」按 gid 提供 —— 与全站单一数据源，今日板块不再有独立重复包。
// 渲染分两段：第一段（today.json + meta 就绪）立刻出标题/事件/热词；第二段主分片到货后渐进补卡片。
import { renderCard, setMeta } from './card.js';
import { loadMeta } from './meta.js';
import { baseHref, esc as _esc } from './util.js';
import { fetchJSON } from './hashsearch.js';
import { getManifest, getShardRecords } from './datacache.js';
import { displayText } from './i18n.js';

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

// 今日记录改从「主分片」按 gid 取句（单一数据源，不再有独立重复包）：
// gid 在 D.pieces 中的位置即全局整数下标，分片边界 = floor(gid / shardSize)，
// 经 datacache 取压缩字节（IDB 缓存 + 版本校验，且与搜索 Worker 共享同一份下载），主线程解码
// （getShardRecords 内部有整片解码缓存，多模块共用只解一次）。
async function loadTodayRecords(gids) {
  const m = await getManifest();
  const shardSize = m.shardSize || 1900;
  const byShard = new Map();
  for (const g of gids) {
    if (g == null) continue;
    const si = Math.floor(g / shardSize);
    if (!byShard.has(si)) byShard.set(si, []);
    byShard.get(si).push(g);
  }
  const out = new Map();
  await Promise.all([...byShard.entries()].map(async ([si, gs]) => {
    let pieces;
    try { pieces = await getShardRecords(si); }
    catch (e) { console.error('[today] 分片加载失败', si, e); return; }
    for (const g of gs) {
      const rec = pieces[g % shardSize];
      if (rec) { rec._gid = g; out.set(g, rec); }
    }
  }));
  return out;
}

export async function mountToday(root = document) {
  const box = root.querySelector('[data-today]');
  if (!box) return;
  const R = baseHref();

  // 第一段：只依赖 today.json + meta（合计 ~150KB），今日板块即刻可见。
  // 两路独立（都已被首页 preload / force-cache），并行拉取，首屏标题更早出现。
  const [meta, tj] = await Promise.all([
    loadMeta().catch(() => ({})),
    fetchJSON(R, 'today.json').catch(e => { console.error('[today] 今日数据包加载失败', e); return null; })
  ]);
  setMeta(meta);
  const now = new Date();
  const md = mmdd(now);

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
  const phHtml = '<div class="t-sub-title"><span data-today-label>此日此句</span><span class="t-ev-desc-inline" data-today-desc hidden></span></div>'
    + '<div class="q-list" data-today-list></div>'
    + '<div class="t-foot"><button type="button" data-today-next>换一批</button><span class="t-page" data-today-page></span>'
    + '<button type="button" class="t-back" data-today-back hidden>← 返回全部</button></div>';
  box.innerHTML = head + evHtml + phHtml;
  box.hidden = false;

  const listEl = box.querySelector('[data-today-list]');
  if (listEl) listEl.innerHTML = '<p class="empty">正在配句子…</p>';

  // 第二段：主分片到货 → 卡片渐进补渲染（标题/事件早已显示）
  let recs = new Map();
  try {
    const allGids = [...new Set([...(td.themeGids || []), ...showEv.flatMap(e => e.gids || [])])];
    recs = await loadTodayRecords(allGids);
  } catch (e) { console.error('[today] 主分片取句失败', e); }

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
  const descEl = box.querySelector('[data-today-desc]');
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
    if (idx < 0) { if (labelEl) labelEl.textContent = '此日此句'; if (backBtn) backBtn.hidden = true; if (descEl) { descEl.hidden = true; descEl.textContent = ''; } }
    else { const e = showEv[idx]; if (labelEl) labelEl.textContent = `为「${e.y}年·${e.t}」配的句子`; if (backBtn) backBtn.hidden = false; if (descEl) { if (e.d) { descEl.textContent = '　·　' + e.d; descEl.hidden = false; } else { descEl.hidden = true; descEl.textContent = ''; } } }
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
    q.placeholder = displayText(prefix + '你现在是什么处境？' + picked.slice(0, 4).map(id => shortName(smap[id].name)).join('、') + '…');
  }
}
