import { layout, card, cardList, cardListByScene, filterBar } from './templates.mjs';
import { esc } from './util.mjs';
import { SITE } from './site.config.mjs';
import { JQ } from './_jq_data.mjs';

const R1 = '../', R2 = '../../';

/* ── 首页 ───────────────────────────────────── */
export function homePage(D) {
  const R = './';
  // 二十四节气文化数据注入（首页"今日"区块用：节气名/日期/三候/民俗/农谚/饮食）
  const jqScript = `<script>window.__JQ_DATA=${JSON.stringify(JQ.map(j => ({ id: j.id, name: j.name, date: j.date, time: j.time, folk: j.folk, proverb: j.proverb, food: j.food })))}<\/script>`;
  // 服务端只兜底渲染常驻的常用提示词；首页加载后 app.js 会按当天日期重排（时令 + 常用）
  const staples = ['jiaban', 'xiangnian', 'yigeren', 'shengri'];
  const hero = `<section class="hero">
  <div class="wrap">
    <h1>此刻，说句好的</h1>
    <p class="hero-sub">那些说不出口的时刻，这里有现成的一句。</p>
    <div class="hero-search-wrap" data-nearme>
      <form class="hero-search" action="${R}search/" method="get">
        <input type="search" name="q" placeholder="你现在是什么处境？" aria-label="搜索词句">
        <button type="submit">找一句</button>
        <button type="button" class="hs-geo" data-geo-btn title="按你所在的地方找诗句" aria-label="按地点找诗句">📍</button>
      </form>
      <div class="nm-out" data-geo-out></div>
    </div>
    <div class="hero-hot">
      ${staples.map(id => D.sceneMap[id] ? `<a href="${R}s/${id}/">${esc(D.sceneMap[id].name)}</a>` : '').join('')}
      <button class="hot-random" type="button" data-random>随便来一句</button>
    </div>
    <div class="random-box" data-random-box hidden></div>
    <section class="today" data-today hidden></section>
  </div>
</section>`;

  const content = `<div class="wrap">
${D.scenesByGroup.map(g => `<section class="g-block">
  <h2 class="g-title"><a href="${R}g/${g.id}/">${esc(g.name)}</a><span>${esc(g.tag)}</span></h2>
  <div class="s-grid">
    ${g.scenes.map(s => `<a class="s-card" href="${R}s/${s.id}/">
      <b>${esc(s.name)}</b>
      <i>${esc(s.desc)}</i>
      <em>${D.bySceneMap[s.id].length} 句</em>
    </a>`).join('')}
  </div>
</section>`).join('')}

<section class="g-block">
  <h2 class="g-title"><a href="${R}moods/">按心情找</a><span>不知道该归到哪个场景时，从情绪进</span></h2>
  <div class="m-grid">
    ${D.moods.map(m => `<a class="m-card" href="${R}m/${m.id}/"><b>${esc(m.name)}</b><i>${esc(m.desc)}</i><em>${D.byMoodMap[m.id].length}</em></a>`).join('')}
  </div>
</section>

<section class="g-block">
  <h2 class="g-title"><a href="${R}places/">按地点找</a><span>同一句诗，写在江南是软的，写在塞外是硬的</span></h2>
  <div class="m-grid">
    ${D.places.map(pl => `<a class="m-card" href="${R}p/${pl.id}/"><b>${esc(pl.name)}</b><i>${esc(pl.desc)}</i><em>${D.byPlaceMap[pl.id].length}</em></a>`).join('')}
  </div>
</section>

<section class="g-block">
  <h2 class="g-title"><a href="${R}authors/">收录最多的作者</a><span>点进去看他一个人的句子</span></h2>
  <div class="a-grid">
    ${D.authors.slice(0, 40).map(a => `<a class="a-card" href="${R}a/${a.slug}/">${esc(a.name)}<em>${a.pieces.length}</em></a>`).join('')}
  </div>
</section>
</div>`;

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: SITE.name, description: SITE.desc,
    url: SITE.origin + SITE.base,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: SITE.origin + SITE.base + 'search/?q={search_term_string}' },
      'query-input': 'required name=search_term_string'
    }
  };
  return layout({ depth: 0, title: SITE.name, desc: SITE.desc, canonical: '', hero, content: content + jqScript, jsonld, bodyClass: 'page-home' });
}

