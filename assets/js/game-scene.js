// assets/js/game-scene.js — 玩法④：猜场景（升级：难度爬坡 + 星级结算 + 讲解闭环）
// 一句诗 + 四个生活场景（正确 + 同大类干扰），答对显示场景描述与出处；答完展示「怎么用/白话」。
import { esc } from './util.js';
import { sfx, burst, shuffle, scoreBar, wrap, tierOrder, settleGame, starHTML, rankBadge, recordFor, explainBox, recordMistake, reviewHTML, reviewButton, fmtElapsed, moreLink } from './game-common.js';
import { loadMeta } from './meta.js';

export async function render(root, data, R) {
  const ui = wrap(root, '猜场景');
  const meta = await loadMeta();
  const scenes = meta.scenes || {};
  const score = scoreBar(ui.play, { max: 100 });
  const pool = tierOrder(shuffle(data.scene).slice(0, 10));
  let idx = 0, cur = 0, combo = 0, correct = 0, lock = false;
  const items = [];  // 本局回顾

  function load() {
    if (idx >= pool.length) return done();
    const q = pool[idx];
    lock = false;
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<p class="g-qtext">${esc(q.t)}</p><p class="g-scene-q">这句最适合用在哪一刻？</p>`;
    const opts = q.opts.map(sid => scenes[sid] ? scenes[sid].name : sid);
    ui.opts.innerHTML = opts.map((o, i) => `<button type="button" class="g-chip wide" data-i="${i}">${esc(o)}</button>`).join('');
    ui.src.textContent = `第 ${idx + 1} / ${pool.length} 题`;
    ui.opts.querySelectorAll('.g-chip').forEach((btn, i) => btn.onclick = () => check(i, q, btn));
  }

  async function check(i, q, btn) {
    if (lock) return;
    lock = true;
    const ok = i === q.ans;
    items.push({ t: q.t, a: q.au, w: q.w, ok });
    ui.opts.querySelectorAll('.g-chip').forEach(b => b.disabled = true);
    const sid = q.opts[q.ans];
    const sc = scenes[sid];
    if (ok) {
      combo++; cur += 10 + Math.min(combo - 1, 5); correct++;
      score.set(cur, combo);
      sfx.combo(combo);
      burst(btn, 'gold');
      btn.classList.add('right');
      // 答案显示在讲解上方
      ui.fb.innerHTML = `<p class="g-ans">✓ 最适合「${sc ? sc.name : sid}」</p><p class="g-ans-src">${q.au ? esc(q.au) : ''}${q.w ? '《' + esc(q.w) + '》' : ''} <a class="g-wlink" href="${R}scenes/?id=${sid}">看这个场景 ↗</a></p>`;
      ui.src.textContent = '';
    } else {
      combo = 0;
      score.set(cur, 0);
      sfx.wrong();
      btn.classList.add('shake');
      const rightBtn = ui.opts.querySelectorAll('.g-chip')[q.ans];
      rightBtn.classList.add('right');
      ui.fb.innerHTML = `<p class="g-ans">✗ 答案是「${sc ? sc.name : sid}」</p>${q.au ? `<p class="g-ans-src">${esc(q.au)}${q.w ? '《' + esc(q.w) + '》' : ''}</p>` : ''}`;
      ui.src.textContent = '';
    }
    // 讲解闭环（追加到答案下方）
    const rec = await recordFor(q.gid);
    if (rec) {
      ui.fb.innerHTML += (sc && sc.desc ? `<p class="g-sc-desc">${esc(sc.desc)}</p>` : '') + explainBox(rec, R, { wrong: !ok });
      if (!ok) recordMistake(rec, 'scene');
    } else {
      ui.fb.innerHTML += (sc && sc.desc ? `<p class="g-sc-desc">${esc(sc.desc)}</p>` : '') + explainBox({ t: q.t, a: q.au, w: q.w }, R, { wrong: !ok });
      if (!ok) recordMistake({ t: q.t, a: q.au, w: q.w, n: '', x: '' }, 'scene');
    }
    // 同场景延伸：答对后展示该场景还能用的句子
    if (ok && q.related && q.related.length) {
      const rel = [];
      for (const gid of q.related) {
        const r2 = await recordFor(gid);
        if (r2 && r2.t) rel.push(r2.t);
      }
      if (rel.length) ui.fb.innerHTML += `<p class="g-sc-more">这个场景还能用：<b>${rel.map(esc).join('</b> · <b>')}</b></p>`;
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
    const st = settleGame('scene', stars);
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<div class="g-done"><b>猜完 10 句</b>
      <p>答对 <em>${correct}</em> / 10${starHTML(stars)}<span class="g-done-time">用时 ${fmtElapsed(ui.elapsed())}</span></p>
      <div class="g-done-rank">${rankBadge(st)}${st.broke ? '<span class="g-broke">新纪录 +' + st.gain + '★</span>' : ''}</div>
      <div class="g-done-btns"><button type="button" class="g-btn">再来一局</button>${reviewButton()}${moreLink(R)}</div></div>`;
    ui.opts.innerHTML = '';
    ui.src.textContent = '';
    const restart = () => { idx = 0; cur = 0; combo = 0; correct = 0; score.set(0, 0); items.length = 0; load(); };
    ui.play.querySelector('.g-btn').onclick = restart;
    const rv = ui.play.querySelector('[data-review]');
    if (rv) rv.onclick = () => {
      ui.stage.innerHTML = `<div class="g-done"><b>本局回顾</b>${reviewHTML(items)}<button type="button" class="g-btn" data-again2>再来一局</button>${moreLink(R)}</div>`;
      ui.play.querySelector('[data-again2]').onclick = restart;
    };
  }

  load();
}
