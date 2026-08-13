// assets/js/game-fill.js — 玩法①：填空挖字（升级：难度爬坡 + 星级结算 + 答题讲解）
// 题干：上句，前段 + __ + 后段。8 个字块（2 答案 + 6 干扰），点选填入两格。
// 每局 10 题：名篇（作品收录多）在前、冷门在后；每题答完展示「怎么用/白话/出处」；答错进错题本。
import { esc } from './util.js';
import { sfx, burst, shuffle, scoreBar, wrap, tierOrder, settleGame, starHTML, rankBadge, recordFor, explainBox, recordMistake, reviewHTML, reviewButton, fmtElapsed, moreLink } from './game-common.js';

export async function render(root, data, R) {
  const ui = wrap(root, '填空挖字');
  const score = scoreBar(ui.play, { max: 100 });
  const pool = tierOrder(shuffle(data.fill).slice(0, 10));
  let idx = 0, cur = 0, combo = 0, slot = 0, picks = [], errs = 0, correct = 0, lock = false, hints = 2, hintUsed = false;
  const items = [];  // 本局回顾

  function load() {
    if (idx >= pool.length) return done();
    const q = pool[idx];
    lock = false; hintUsed = false;
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<p class="g-qtext">${esc(q.q)}</p>`;
    // 注意：build 侧挖 2 字生成的是一个「__」占位 → 展开成两个相邻空位（分别填 2 字答案）
    ui.stage.querySelector('.g-qtext').innerHTML = esc(q.q).replace('__', '<span class="g-blank" data-slot="0"></span><span class="g-blank" data-slot="1"></span>');
    const chips = shuffle(q.opts.split(''));
    ui.opts.innerHTML = `${hints > 0 ? `<button type="button" class="g-btn ghost sm g-hint-btn" data-hint>💡 提示（剩 ${hints} 次）</button>` : ''}
      <div class="g-fill-chips">${chips.map((c, i) => `<button type="button" class="g-chip" data-c="${esc(c)}" data-i="${i}">${esc(c)}</button>`).join('')}</div>`;
    ui.src.textContent = `第 ${idx + 1} / ${pool.length} 题`;
    slot = 0; picks = [];
    bindChips();
    // 提示按钮：把当前空位的正确答案自动填上（该题判对时得分减半）
    const hintBtn = ui.opts.querySelector('[data-hint]');
    if (hintBtn) hintBtn.onclick = () => {
      if (lock || slot >= 2) return;
      hints--;
      hintUsed = true;
      const btn = [...ui.opts.querySelectorAll('.g-chip')].find(x => x.dataset.c === q.a[slot]);
      if (btn) btn.click();  // 复用正确点选分支
      hintBtn.disabled = true;
      if (hints > 0) hintBtn.textContent = `💡 提示（剩 ${hints} 次）`; else hintBtn.textContent = '提示已用完';
    };
    ui.opts.querySelectorAll('.g-chip').forEach(b => b.disabled = false);
    ui.stage.querySelectorAll('.g-blank').forEach(b => b.textContent = '');
  }

  function bindChips() {
    ui.opts.querySelectorAll('.g-chip').forEach(btn => {
      btn.onclick = () => {
        if (lock) return;
        const blanks = ui.stage.querySelectorAll('.g-blank');
        const c = btn.dataset.c;
        blanks[slot].textContent = c;
        blanks[slot].dataset.v = c;
        picks[slot] = c;
        btn.disabled = true;
        btn.classList.add('used');
        slot++;
        if (slot === 2) check();
      };
    });
    // 点空格可撤销
    ui.stage.querySelectorAll('.g-blank').forEach(b => {
      b.onclick = () => {
        if (lock) return;
        const s = Number(b.dataset.slot);
        if (b.textContent && s === slot - 1) {
          const c0 = b.textContent;
          b.textContent = ''; delete b.dataset.v;
          picks[s] = null; slot--;
          const btn = [...ui.opts.querySelectorAll('.g-chip')].find(x => x.dataset.c === c0);
          if (btn) { btn.disabled = false; btn.classList.remove('used'); }
        }
      };
    });
  }

  async function check() {
    const q = pool[idx];
    const okAns = picks.join('') === q.a;
    items.push({ t: q.q.replace('__', q.a), a: q.au, w: q.w, ok: okAns });
    lock = true;
    ui.opts.querySelectorAll('.g-chip').forEach(b => b.disabled = true);
    const blanks = ui.stage.querySelectorAll('.g-blank');
    if (okAns) {
      combo++;
      const base = hintUsed ? 5 : 10;   // 用过提示的题得分减半
      cur += base + Math.min(combo - 1, 5); correct++;
      score.set(cur, combo);
      sfx.combo(combo);
      burst(ui.stage, 'gold');
      blanks[0].classList.add('right'); blanks[1].classList.add('right');
      // 答案显示在讲解上方
      ui.fb.innerHTML = `<p class="g-ans">✓ 「${esc(q.q)}」</p><p class="g-ans-src">— ${esc(q.au || '佚名')}《${esc(q.w)}》<a class="g-wlink" href="${R}works/?w=${encodeURIComponent(q.w)}">查看原文 ↗</a></p>`;
      ui.src.textContent = '';
    } else {
      combo = 0; errs++;
      score.set(cur, 0);
      sfx.wrong();
      burst(ui.stage, 'ink');
      ui.stage.classList.add('shake');
      setTimeout(() => ui.stage.classList.remove('shake'), 420);
      const a2 = q.a.split('');
      blanks[0].textContent = a2[0]; blanks[0].classList.add('right');
      blanks[1].textContent = a2[1]; blanks[1].classList.add('right');
      ui.fb.innerHTML = `<p class="g-ans">✗ 答案是「${esc(q.a)}」</p>${q.w ? `<p class="g-ans-src">— ${esc(q.au || '佚名')}《${esc(q.w)}》</p>` : ''}`;
      ui.src.textContent = '';
    }
    // 讲解闭环：怎么用/白话/出处（按 gid 取记录），追加到答案下方
    const rec = await recordFor(q.gid);
    if (rec) {
      ui.fb.innerHTML += explainBox(rec, R, { wrong: !okAns });
      if (!okAns) recordMistake(rec, 'fill');
    } else if (q.n) {
      ui.fb.innerHTML += explainBox({ n: q.n, a: q.au, w: q.w, d: q.d }, R);
      if (!okAns) recordMistake({ t: q.q.replace(/__/g, q.a), a: q.au, w: q.w, n: q.n, x: '' }, 'fill');
    }
    // 答案已展示，等用户点「下一题」再切换
    const nx = document.createElement('button');
    nx.type = 'button'; nx.className = 'g-btn g-next'; nx.textContent = '下一题 →';
    nx.onclick = () => { idx++; load(); };
    ui.opts.innerHTML = '';
    ui.opts.appendChild(nx);
  }

  function done() {
    sfx.win();
    const stars = correct >= 9 ? 3 : correct >= 7 ? 2 : correct >= 5 ? 1 : 0;
    const st = settleGame('fill', stars);
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<div class="g-done"><b>第 10 题完成</b>
      <p>答对 <em>${correct}</em> / 10${starHTML(stars)}<span class="g-done-time">用时 ${fmtElapsed(ui.elapsed())}</span></p>
      <div class="g-done-rank">${rankBadge(st)}${st.broke ? '<span class="g-broke">新纪录 +' + st.gain + '★</span>' : ''}</div>
      <div class="g-done-btns"><button type="button" class="g-btn">再来一局</button>${reviewButton()}${moreLink(R)}</div></div>`;
    ui.opts.innerHTML = '';
    ui.src.textContent = '';
    const restart = () => { idx = 0; cur = 0; combo = 0; errs = 0; correct = 0; hints = 2; score.set(0, 0); items.length = 0; load(); };
    ui.play.querySelector('.g-btn').onclick = restart;
    const rv = ui.play.querySelector('[data-review]');
    if (rv) rv.onclick = () => {
      ui.stage.innerHTML = `<div class="g-done"><b>本局回顾</b>${reviewHTML(items)}<button type="button" class="g-btn" data-again2>再来一局</button>${moreLink(R)}</div>`;
      ui.play.querySelector('[data-again2]').onclick = restart;
    };
  }

  load();
}
