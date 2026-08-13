// assets/js/game-daily.js — 玩法：每日挑战
// 每天 5 题（3 填空 + 2 猜场景），按日期确定性抽取（mulberry32 seed=YYYYMMDD）→ 同一天题库固定。
// 全部答完按正确率给星；完成后在栏目页标记「今日已完成」。星级计入段位（daily）。
import { esc } from './util.js';
import { sfx, burst, shuffle, wrap, settleGame, starHTML, rankBadge, recordFor, explainBox, recordMistake, reviewHTML, reviewButton, mulberry32, fmtElapsed, moreLink } from './game-common.js';
import { loadMeta } from './meta.js';

const pickN = (arr, n, rnd) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};

export async function render(root, data, R) {
  const ui = wrap(root, '每日挑战');
  const meta = await loadMeta();
  const scenes = meta.scenes || {};
  const now = new Date();
  const ymd = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const rnd = mulberry32(ymd);
  // 5 题：3 填空 + 2 猜场景，交错排列（fill, scene, fill, scene, fill）
  const fills = pickN(data.fill, 3, rnd);
  const scenesQ = pickN(data.scene, 2, rnd);
  const quiz = [];
  for (let i = 0; i < 5; i++) quiz.push(i % 2 === 0 ? { kind: 'fill', q: fills[i >> 1] } : { kind: 'scene', q: scenesQ[i >> 1] });

  let idx = 0, correct = 0, lock = false;
  const items = [];  // 本局回顾

  const DONE_KEY = 'ciju.daily.' + ymd;

  function load() {
    if (idx >= quiz.length) return done();
    lock = false;
    ui.fb.innerHTML = '';
    const item = quiz[idx];
    const q = item.q;
    if (item.kind === 'fill') {
      ui.stage.innerHTML = `<p class="g-qtext">${esc(q.q)}</p>`;
      ui.stage.querySelector('.g-qtext').innerHTML = esc(q.q).replace('__', '<span class="g-blank" data-slot="0"></span><span class="g-blank" data-slot="1"></span>');
      const chips = shuffle(q.opts.split(''));
      ui.opts.innerHTML = chips.map((c, i) => `<button type="button" class="g-chip" data-c="${esc(c)}">${esc(c)}</button>`).join('');
      ui.src.textContent = `每日挑战 ${idx + 1} / 5 · 填空`;
      let slot = 0; const picks = [];
      const blanks = ui.stage.querySelectorAll('.g-blank');
      ui.opts.querySelectorAll('.g-chip').forEach(btn => {
        btn.onclick = () => {
          if (lock) return;
          const c = btn.dataset.c;
          blanks[slot].textContent = c; picks[slot] = c;
          btn.disabled = true; btn.classList.add('used');
          slot++;
          if (slot === 2) judge('fill', q, picks.join('') === q.a, blanks);
        };
      });
      blanks.forEach((b, bi) => b.onclick = () => {
        if (lock || !b.textContent || bi !== slot - 1) return;
        const c0 = b.textContent; b.textContent = ''; picks[bi] = null; slot--;
        const btn = [...ui.opts.querySelectorAll('.g-chip')].find(x => x.dataset.c === c0);
        if (btn) { btn.disabled = false; btn.classList.remove('used'); }
      });
    } else {
      const opts = q.opts.map(sid => scenes[sid] ? scenes[sid].name : sid);
      ui.stage.innerHTML = `<p class="g-qtext">${esc(q.t)}</p><p class="g-scene-q">这句最适合用在哪一刻？</p>`;
      ui.opts.innerHTML = opts.map((o, i) => `<button type="button" class="g-chip wide" data-i="${i}">${esc(o)}</button>`).join('');
      ui.src.textContent = `每日挑战 ${idx + 1} / 5 · 猜场景`;
      ui.opts.querySelectorAll('.g-chip').forEach((btn, i) => btn.onclick = () => judge('scene', q, i === q.ans, null, i));
    }
  }

  async function judge(kind, q, ok, blanks, optIdx) {
    if (lock) return;
    lock = true;
    items.push({ t: kind === 'fill' ? q.q.replace('__', q.a) : q.t, a: q.au, w: q.w, ok });
    ui.opts.querySelectorAll('.g-chip').forEach(b => b.disabled = true);
    if (ok) { correct++; sfx.combo(correct); burst(ui.stage, 'gold'); }
    else { sfx.wrong(); burst(ui.stage, 'ink'); ui.stage.classList.add('shake'); setTimeout(() => ui.stage.classList.remove('shake'), 420); }
    // 反馈
    if (kind === 'fill') {
      const a2 = q.a.split('');
      if (blanks) { blanks[0].textContent = a2[0]; blanks[1].textContent = a2[1]; blanks[0].classList.add('right'); blanks[1].classList.add('right'); }
      // 答案显示在讲解上方（答对=完整句，答错=正确答案）
      ui.fb.innerHTML = `<p class="g-ans">${ok ? '✓ 「' + esc(q.q).replace('__', esc(q.a)) + '」' : '✗ 答案是「' + esc(q.a) + '」'}</p><p class="g-ans-src">— ${esc(q.au || '佚名')}《${esc(q.w)}》</p>`;
      ui.src.textContent = '';
    } else {
      const sid = q.opts[q.ans]; const sc = scenes[sid];
      ui.opts.querySelectorAll('.g-chip')[q.ans].classList.add('right');
      if (!ok && optIdx != null) ui.opts.querySelectorAll('.g-chip')[optIdx].classList.add('shake');
      // 答案显示在讲解上方
      ui.fb.innerHTML = `<p class="g-ans">${ok ? '✓' : '✗'} 答案是「${sc ? sc.name : sid}」</p>${q.au || q.w ? `<p class="g-ans-src">${q.au ? esc(q.au) : ''}${q.w ? '《' + esc(q.w) + '》' : ''}</p>` : ''}`;
      ui.src.textContent = '';
    }
    const rec = await recordFor(q.gid);
    if (rec) {
      ui.fb.innerHTML += explainBox(rec, R, { wrong: !ok });
      if (!ok) recordMistake(rec, 'daily');
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
    const stars = correct >= 4 ? 3 : correct >= 3 ? 2 : correct >= 2 ? 1 : 0;
    const st = settleGame('daily', stars);
    try { localStorage.setItem(DONE_KEY, String(stars)); } catch {}
    ui.fb.innerHTML = '';
    ui.stage.innerHTML = `<div class="g-done"><b>今日挑战完成</b>
      <p>答对 <em>${correct}</em> / 5${starHTML(stars)}<span class="g-done-time">用时 ${fmtElapsed(ui.elapsed())}</span></p>
      <div class="g-done-rank">${rankBadge(st)}${st.broke ? '<span class="g-broke">新纪录 +' + st.gain + '★</span>' : ''}</div>
      <div class="g-done-btns"><button type="button" class="g-btn">再挑战一次</button>${reviewButton()}${moreLink(R)}</div></div>`;
    ui.opts.innerHTML = '';
    ui.src.textContent = '明天有新的 5 题';
    const restart = () => { idx = 0; correct = 0; items.length = 0; load(); };
    ui.play.querySelector('.g-btn').onclick = restart;
    const rv = ui.play.querySelector('[data-review]');
    if (rv) rv.onclick = () => {
      ui.stage.innerHTML = `<div class="g-done"><b>本局回顾</b>${reviewHTML(items)}<button type="button" class="g-btn" data-again2>再挑战一次</button>${moreLink(R)}</div>`;
      ui.play.querySelector('[data-again2]').onclick = restart;
    };
  }

  load();
}
