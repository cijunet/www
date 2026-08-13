// assets/js/games.js — 「诗趣游戏」栏目
// 栏目页：[data-games-index] 渲染 段位徽章 + 每日挑战 + 4 个玩法卡片 + 错题本
// 玩法页：/?g=fill|feihua|rebuild|scene|daily 由各玩法引擎接管（query 驱动，同原文详情页模式）
import { fetchJSON } from './hashsearch.js';
import { esc } from './util.js';
import { baseHref } from './util.js';
import { getRankState, rankOf, nextRank, rankBadge, getMistakes, clearMistakes } from './game-common.js';

let _games = null;

export async function ensureGames() {
  if (_games) return _games;
  const R = baseHref();
  _games = await fetchJSON(R, 'games.json');
  return _games;
}

const GAMES = [
  { id: 'fill',    icon: '✍', name: '填空挖字', tag: '记忆', desc: '上句给你，下句挖了两个字的空。从字块里挑对的补回去，名篇在前、冷门在后。', color: 'cinnabar' },
  { id: 'guess',   icon: '🔮', name: '诗谜', tag: '推理', desc: '汉兜式猜句：自由输入一句五言或七言诗，逐字给「字格+拼音」双重反馈，六次猜中今日名句。', color: 'teal' },
  { id: 'feihua',  icon: '🎐', name: '飞花令 · 对句', tag: '对句', desc: '给出含关键字诗句的半句，你补出另一半——自由输入，每句 45 秒，考的是储备不是手速。', color: 'indigo' },
  { id: 'rebuild', icon: '🧩', name: '拼句成篇', tag: '原文', desc: '一首诗的句子被拆散，还混进一句别人的。按原顺序拼回去，还原整篇。', color: 'gold' },
  { id: 'lianju',  icon: '🀄', name: '连词成句', tag: '语感', desc: '一句诗被切成词块还混进一块别人的，按语感拼回原句——比拼句更细，考对仗与虚词。', color: 'navy' },
  { id: 'scene',   icon: '🌿', name: '猜场景', tag: '场景', desc: '一句诗，四个生活场景，猜它最适合用在哪一刻。答完有讲解，答错进错题本。', color: 'plum' },
];
// 可路由玩法：6 卡片 + 每日挑战
const VALID = [...GAMES.map(g => g.id), 'daily'];

function ymd() {
  const n = new Date();
  return n.getFullYear() * 10000 + (n.getMonth() + 1) * 100 + n.getDate();
}

// 段位徽章条：当前段位 + 总星 + 距下一级进度
export function renderRankBar(root) {
  const el = root.querySelector('[data-games-rank]');
  if (!el) return;
  const st = getRankState();
  const cur = rankOf(st.stars);
  const nx = nextRank(st.stars);
  const prog = nx ? Math.min(1, (st.stars - cur.min) / Math.max(1, nx.min - cur.min)) : 1;
  el.hidden = false;
  el.innerHTML = `<div class="g-rank-inner">${rankBadge(st, 'lg')}
    <span class="g-rank-plays">已玩 ${st.plays} 局</span>
    <span class="g-rank-next">${nx ? `距「${nx.name}」还需 ${Math.max(0, nx.min - st.stars)}★` : '已达最高段位'}</span>
    <span class="g-rank-prog"><i style="width:${Math.round(prog * 100)}%"></i></span>
  </div>`;
}

// 每日挑战 banner：已玩 → 打勾；未玩 → 入口
export function renderDaily(root) {
  const el = root.querySelector('[data-games-daily]');
  if (!el) return;
  const R = baseHref();
  const key = 'ciju.daily.' + ymd();
  let done = null;
  try { done = localStorage.getItem(key); } catch {}
  el.innerHTML = done != null
    ? `<a class="g-daily done" href="${R}games/?g=daily">
        <b>今日挑战</b><span class="g-daily-check">✓ 今日已完成 · ${'★'.repeat(Math.min(3, Number(done) || 0))}</span>
        <em>再刷一局冲更高星 ›</em>
      </a>`
    : `<a class="g-daily" href="${R}games/?g=daily">
        <b>今日挑战</b><span class="g-daily-new">每天 5 题，答完得星</span>
        <em>开始今天的挑战 ›</em>
      </a>`;
}

