// assets/js/game-guess.js — 玩法：诗谜（汉兜式 · 猜诗句）
// 目标：一句 5/7 字名诗。玩家自由输入任意 5/7 汉字，逐字四维反馈：
//   字格：🟩 绿=同字同位 · 🟨 黄=同字异位 · ⬜ 灰=目标无此字（Wordle 贪心判定）
//   拼音行：每字下方显示 声母/韵母/声调，与目标同段高亮 → 凭音律推理
// 6 次机会；模式：今日谜题（按日期确定性）/ 五言 / 七言。
import { esc } from './util.js';
import { fetchJSON } from './hashsearch.js';
import { sfx, burst, wrap, settleGame, starHTML, rankBadge, recordFor, explainBox, recordMistake, reviewHTML, reviewButton, mulberry32, fmtElapsed, moreLink } from './game-common.js';

// Wordle 贪心：先标绿（占位计数），再按剩余计数标黄
function grade(guess, target) {
  const g = [...guess], t = [...target];
  const res = g.map(() => 'grey');
  const counts = {};
  for (const c of t) counts[c] = (counts[c] || 0) + 1;
  for (let i = 0; i < g.length; i++) if (g[i] === t[i]) { res[i] = 'green'; counts[g[i]]--; }
  for (let i = 0; i < g.length; i++) if (res[i] === 'grey' && counts[g[i]] > 0) { res[i] = 'yellow'; counts[g[i]]--; }
  return res;
}

