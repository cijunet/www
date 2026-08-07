// 二十四节气文化专题页（第六轮 W10）—— 独立模块，避免改动 pages.mjs
import { layout, cardListByScene } from './templates.mjs';
import { esc } from './util.mjs';
import { JQ } from './_jq_data.mjs';

const R1 = '../';
const R2 = '../../';

export function jqPage(D, j) {
  const sid = j.scene || j.id;
  const scene = D.scenes.find(s => s.id === sid);
  const list = D.bySceneMap[sid] || [];
  const desc = `${j.name}节气：${j.desc} 收录 ${list.length} 条节气词句，附三候、民俗与农谚。`;
  const i = JQ.indexOf(j);
  const prev = JQ[(i + 23) % 24], next = JQ[(i + 1) % 24];
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <a href="${R2}jq/">二十四节气</a> › <span>${esc(j.name)}</span></nav>
    <h1>${esc(j.name)}</h1>
    <p class="lead">${esc(j.date)} · ${esc(j.desc)}</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  <div class="jq-culture">
    <div class="jq-item"><b>三候</b><span>${esc(j.time)}</span></div>
    <div class="jq-item"><b>民俗</b><span>${esc(j.folk)}</span></div>
    <div class="jq-item"><b>农谚</b><span>${esc(j.proverb)}</span></div>
    <div class="jq-item"><b>饮食</b><span>${esc(j.food)}</span></div>
  </div>
  ${scene ? `<p class="jq-link">相关场景：<a href="${R2}s/${sid}/">${esc(scene.name)}（${list.length} 句）</a></p>` : ''}
  ${list.length ? cardListByScene(list, D, R2) : '<p class="lead">词句整理中…</p>'}
  <div class="jq-nav">
    <a class="chip" href="${R2}jq/${prev.id}/">← ${esc(prev.name)}</a>
    <a class="chip" href="${R2}jq/${next.id}/">${esc(next.name)} →</a>
  </div>
</div>`;
  return layout({ depth: 2, title: `${j.name} · 二十四节气`, desc, canonical: `jq/${j.id}/`, hero, content, bodyClass: 'page-jq' });
}

export function jqIndexPage(D) {
  const byS = new Map();
  D.pieces.forEach(p => (p.s || []).forEach(s => byS.set(s, (byS.get(s) || 0) + 1)));
  const desc = '二十四节气文化专题：每个节气的三候、民俗、农谚、饮食与对应词句，按日期顺时翻阅。';
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <span>二十四节气</span></nav>
    <h1>二十四节气</h1>
    <p class="lead">岁时流转，节气是中国人刻在时间里的诗。</p>
  </div>
</section>`;
  const cards = JQ.map(j => {
    const sid = j.scene || j.id;
    const n = byS.get(sid) || 0;
    return `<a class="jq-card" href="${R1}jq/${j.id}/"><b>${esc(j.name)}</b><em>${esc(j.date)}</em><span>${esc(j.time.split('·')[0])}</span><small>${n} 句</small></a>`;
  }).join('');
  const now = new Date();
  const content = `<div class="wrap"><div class="jq-grid">${cards}</div>
  <p class="jq-tip">今天是 ${esc(now.getMonth() + 1)} 月 ${esc(now.getDate())} 日——看看你正走在哪个节气里。</p>
</div>`;
  return layout({ depth: 1, title: '二十四节气', desc, canonical: 'jq/', hero, content, bodyClass: 'page-jq-index' });
}
