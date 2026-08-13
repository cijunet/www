// assets/js/game-lianju.js — 玩法：连词成句（词块重组）
// 一句诗（5-8 字）被切成 3-5 个词块 + 混入 1 个干扰词块，玩家按原顺序点选入位。
// 放对 → 固定（绿）；放错 → 回池 + 计错。每局 8 句（短句在前），星级按错误数。
import { esc } from './util.js';
import { sfx, burst, shuffle, wrap, settleGame, starHTML, rankBadge, recordFor, explainBox, reviewHTML, reviewButton, fmtElapsed, moreLink } from './game-common.js';

export async function render(root, data, R) {
  const ui = wrap(root, '连词成句');
  const pool = shuffle(data.lianju || []).slice(0, 8).sort((a, b) => a.order.length - b.order.length);
  if (!pool.length) { ui.stage.innerHTML = '<p class="empty">题库为空。</p>'; return; }
  let idx = 0, cur = 0, fails = 0, hints = 2;
  const items = [];  // 本局回顾

  function load() {
    if (idx >= pool.length) return done();
    const q = pool[idx];
    const slotCount = q.order.length;
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<p class="g-rb-title">拼出这句诗<span class="g-rb-sub">点选词块，按语感排回原句（混入了一个干扰块）</span></p>
      <div class="g-lj-slots">${Array.from({ length: slotCount }, () => `<span class="g-lj-slot"></span>`).join('')}</div>`;
    ui.opts.innerHTML = `${hints > 0 ? `<button type="button" class="g-btn ghost sm g-hint-btn" data-hint>💡 提示（剩 ${hints} 次）</button>` : ''}
      <div class="g-lj-pool">${q.blocks.map((b, k) => `<button type="button" class="g-lj-block" data-k="${k}">${esc(b)}</button>`).join('')}</div>`;
    ui.src.innerHTML = `<span class="g-lives">已错 ${fails} 次</span> <span class="g-score-cur2">${cur} 分</span> <span class="g-lj-prog">第 ${idx + 1} / ${pool.length} 句</span>`;

    const slots = ui.stage.querySelectorAll('.g-lj-slot');
    const blocks = ui.opts.querySelectorAll('.g-lj-block');
    let slot = 0;
    let lock = false;
    let hintUsed = false;

    // 提示：自动放对当前槽位（该句得分减半）
    const hintBtn = ui.opts.querySelector('[data-hint]');
    if (hintBtn) hintBtn.onclick = () => {
      if (lock || slot >= slotCount) return;
      hints--;
      hintUsed = true;
      const btn = [...blocks].find(b => !b.classList.contains('used') && Number(b.dataset.k) === q.order[slot]);
      if (btn) btn.click();  // 复用正确点选分支
      hintBtn.disabled = true;
      if (hints > 0) hintBtn.textContent = `💡 提示（剩 ${hints} 次）`; else hintBtn.textContent = '提示已用完';
    };

    blocks.forEach((btn, k) => {
      btn.onclick = () => {
        if (lock || btn.classList.contains('used')) return;
        if (k === q.order[slot]) {
          // 放对：固定
          btn.classList.add('used');
          const s = slots[slot];
          s.textContent = q.blocks[k];
          s.classList.add('on');
          slot++;
          cur += hintUsed ? 5 : 10;
          sfx.right();
          if (slot === slotCount) {
            lock = true;
            items.push({ t: q.order.map(i => q.blocks[i]).join(''), a: q.au, w: q.w, ok: true });
            const intr = [...blocks].find(b => !b.classList.contains('used'));
            if (intr) { intr.classList.add('intr'); intr.textContent = '（干扰）' + intr.textContent; }
            ui.src.innerHTML = `<span class="g-lives">已错 ${fails} 次</span> <span class="g-score-cur2">${cur} 分</span> ✓ 拼成！「${esc(q.order.map(i => q.blocks[i]).join(''))}」<a class="g-wlink" href="${R}works/?w=${encodeURIComponent(q.w)}">查看原文 ↗</a>`;
            sfx.win();
            burst(ui.stage, 'gold');
            // 讲解闭环
            (async () => {
              const rec = await recordFor(q.gid);
              if (rec) ui.fb.innerHTML = explainBox(rec, R);
            })();
            setTimeout(() => { idx++; load(); }, 2200);
          }
        } else {
          // 放错：回池 + 计错
          fails++;
          sfx.wrong();
          burst(btn, 'ink');
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 420);
          ui.src.innerHTML = `<span class="g-lives">已错 ${fails} 次</span> <span class="g-score-cur2">${cur} 分</span> <span class="g-lj-prog">第 ${idx + 1} / ${pool.length} 句</span>`;
          if (fails >= 4) {
            // 4 次错误：跳过本题，展示答案
            lock = true;
            items.push({ t: q.order.map(i => q.blocks[i]).join(''), a: q.au, w: q.w, ok: false });
            blocks.forEach(b => b.disabled = true);
            q.order.forEach((oi, si) => { slots[si].textContent = q.blocks[oi]; slots[si].classList.add('on'); });
            ui.src.innerHTML = `<span class="g-lives bad">已跳过</span> 正确顺序：${q.order.map(i => q.blocks[i]).join('｜')}`;
            setTimeout(() => { idx++; load(); }, 2200);
          }
        }
      };
    });
  }

  function done() {
    sfx.win();
    const stars = fails === 0 ? 3 : fails <= 2 ? 2 : fails <= 4 ? 1 : 0;
    const st = settleGame('lianju', stars);
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<div class="g-done"><b>拼完了 ${pool.length} 句</b>
      <p>本局得分 <em>${cur}</em>${starHTML(stars)}<span class="g-done-time">用时 ${fmtElapsed(ui.elapsed())}</span></p>
      <div class="g-done-rank">${rankBadge(st)}${st.broke ? '<span class="g-broke">新纪录 +' + st.gain + '★</span>' : ''}</div>
      <div class="g-done-btns"><button type="button" class="g-btn">再来一局</button>${reviewButton()}${moreLink(R)}</div></div>`;
    ui.opts.innerHTML = '';
    const restart = () => { idx = 0; fails = 0; cur = 0; hints = 2; items.length = 0; load(); };
    ui.play.querySelector('.g-btn').onclick = restart;
    const rv = ui.play.querySelector('[data-review]');
    if (rv) rv.onclick = () => {
      ui.stage.innerHTML = `<div class="g-done"><b>本局回顾</b>${reviewHTML(items)}<button type="button" class="g-btn" data-again2>再来一局</button>${moreLink(R)}</div>`;
      ui.play.querySelector('[data-again2]').onclick = restart;
    };
  }

  load();
}