/* ── 场景页 ─────────────────────────────────── */
export function scenePage(D, s) {
  const list = D.bySceneMap[s.id];
  const g = D.groupMap[s.g];
  const usedMoods = D.moods.filter(m => list.some(p => p.m.includes(m.id)));
  const sibling = D.scenesByGroup.find(x => x.id === s.g).scenes.filter(x => x.id !== s.id);
  // 个性化 description：情绪关键词 + 精选句预览（272 页自动差异化）
  const moodNames = usedMoods.slice(0, 3).map(m => m.name).join('、');
  const pick = list[0] ? list[0].t.slice(0, 22) + (list[0].t.length > 22 ? '…' : '') : '';
  const desc = `${s.name}（${s.desc || '此刻的处境'}），适合${moodNames ? moodNames + '等' : ''}时刻引用。收录 ${list.length} 条可直接复制的词句，示例：「${pick}」。`;

  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <a href="${R2}g/${g.id}/">${esc(g.name)}</a> › <span>${esc(s.name)}</span></nav>
    <h1>${esc(s.name)}</h1>
    <p class="lead">${esc(s.desc)}</p>
    <p class="stat">共 ${list.length} 句 · 按从短到长排列，越靠前越适合直接当文案</p>
  </div>
</section>`;

  const content = `<div class="wrap">
  ${filterBar(usedMoods)}
  ${cardList(list, R2, { showScenes: true })}
  <section class="also">
    <h2>同一类里的其他处境</h2>
    <div class="also-list">${sibling.map(x => `<a href="${R2}s/${x.id}/">${esc(x.name)}<em>${D.bySceneMap[x.id].length}</em></a>`).join('')}</div>
  </section>
</div>`;

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${s.name} - ${SITE.name}`, description: desc,
    url: `${SITE.origin}${SITE.base}s/${s.id}/`,
    mainEntity: {
      '@type': 'ItemList', numberOfItems: list.length,
      itemListElement: list.slice(0, 30).map((p, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'Quotation', text: p.t, ...(p.a && p.a !== '佚名' ? { spokenByCharacter: undefined, creator: { '@type': 'Person', name: p.a } } : {}), ...(p.w ? { isPartOf: { '@type': 'CreativeWork', name: p.w } } : {}) }
      }))
    }
  };
  return layout({ depth: 2, title: s.name, desc, canonical: `s/${s.id}/`, hero, content, jsonld, bodyClass: 'page-scene' });
}

/* ── 大类页 ─────────────────────────────────── */
export function groupPage(D, g) {
  const gs = D.scenesByGroup.find(x => x.id === g.id);
  const total = gs.scenes.reduce((n, s) => n + D.bySceneMap[s.id].length, 0);
  const desc = `${g.name}（${g.tag}）下的 ${gs.scenes.length} 个具体处境，共 ${total} 条词句。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <span>${esc(g.name)}</span></nav>
    <h1>${esc(g.name)}</h1>
    <p class="lead">${esc(g.tag)} · ${gs.scenes.length} 个处境 / ${total} 句</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  <div class="s-grid big">
    ${gs.scenes.map(s => `<a class="s-card" href="${R2}s/${s.id}/">
      <b>${esc(s.name)}</b><i>${esc(s.desc)}</i><em>${D.bySceneMap[s.id].length} 句</em>
    </a>`).join('')}
  </div>
  <section class="also">
    <h2>换一类看看</h2>
    <div class="also-list">${D.groups.filter(x => x.id !== g.id).map(x => `<a href="${R2}g/${x.id}/">${esc(x.name)}</a>`).join('')}</div>
  </section>
</div>`;
  return layout({ depth: 2, title: g.name, desc, canonical: `g/${g.id}/`, hero, content, bodyClass: 'page-group' });
}

