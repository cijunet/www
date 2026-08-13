// assets/js/game-feihua.js — 玩法：飞花令 · 对句（提示半句，补全另一半）
// 规则：系统出关键字 + 一句含字的诗，只提示前半句或后半句，你自由输入补全另一半。
// 每回合 180 秒（充分思考）；3 条命（超时/跳过扣命）；补对显示完整句与讲解。
import { esc, norm } from './util.js';
import { sfx, burst, shuffle, wrap, settleGame, starHTML, rankBadge, recordFor, explainBox, recordMistake, fmtElapsed, moreLink } from './game-common.js';

const ROUNDS = 12;
const TIME = 180;

export function render(root, data, R) {
  const ui = wrap(root, '飞花令 · 对句');
  const chars = Object.keys(data.feihua);
  let ch = '', bank = [], order = [], idx = 0, lives = 3, correct = 0, timer = null, timeLeft = TIME, composing = false, busy = false, hints = 2;

  function renderHead() {
    ui.stage.innerHTML = `
      <p class="g-fh-tip">这一轮的关键字</p>
      <div class="g-fh-char">${esc(ch)}</div>
      <p class="g-fh-rule">共 ${ROUNDS} 句含「${esc(ch)}」的诗句，每句提示一半，你补全另一半。每句 <b>${TIME} 秒</b>，3 条命。</p>
      <p class="g-fh-time" data-stat>生命 <em data-lives>${lives}</em> · 已对 <em data-c>${correct}</em> 句</p>`;
  }

  function startTimer() {
    clearTimer();
    timeLeft = TIME;
    const t = ui.stage.querySelector('[data-t]');
    if (t) { t.textContent = timeLeft; t.classList.remove('low'); }
    const bar = ui.stage.querySelector('[data-bar]');
    if (bar) bar.style.width = '100%';
    timer = setInterval(() => {
      timeLeft--;
      const t2 = ui.stage.querySelector('[data-t]');
      if (t2) { t2.textContent = timeLeft; if (timeLeft <= 10) t2.classList.add('low'); }
      const bar2 = ui.stage.querySelector('[data-bar]');
      if (bar2) bar2.style.width = Math.max(0, (timeLeft / TIME) * 100) + '%';
      if (timeLeft <= 0) { clearTimer(); onTimeout(); }
    }, 1000);
  }
  function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function next() {
    if (idx >= order.length) return done();
    const q = order[idx];
    // 优先提示「含关键字」的那一半（否则玩家看到关键字与提示对不上，无从下手）
    const upHas = q.up.includes(ch), downHas = q.down.includes(ch);
    const hintUp = upHas && !downHas ? true : (!upHas && downHas ? false : Math.random() < 0.5);
    const shown = hintUp ? q.up : q.down;
    const target = hintUp ? q.down : q.up;
    const targetLen = [...target].length;
    const askWord = hintUp ? '下句' : '上句';
    busy = false;
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `
      <p class="g-fh-tip">关键字「${esc(ch)}」 · 第 ${idx + 1} / ${ROUNDS} 句 · 提示${hintUp ? '上句' : '下句'}</p>
      <div class="g-fh-q">${esc(shown)}<span class="g-fh-blank">${askWord}（${targetLen}字）：______</span></div>
      <p class="g-fh-time" data-stat>剩余 <em data-t>${TIME}</em> 秒 · 生命 <em data-lives>${lives}</em> · 已对 <em data-c>${correct}</em></p>
      <span class="g-fh-bar"><i data-bar style="width:100%"></i></span>`;
    ui.opts.innerHTML = `<form class="g-fh-form" autocomplete="off">
      <input type="text" class="g-input" maxlength="24" placeholder="输入${askWord}（${targetLen}字），回车提交" aria-label="输入诗句">
      <button type="submit" class="g-btn">提交</button>
      <button type="button" class="g-btn ghost" data-skip>放弃</button>
    </form>${hints > 0 ? `<p class="g-fh-hints"><button type="button" class="g-btn ghost sm" data-hint>💡 提示（剩 ${hints} 次）</button></p>` : ''}`;
    const input = ui.opts.querySelector('.g-input');
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; });
    ui.opts.querySelector('[data-skip]').onclick = () => { if (!busy) giveUp('放弃'); };
    // 提示：显示答案首字（不自动填，仍要完整背出）
    const hintBtn = ui.opts.querySelector('[data-hint]');
    if (hintBtn) hintBtn.onclick = () => {
      if (busy) return;
      hints--;
      const first = [...target][0];
      ui.src.innerHTML = `💡 首字是「<b>${esc(first)}</b>」——再想想后半句。`;
      input.placeholder = `以「${esc(first)}」开头的 ${targetLen} 个字`;
      hintBtn.disabled = true;
      if (hints > 0) hintBtn.textContent = `💡 提示（剩 ${hints} 次）`; else hintBtn.textContent = '提示已用完';
      input.focus();
    };
    ui.opts.querySelector('form').onsubmit = e => {
      e.preventDefault();
      if (composing || busy) return;
      const v = (input.value || '').trim();
      if (!v) return;
      const t = norm(target);
      const nv = norm(v);
      if (nv.length !== [...target].length) {
        sfx.wrong();
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 420);
        ui.src.textContent = `${askWord}应是 ${targetLen} 个字，再数数。`;
        return;
      }
      if (nv === t) {
        busy = true;
        correct++;
        updateStat();
        sfx.right();
        burst(ui.stage, 'gold');
        clearTimer();
        // 答案显示在讲解上方（.g-ans 醒目），讲解追加到答案下面
        ui.fb.innerHTML = `<p class="g-ans">✓ ${esc(q.up)}，${esc(q.down)}。</p><p class="g-ans-src">— ${esc(q.au || '佚名')}《${esc(q.w)}》<a class="g-wlink" href="${R}works/?w=${encodeURIComponent(q.w)}">查看原文 ↗</a></p>`;
        ui.src.textContent = '';
        (async () => {
          const rec = await recordFor(q.gid);
          if (rec) ui.fb.innerHTML += explainBox(rec, R);
        })();
        // 答案已展示，等用户点「下一题」再切换
        const nx = document.createElement('button');
        nx.type = 'button'; nx.className = 'g-btn g-next'; nx.textContent = '下一题 →';
        nx.onclick = () => { idx++; next(); };
        ui.opts.innerHTML = '';
        ui.opts.appendChild(nx);
      } else {
        sfx.wrong();
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 420);
        ui.src.textContent = `不对，再想想（提示的是${askWord}：${esc(shown)}）`;
      }
    };
    input.focus();
    startTimer();
  }

  function updateStat() {
    const st = ui.stage.querySelector('[data-stat]');
    if (!st) return;
    const l = st.querySelector('[data-lives]'), c = st.querySelector('[data-c]');
    if (l) l.textContent = lives;
    if (c) c.textContent = correct;
  }

  function onTimeout() {
    if (busy) return;
    giveUp('⏱ 超时');
  }

  // 超时或主动放弃：扣 1 命，显示答案与讲解
  function giveUp(reason) {
    if (busy) return;
    busy = true;
    clearTimer();
    const q = order[idx];
    lives--;
    sfx.wrong();
    // 答案显示在讲解上方
    ui.fb.innerHTML = `<p class="g-ans">${reason}，这句是：${esc(q.up)}，${esc(q.down)}。</p><p class="g-ans-src">— ${esc(q.au || '佚名')}《${esc(q.w)}》</p>`;
    ui.src.textContent = '';
    (async () => {
      const rec = await recordFor(q.gid);
      if (rec) { ui.fb.innerHTML += explainBox(rec, R, { wrong: true }); recordMistake(rec, 'feihua'); }
    })();
    if (lives <= 0) { setTimeout(() => done(), 2200); }
    else {
      // 答案已展示，等用户点「下一题」再切换
      const nx = document.createElement('button');
      nx.type = 'button'; nx.className = 'g-btn g-next'; nx.textContent = '下一题 →';
      nx.onclick = () => { idx++; next(); };
      ui.opts.innerHTML = '';
      ui.opts.appendChild(nx);
    }
  }

  function done() {
    clearTimer();
    const stars = correct >= 10 ? 3 : correct >= 7 ? 2 : correct >= 4 ? 1 : 0;
    const st = settleGame('feihua', stars);
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<div class="g-done"><b>${correct >= ROUNDS ? '满堂彩！一句没漏' : '一轮飞花结束'}</b>
      <p>补对 <em>${correct}</em> / ${ROUNDS} 句${starHTML(stars)}<span class="g-done-time">用时 ${fmtElapsed(ui.elapsed())}</span></p>
      <div class="g-done-rank">${rankBadge(st)}${st.broke ? '<span class="g-broke">新纪录 +' + st.gain + '★</span>' : ''}</div>
      <div class="g-done-btns"><button type="button" class="g-btn" data-again>换字再来</button>
      <button type="button" class="g-btn ghost" data-see>回顾本局</button>${moreLink(R)}</div>
    </div>`;
    ui.opts.innerHTML = '';
    ui.play.querySelector('[data-again]').onclick = () => startGame();
    ui.play.querySelector('[data-see]').onclick = () => {
      ui.stage.innerHTML = `<div class="g-done"><b>本轮飞花 · 「${esc(ch)}」</b><div class="g-review">
        ${order.map(q => `<p class="g-rv-line">${esc(q.up)}，${esc(q.down)}。<span>— ${esc(q.au || '佚名')}《${esc(q.w)}》</span></p>`).join('')}
      </div><button type="button" class="g-btn" data-again>换字再来</button>${moreLink(R)}</div>`;
      ui.play.querySelector('[data-again]').onclick = () => startGame();
    };
  }

  function startGame() {
    ch = shuffle(chars)[0];
    bank = data.feihua[ch] || [];
    order = shuffle(bank).slice(0, ROUNDS);
    idx = 0; lives = 3; correct = 0; busy = false; hints = 2;
    ui.src.textContent = '';
    ui.opts.innerHTML = '';
    ui.fb.innerHTML = '';
    renderHead();
    setTimeout(next, 500);
  }

  startGame();
}
