// assets/js/game-rebuild.js — 玩法⑤：拼句成篇（升级：难度爬坡 + 星级结算 + 原文闭环）
// 一首诗的句子打乱 + 混入 1 句干扰，按原顺序点选还原；3 次点错机会。每局 8 篇：短篇在前、长篇在后。
import { esc, norm } from './util.js';
import { sfx, burst, shuffle, wrap, settleGame, starHTML, rankBadge, reviewHTML, reviewButton, fmtElapsed, moreLink } from './game-common.js';

export function render(root, data, R) {
  const ui = wrap(root, '拼句成篇');
  const pool = shuffle(data.rebuild).slice(0, 8).sort((a, b) => a.lines.length - b.lines.length);
  let idx = 0, lives = 3, cur = 0, perfect = true, fails = 0, hints = 2;
  const items = [];  // 本局回顾

  function load() {
    if (idx >= pool.length) return done();
    const q = pool[idx];
    const all = shuffle([...q.lines, q.intruder]);
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<p class="g-rb-title">《${esc(q.w)}》 · ${esc(q.au || '佚名')}<span class="g-rb-sub">按原顺序拼出这首诗（混入了一句别人的）</span></p>`;
    ui.opts.innerHTML = `${hints > 0 ? `<button type="button" class="g-btn ghost sm g-hint-btn" data-hint>💡 提示（剩 ${hints} 次）</button>` : ''}
      <div class="g-rb-pool">${all.map((s, k) => `<button type="button" class="g-rb-card" data-k="${k}">${esc(s)}</button>`).join('')}</div>`;
    ui.src.innerHTML = `<span class="g-lives">生命 ×${lives}</span> <span class="g-score-cur2">${cur} 分</span>`;
    const correct = q.lines.slice();
    let pos = 0;
    let hintUsed = false;

    // 提示：自动放对下一张（该篇得分减半）
    const hintBtn = ui.opts.querySelector('[data-hint]');
    if (hintBtn) hintBtn.onclick = () => {
      if (pos >= correct.length) return;
      hints--;
      hintUsed = true;
      const btn = [...ui.opts.querySelectorAll('.g-rb-card')].find(c => !c.classList.contains('used') && norm(c.textContent) === norm(correct[pos]));
      if (btn) btn.click();  // 复用正确点选分支
      hintBtn.disabled = true;
      if (hints > 0) hintBtn.textContent = `💡 提示（剩 ${hints} 次）`; else hintBtn.textContent = '提示已用完';
    };

    const cards = ui.opts.querySelectorAll('.g-rb-card');
    cards.forEach(btn => btn.onclick = () => {
      if (btn.classList.contains('used')) return;
      const expect = correct[pos];
      if (norm(btn.textContent) === norm(expect)) {
        btn.classList.add('used');
        const box = document.createElement('div');
        box.className = 'g-rb-line';
        box.innerHTML = esc(btn.textContent) + (pos === correct.length - 1 ? `<a class="g-wlink" href="${R}works/?w=${encodeURIComponent(q.w)}">查看原文 ↗</a>` : '');
        ui.stage.appendChild(box);
        pos++;
        cur += hintUsed ? 5 : 10;   // 用过提示的篇得分减半
        sfx.right();
        if (pos === correct.length) {
          items.push({ t: q.lines.join('，'), a: q.au, w: q.w, ok: lives > 0 });
          const intr = [...cards].find(c => !c.classList.contains('used'));
          if (intr) { intr.classList.add('intr'); intr.textContent = '（干扰句）' + intr.textContent; }
          ui.src.innerHTML = `<span class="g-lives">生命 ×${lives}</span> <span class="g-score-cur2">${cur} 分</span> ✓ 拼成！`;
          sfx.win();
          burst(ui.stage, 'gold');
          // 答案已展示，等用户点「下一题」再切换
          const nx = document.createElement('button');
          nx.type = 'button'; nx.className = 'g-btn g-next'; nx.textContent = '下一题 →';
          nx.onclick = () => { idx++; load(); };
          ui.opts.innerHTML = '';
          ui.opts.appendChild(nx);
        }
      } else {
        lives--; fails++; perfect = false;
        sfx.wrong();
        burst(btn, 'ink');
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 420);
        if (lives <= 0) {
          items.push({ t: q.lines.join('，'), a: q.au, w: q.w, ok: false });  // 命尽跳过也进回顾
          cards.forEach(c => c.disabled = true);
          ui.src.innerHTML = `<span class="g-lives bad">生命耗尽</span> 正确顺序：${correct.map(esc).join('｜')}`;
          // 答案已展示，等用户点「下一题」（生命恢复 3 条）
          const nx2 = document.createElement('button');
          nx2.type = 'button'; nx2.className = 'g-btn g-next'; nx2.textContent = '下一题 →';
          nx2.onclick = () => { idx++; lives = 3; load(); };
          ui.opts.innerHTML = '';
          ui.opts.appendChild(nx2);
        } else {
          ui.src.innerHTML = `<span class="g-lives">生命 ×${lives}</span> <span class="g-score-cur2">${cur} 分</span>`;
        }
      }
    });
  }

  function done() {
    sfx.win();
    const stars = fails === 0 ? 3 : fails <= 1 ? 2 : fails <= 2 ? 1 : 0;
    const st = settleGame('rebuild', stars);
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<div class="g-done"><b>拼完了 ${pool.length} 篇</b>
      <p>本局得分 <em>${cur}</em>${starHTML(stars)}<span class="g-done-time">用时 ${fmtElapsed(ui.elapsed())}</span></p>
      <div class="g-done-rank">${rankBadge(st)}${st.broke ? '<span class="g-broke">新纪录 +' + st.gain + '★</span>' : ''}</div>
      <div class="g-done-btns"><button type="button" class="g-btn">再来一局</button>${reviewButton()}${moreLink(R)}</div></div>`;
    ui.opts.innerHTML = '';
    const restart = () => { idx = 0; lives = 3; cur = 0; fails = 0; perfect = true; hints = 2; items.length = 0; load(); };
    ui.play.querySelector('.g-btn').onclick = restart;
    const rv = ui.play.querySelector('[data-review]');
    if (rv) rv.onclick = () => {
      ui.stage.innerHTML = `<div class="g-done"><b>本局回顾</b>${reviewHTML(items)}<button type="button" class="g-btn" data-again2>再来一局</button>${moreLink(R)}</div>`;
      ui.play.querySelector('[data-again2]').onclick = restart;
    };
  }

  load();
}