/* ── 心情页 ─────────────────────────────────── */
export function moodPage(D, m) {
  const list = D.byMoodMap[m.id];
  const desc = `${m.name}（${m.desc}）时能用的 ${list.length} 条词句。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <a href="${R2}moods/">按心情</a> › <span>${esc(m.name)}</span></nav>
    <h1>${esc(m.name)}</h1>
    <p class="lead">${esc(m.desc)}</p>
    <p class="stat">共 ${list.length} 句</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  ${filterBar(null)}
  ${cardListByScene(list, D, R2)}
  <section class="also">
    <h2>换个心情</h2>
    <div class="also-list">${D.moods.filter(x => x.id !== m.id).map(x => `<a href="${R2}m/${x.id}/">${esc(x.name)}<em>${D.byMoodMap[x.id].length}</em></a>`).join('')}</div>
  </section>
</div>`;
  return layout({ depth: 2, title: `${m.name}的时候`, desc, canonical: `m/${m.id}/`, hero, content, bodyClass: 'page-mood' });
}

/* ── 作者页 ─────────────────────────────────── */
export function authorPage(D, a) {
  const list = a.pieces;
  const works = [...new Set(list.map(p => p.w).filter(Boolean))];
  const desc = `${a.name}的 ${list.length} 条名句摘录${works.length ? '，出自《' + works.slice(0, 5).join('》《') + '》等' : ''}，每句标注适用场景。`;
  // 同时代作者推荐（同年代国别，句数 top 6，过滤佚名与空年代）
  const sameDyn = (a.d && a.d !== '现代' ? D.authors.filter(x => x.slug !== a.slug && x.d === a.d && x.name !== '佚名').slice(0, 6) : []);
  const alsoHtml = sameDyn.length ? `<section class="also"><h3>同时代的作者</h3>
  <div class="a-grid">${sameDyn.map(x => `<a class="a-card" href="${R2}a/${x.slug}/">${esc(x.name)}<em>${x.pieces.length}</em></a>`).join('')}</div>
</section>` : '';
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <a href="${R2}authors/">作者</a> › <span>${esc(a.name)}</span></nav>
    <h1>${esc(a.name)}</h1>
    <p class="lead">${esc(a.d || '')} · 收录 ${list.length} 句${works.length ? ' · 涉及 ' + works.length + ' 篇作品' : ''}</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  ${filterBar(null)}
  ${cardListByScene(list, D, R2)}
  ${alsoHtml}
</div>`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'ProfilePage',
    mainEntity: { '@type': 'Person', name: a.name },
    url: `${SITE.origin}${SITE.base}a/${a.slug}/`
  };
  return layout({ depth: 2, title: `${a.name}的句子`, desc, canonical: `a/${a.slug}/`, hero, content, jsonld, bodyClass: 'page-author' });
}

/* ── 地点页 ─────────────────────────────────── */
export function placePage(D, pl) {
  const list = D.byPlaceMap[pl.id];
  const desc = `${pl.name}（${pl.desc}）能用作注脚、能当背景、能替你说出那点情绪的 ${list.length} 条词句。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <a href="${R2}places/">按地点</a> › <span>${esc(pl.name)}</span></nav>
    <h1>${esc(pl.name)}</h1>
    <p class="lead">${esc(pl.desc)}</p>
    <p class="stat">共 ${list.length} 句</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  ${filterBar(null)}
  ${cardListByScene(list, D, R2, { showScenes: true })}
  <section class="also">
    <h2>换个地点</h2>
    <div class="also-list">${D.places.filter(x => x.id !== pl.id).map(x => `<a href="${R2}p/${x.id}/">${esc(x.name)}<em>${D.byPlaceMap[x.id].length}</em></a>`).join('')}</div>
  </section>
</div>`;
  return layout({ depth: 2, title: `${pl.name}的词句`, desc, canonical: `p/${pl.id}/`, hero, content, bodyClass: 'page-place' });
}