export async function render(root, _data, R) {
  const ui = wrap(root, '诗谜 · 猜诗句');
  const pz = await fetchJSON(R, 'puzz.json');
  const list = pz.list || [];
  if (!list.length) { ui.stage.innerHTML = '<p class="empty">诗谜题库加载失败。</p>'; return; }
  const pyDict = pz.py || {};

  const now = new Date();
  const ymd = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const DONE_KEY = 'ciju.guess.' + ymd;
  const dailyIdx = Math.floor(mulberry32(ymd)() * list.length);

  let mode = 'daily';        // daily | p5 | p7
  let target = null, attempts = 0, over = false, composing = false;
  let lastLen = 0;
  const items = [];          // 本局回顾（成功目标句在 finish 时补入）

  function pick(len) {
    const pool = len ? list.filter(q => [...q.t].length === len) : list;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function targetFor(m) {
    if (m === 'daily') return list[dailyIdx];
    return pick(m === 'p5' ? 5 : 7);
  }

  function renderBoard() {
    const len = [...target.t].length;
    lastLen = len;
    // 押韵线索：目标句末字韵母（诗词特色推理线索）
    const lastChar = [...target.t][len - 1];
    const lastPy = pyDict[lastChar] || [];
    const rhymeTip = lastPy[1] ? `<span class="g-rhyme">韵脚：押「${esc(lastPy[1])}」韵</span>` : '';
    ui.stage.innerHTML = `
      <p class="g-guess-modes">
        <button type="button" class="g-chip sm${mode === 'daily' ? ' on' : ''}" data-m="daily">今日谜题</button>
        <button type="button" class="g-chip sm${mode === 'p5' ? ' on' : ''}" data-m="p5">五言</button>
        <button type="button" class="g-chip sm${mode === 'p7' ? ' on' : ''}" data-m="p7">七言</button>
      </p>
      <p class="g-guess-tip">目标：一句${len}字诗。自由输入${len}个汉字回车提交，共 6 次机会。${rhymeTip}<br><span class="g-guess-hint">绿=字对位对 · 黄=字对位错 · 灰=无此字；下方拼音与目标吻合处会高亮。</span></p>
      <div class="g-guess-board" aria-live="polite"></div>
      <p class="g-guess-status" data-status></p>`;
    ui.opts.innerHTML = `<form class="g-guess-form" autocomplete="off">
      <input class="g-guess-input" maxlength="${len}" placeholder="输入${len}个字，按回车猜一句" aria-label="输入猜测">
      <button type="submit" class="g-btn">猜</button>
    </form>`;
    ui.src.textContent = `第 1 / 6 次尝试`;
    const input = ui.opts.querySelector('.g-guess-input');
    const board = ui.stage.querySelector('.g-guess-board');
    const status = ui.stage.querySelector('[data-status]');
    input.focus();

    ui.stage.querySelectorAll('[data-m]').forEach(btn => {
      btn.onclick = () => { if (mode === btn.dataset.m) return; mode = btn.dataset.m; startNew(); };
    });
    // 中文输入法 composition：上屏期间不提交
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; });
    ui.opts.querySelector('form').onsubmit = e => {
      e.preventDefault();
      if (composing || over) return;
      const v = (input.value || '').trim();
      if (!v || [...v].length !== len) {
        status.textContent = `请输入 ${len} 个字。`;
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 420);
        return;
      }
      submit(v, input, board, status);
    };
  }

  function submit(v, input, board, status) {
    if (over) return;
    const chars = [...v];
    const res = grade(chars, [...target.t]);
    const row = document.createElement('div');
    row.className = 'g-guess-row';
    let allGreen = true;
    row.innerHTML = chars.map((c, i) => {
      const gr = res[i];
      if (gr !== 'green') allGreen = false;
      const py = pyDict[c] || ['', '', 0];
      const tp = pyDict[[...target.t][i]] || ['', '', 0];
      const seg = (mine, ref) => `<span class="g-py-seg${mine && ref && mine === ref ? ' on' : ''}">${esc(mine || '·')}</span>`;
      return `<div class="g-guess-cell ${gr}">
        <b>${esc(c)}</b>
        <i class="g-py">${seg(py[0], tp[0])}${seg(py[1], tp[1])}<em class="g-tone${py[2] && py[2] === tp[2] ? ' on' : ''}">${py[2] || ''}</em></i>
      </div>`;
    }).join('');
    board.appendChild(row);
    attempts++;
    input.value = '';

    if (allGreen) return finish(input, board, status, true);
    if (attempts >= 6) return finish(input, board, status, false);

    ui.src.textContent = `第 ${attempts + 1} / 6 次尝试`;
    const greens = res.filter(g => g === 'green').length;
    if (greens >= 3) sfx.combo(greens); else if (greens >= 1) sfx.right(); else sfx.wrong();
    if (greens === 0 && attempts >= 2) {
      status.innerHTML = `提示：这句出自 <b>${esc(target.a || '佚名')}</b>${target.w ? '《' + esc(target.w) + '》' : ''}`;
    } else {
      status.textContent = '';
    }
    setTimeout(() => board.lastChild.scrollIntoView({ block: 'nearest' }), 30);
  }

  function finish(input, board, status, ok) {
    over = true;
    items.push({ t: target.t, a: target.a, w: target.w, ok });
    const stars = ok ? (attempts <= 2 ? 3 : attempts <= 4 ? 2 : 1) : 0;
    const st = settleGame('guess', stars);
    if (ok) {
      sfx.win();
      burst(board, 'gold');
      try { localStorage.setItem(DONE_KEY, String(stars)); } catch {}
    } else {
      sfx.wrong();
      const row = document.createElement('div');
      row.className = 'g-guess-row ans';
      row.innerHTML = [...target.t].map(c => `<div class="g-guess-cell green"><b>${esc(c)}</b><i class="g-py"></i></div>`).join('');
      board.appendChild(row);
    }
    status.innerHTML = '';
    ui.src.textContent = '';
    ui.opts.innerHTML = `<div class="g-done"><b>${ok ? '猜中了！' : '没猜中'}</b>
      <p>目标句：<em class="g-ans">${esc(target.t)}</em>${ok ? starHTML(stars) : `<br><span class="g-ans-src">— ${esc(target.a || '佚名')}《${esc(target.w)}》</span>`}<span class="g-done-time">用时 ${fmtElapsed(ui.elapsed())}</span></p>
      <div class="g-done-rank">${rankBadge(st)}${st.broke ? '<span class="g-broke">新纪录 +' + st.gain + '★</span>' : ''}</div>
      <div class="g-done-btns"><button type="button" class="g-btn" data-again>再来一局</button>
      <button type="button" class="g-btn ghost" data-new>换一句</button>${reviewButton()}${moreLink(R)}</div>
    </div>`;
    ui.opts.querySelector('[data-again]').onclick = () => startNew();
    ui.opts.querySelector('[data-new]').onclick = () => {
      // 每日模式下「换一句」切到同长度的随机题（今日谜题是固定唯一的）
      if (mode === 'daily') mode = lastLen === 5 ? 'p5' : 'p7';
      startNew();
    };
    const rv = ui.opts.querySelector('[data-review]');
    if (rv) rv.onclick = () => {
      ui.opts.innerHTML = `<div class="g-done"><b>本局回顾</b>${reviewHTML(items)}<button type="button" class="g-btn" data-again2>再来一局</button>${moreLink(R)}</div>`;
      ui.opts.querySelector('[data-again2]').onclick = () => startNew();
    };
    // 讲解闭环
    (async () => {
      const rec = await recordFor(target.gid);
      ui.fb.innerHTML = rec ? explainBox(rec, R, { wrong: !ok }) : '';
      if (!ok && rec) recordMistake(rec, 'guess');
    })();
  }

  function startNew() {
    const t = targetFor(mode);
    if (!t) { ui.stage.innerHTML = '<p class="empty">这个长度没有题目。</p>'; return; }
    target = t;
    attempts = 0; over = false;
    items.length = 0;
    ui.fb.innerHTML = '';
    renderBoard();
  }

  startNew(); // 首屏 = 今日谜题
}
