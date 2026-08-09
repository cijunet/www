// 今日 · 历史上的今天 + 节气/节日 + 配几句词句。
// 数据来自 data/history.json（构建期抓取）+ 新分片运行时的倒排检索，不再依赖 pieces.msgpack。
import { initRecords, getCards, cardsForFilter, gidsForQuery } from './records.js';
import { renderCard, setMeta } from './card.js';
import { loadMeta } from './meta.js';
import { baseHref, esc as _esc } from './util.js';

const SEASON_KW = {
  spring: ['春', '花', '柳', '燕', '莺', '桃', '杏', '草', '绿', '风'],
  summer: ['夏', '暑', '荷', '蝉', '凉', '扇', '蛙', '雷', '骤雨', '荔枝', '瓜'],
  autumn: ['秋', '月', '霜', '枫', '菊', '雁', '桂', '梧', '黄叶', '愁'],
  winter: ['雪', '寒', '梅', '炉', '冬', '冰', '炭', '腊', '岁暮']
};
const SEASON_LABEL = { spring: '春日', summer: '夏日', autumn: '秋日', winter: '冬日' };
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

function seasonByMonth(m) {
  return (m >= 3 && m <= 5) ? 'spring' : (m >= 6 && m <= 8) ? 'summer' : (m >= 9 && m <= 11) ? 'autumn' : 'winter';
}
function mmdd(now) {
  return ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
}
function shortName(name) { return name.split(/[、·，]/)[0]; }

async function loadHistory(R) {
  try {
    const r = await fetch(R + 'data/history.json', { cache: 'force-cache' });
    if (r.ok) return await r.json();
  } catch (e) {}
  return null;
}
function todayTheme(hist, y, md, month) {
  const cal = hist && hist.years ? hist.years[y] : null;
  if (cal && cal[md]) { const f = cal[md]; return { n: f.n, kind: f.kind || '节日', scenes: f.scenes || [], kw: f.kw || [], s: f.s }; }
  if (hist && hist.terms && hist.terms[md]) { const t = hist.terms[md]; return { n: t.n, kind: '节气', scenes: [], kw: [], s: t.s }; }
  const s = seasonByMonth(month);
  return { n: SEASON_LABEL[s], kind: '时令', scenes: [], kw: [], s };
}

// 主题配句：按场景/关键词命中倒排，加权聚合（不取全文，最后统一 getCards）。
// seed 让每天从倒排表的不同位置起取，否则「此日此句」永远是同一批最小 gid。
async function collectGids(theme, limit = 8, seed = 0) {
  const seen = new Set(), scored = [];
  const addList = (list, w) => {
    if (!list || !list.length) return;
    const off = list.length ? seed % list.length : 0;
    for (let k = 0; k < list.length; k++) {
      const gid = list[(off + k) % list.length];
      if (gid == null || seen.has(gid)) continue;
      seen.add(gid); scored.push([gid, w]);
    }
  };
  for (const sid of (theme.scenes || [])) addList(await cardsForFilter({ s: sid }), 100);
  for (const kw of (theme.kw || [])) addList(await gidsForQuery(kw), 60);
  if (scored.length < 4 && theme.s && SEASON_KW[theme.s]) {
    for (const kw of SEASON_KW[theme.s]) addList(await gidsForQuery(kw), 25);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, limit).map(x => x[0]);
}
async function eventGids(ev, cap = 16) {
  // 关键词优先；配不到时用事件标题的 2-4 字滑窗词兜底（专名/罕见词也能捞一部分），
  // 保证「历史上的今天」每条都能点出内容
  const base = [...(ev.kw || [])].filter(Boolean);
  const chars = String(ev.t || '').replace(/[0-9a-zA-Z\s,，。·、（）()〔〕—\-]/g, '');
  const seen = new Set(); const kws = [];
  for (const k of base) if (!seen.has(k)) { seen.add(k); kws.push(k); }
  for (let len = 2; len <= 4 && kws.length < 14; len++) {
    for (let i = 0; i + len <= chars.length && kws.length < 14; i++) {
      const w = chars.slice(i, i + len);
      if (!seen.has(w)) { seen.add(w); kws.push(w); }
    }
  }
  if (!kws.length) return { count: 0, gids: [] };
  const hits = await Promise.all(kws.map(kw => gidsForQuery(kw).catch(() => [])));
  const seenG = new Set(); let count = 0; const gids = [];
  for (const hit of hits) {
    if (hit.length) count++;
    for (const gid of hit) if (!seenG.has(gid)) { seenG.add(gid); if (gids.length < cap) gids.push(gid); }
  }
  return { count, gids };
}