// 错题本：句子 + 怎么用 + 出处 + 清空
export function renderMistakes(root) {
  const el = root.querySelector('[data-games-mistakes]');
  if (!el) return;
  const list = getMistakes();
  if (!list.length) return;
  el.hidden = false;
  el.innerHTML = `<h3 class="g-mist-title">错题本 <span>（答错的句子，点进原文看看）</span></h3>
    <ul class="g-mist-list">
      ${list.slice(0, 12).map(m => `<li>
        <p class="g-mist-t">${esc(m.t)}${m.w ? `<span class="g-mist-src">— ${esc(m.a || '佚名')}《${esc(m.w)}》</span>` : ''}</p>
        ${m.n ? `<p class="g-mist-n">怎么用：${esc(m.n)}</p>` : ''}
        <p class="g-mist-links">${m.w ? `<a class="g-wlink" href="${R}works/?w=${encodeURIComponent(m.w)}">查看原文 ↗</a>` : ''}${m.s ? `<a class="g-wlink" href="${R}scenes/?id=${m.s}">这个场景 ↗</a>` : ''}</p>
      </li>`).join('')}
    </ul>
    <p class="g-mist-clear"><button type="button" class="g-btn ghost sm" data-mist-clear>清空错题本</button></p>`;
  const btn = el.querySelector('[data-mist-clear]');
  if (btn) btn.onclick = () => { clearMistakes(); el.hidden = true; };
}

export function mountGamesIndex() {
  const root = document.querySelector('[data-games-index]');
  if (!root) return;
  (async () => {
    try {
      const g = await ensureGames();
      const stat = root.querySelector('[data-games-stat]');
      if (stat) {
        stat.textContent = `题库就绪：填空 ${g.meta.fill} 题 · 飞花令 ${g.meta.feihua} 个字 · 拼句 ${g.meta.rebuild} 篇 · 猜场景 ${g.meta.scene} 题 · 诗谜 3000 句`;
        stat.classList.add('ok');
      }
      renderRankBar(root);
      renderDaily(root);
      const st = getRankState();
      const box = root.querySelector('#g-results');
      if (box) {
        const R = baseHref();
        box.innerHTML = `<div class="g-grid">
          ${GAMES.map((gm, i) => {
            const best = st.best[gm.id] || 0;
            return `<a class="g-card g-${gm.color}" href="${R}games/?g=${gm.id}" style="--gi:${i}">
            <span class="g-icon" aria-hidden="true">${gm.icon}</span>
            <b>${esc(gm.name)}</b>
            <em class="g-tag">${esc(gm.tag)}</em>
            <p>${esc(gm.desc)}</p>
            <span class="g-go">开始 ›</span>
            <span class="g-best" title="历史最佳">${best ? '★ '.repeat(best) + '<i>' + '★'.repeat(3 - best) + '</i>' : '未玩过'}</span>
          </a>`;
          }).join('')}
        </div>
        <p class="g-note">题库来自站内 ${esc(String(g.meta.fill + g.meta.rebuild + g.meta.scene))}+ 道题与 3000 句诗谜，全部出自收录的好词好句与原文。答对答错都有讲解，答错的自动进错题本。</p>`;
      }
      renderMistakes(root);
    } catch (e) {
      const stat = root.querySelector('[data-games-stat]');
      if (stat) stat.textContent = '题库加载失败：' + e.message;
    }
  })();
}

// 玩法路由：/games/?g=xxx → 渲染对应玩法引擎（复用共享 #detail-root，同原文详情页模式）
export function mountGame(root = document) {
  const sp = new URLSearchParams(location.search);
  const g = sp.get('g');
  const p = location.pathname.replace(/index\.html$/, '/');
  if (!p.endsWith('games/') || !g || !VALID.includes(g)) return;
  const droot = root.querySelector('#detail-root');
  if (!droot) return;
  // 隐藏栏目页骨架（与详情页同款 hideChrome）
  document.querySelectorAll('.hero,.page-hero').forEach(e => e.hidden = true);
  const idx = root.querySelector('#hub-index');
  if (idx) idx.hidden = true;
  droot.hidden = false;
  droot.innerHTML = '<p class="s-status">正在开局…</p>';
  (async () => {
    try {
      const data = await ensureGames();
      const mod = await import(/* webpackIgnore: true */ `./game-${g}.js`);
      if (mod && typeof mod.render === 'function') await mod.render(droot, data, baseHref());
      else droot.innerHTML = `<p class="empty">玩法加载失败。</p>`;
    } catch (e) {
      droot.innerHTML = `<p class="empty">玩法加载失败：${esc(String(e && e.message || e))}</p>`;
    }
  })();
}