export async function mountToday(root = document) {
  const box = root.querySelector('[data-today]');
  if (!box) return;
  const R = baseHref();
  await initRecords(R);
  const meta = await loadMeta(); setMeta(meta);

  const now = new Date();
  const md = mmdd(now);
  const y = now.getFullYear();
  const hist = await loadHistory(R);
  const realTheme = todayTheme(hist, y, md, now.getMonth() + 1);

  // 顶部热词 chips（hero-hot）
  paintHotChips(R, meta, realTheme, md);

  const events = ((hist && hist.days) ? hist.days[md] : null) || [];
  const ranked = await Promise.all(events.map(async ev => {
    const r = await eventGids(ev, 16);
    return { ev, mc: r.count, gids: r.gids };
  }));
  ranked.sort((a, b) => (b.mc > 0 ? 1 : 0) - (a.mc > 0 ? 1 : 0) || a.ev.y - b.ev.y);
  const showEv = ranked.slice(0, 4);

  const daySeed = Math.floor(now.getTime() / 86400000);   // 天级种子：同一天稳定，隔天换一批
  const themeGids = await collectGids(realTheme, 8, daySeed);
  const seen = new Set(); const allGids = [];
  themeGids.forEach(g => { if (!seen.has(g)) { seen.add(g); allGids.push(g); } });
  showEv.forEach(e => e.gids.forEach(g => { if (!seen.has(g)) { seen.add(g); allGids.push(g); } }));
  // 全量取卡（去重后 ≤ 8 + 4×16 ≈ 72 条，量很小）：若 slice(0,16) 会把排位靠后事件的
  // gids 挤出取卡名额，出现「显示可配 X 句但点开空」的不一致。
  const all = allGids;
  if (!all.length && !showEv.length) { box.hidden = true; return; }

  const cards = await getCards(all);
  const cardByGid = new Map();
  cards.forEach(c => { if (c) cardByGid.set(c._gid, c); });
  const themeCards = themeGids.map(g => cardByGid.get(g)).filter(Boolean);
  showEv.forEach(e => { e.cards = e.gids.map(g => cardByGid.get(g)).filter(Boolean); });

  const head = `<div class="t-head"><h2>今日 <span class="t-date">${now.getMonth() + 1}月${now.getDate()}日 · 星期${WEEK[now.getDay()]}</span></h2>`
    + `<span class="t-tag">${realTheme.kind}·${_esc(realTheme.n)}</span></div>`;
  const evHtml = showEv.length
    ? '<div class="t-sub-title">历史上的今天</div><ul class="t-events">'
      + showEv.map((e, i) => `<li class="t-ev-link" role="button" tabindex="0" data-ev="${i}">`
        + `<b>${e.ev.y}</b><span>${_esc(e.ev.t)}</span>${e.cards.length > 0 ? '<em>可配 ' + e.cards.length + ' 句 ▸</em>' : '<em>查看 ▸</em>'}</li>`).join('')
      + '</ul>'
    : '';
  const phHtml = cards.length
    ? '<div class="t-sub-title" data-today-label>此日此句</div><div class="q-list" data-today-list></div>'
      + '<div class="t-foot"><button type="button" data-today-next>换一批</button><span class="t-page" data-today-page></span>'
      + '<button type="button" class="t-back" data-today-back hidden>← 返回全部</button></div>'
    : '';
  box.innerHTML = head + evHtml + phHtml;
  box.hidden = false;
  if (!cards.length) return;

  const PAGE = 4, listEl = box.querySelector('[data-today-list]');
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
    listEl.innerHTML = list.length
      ? list.slice(cur * PAGE, cur * PAGE + PAGE).map(c => renderCard(c, { R })).join('')
      : '<p class="empty">这个事件暂时没配到合适的句子，换个别的看看。</p>';
    if (pageEl) pageEl.textContent = pages > 1 ? ((cur + 1) + ' / ' + pages) : '';
    if (nextBtn) nextBtn.hidden = pages <= 1;
  };
  const setMode = idx => {
    mode = idx; cur = 0;
    evEls.forEach((el, i) => el.classList.toggle('on', i === idx));
    if (idx < 0) { labelEl.textContent = '此日此句'; backBtn.hidden = true; }
    else { const e = showEv[idx]; labelEl.textContent = `为「${e.ev.y}年·${e.ev.t}」配的句子`; backBtn.hidden = false; }
    paint();
  };
  box.addEventListener('click', e => {
    const li = e.target.closest('[data-ev]');
    if (li) {
      const idx = Number(li.getAttribute('data-ev'));
      if (showEv[idx] == null) return;
      setMode(mode === idx ? -1 : idx);
      if (mode >= 0) labelEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
