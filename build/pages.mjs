import { layout, card, cardList, filterBar } from './templates.mjs';
import { esc, rel, tierLabel } from './util.mjs';
import { SITE } from './site.config.mjs';

const R1 = '../', R2 = '../../';

/* ── 首页 ───────────────────────────────────── */
export function homePage(D) {
  const R = './';
  const hot = ['dengding','fangbang','kuanian','songbie','xiangnian','jiaban','biye','chuxue','fangxia','yigeren','wangjiang','shengri'];
  const hero = `<section class="hero">
  <div class="wrap">
    <h1>此刻，说句好的</h1>
    <p class="hero-sub">爬上山顶、查到分数、送人走、深夜还在加班——那些说不出口的时刻，这里有现成的一句。<br>共收录 <b>${D.pieces.length}</b> 条词句，铺在 <b>${D.scenes.length}</b> 个具体场景里。</p>
    <form class="hero-search" action="${R}search/" method="get">
      <input type="search" name="q" placeholder="你现在是什么处境？比如：下雪、落榜、想家" aria-label="搜索词句">
      <button type="submit">找一句</button>
    </form>
    <div class="hero-hot">
      ${hot.map(id => D.sceneMap[id] ? `<a href="${R}s/${id}/">${esc(D.sceneMap[id].name)}</a>` : '').join('')}
    </div>
    <p class="hero-random"><button data-random>随便来一句</button></p>
    <div class="random-box" data-random-box hidden></div>
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
  return layout({ depth: 0, title: SITE.name, desc: SITE.desc, canonical: '', hero, content, jsonld, bodyClass: 'page-home' });
}

/* ── 场景页 ─────────────────────────────────── */
export function scenePage(D, s) {
  const list = D.bySceneMap[s.id];
  const g = D.groupMap[s.g];
  const usedMoods = D.moods.filter(m => list.some(p => p.m.includes(m.id)));
  const sibling = D.scenesByGroup.find(x => x.id === s.g).scenes.filter(x => x.id !== s.id);
  const desc = `${s.name}：${s.desc} 收录 ${list.length} 条可直接使用的词句，标好长度与用法，点一下就复制。`;

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
  ${cardList(list, R2)}
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
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R2}">首页</a> › <a href="${R2}authors/">作者</a> › <span>${esc(a.name)}</span></nav>
    <h1>${esc(a.name)}</h1>
    <p class="lead">${esc(a.d || '')} · 收录 ${list.length} 句${works.length ? ' · 涉及 ' + works.length + ' 篇作品' : ''}</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  ${filterBar(null)}
  ${cardList(list, R2)}
</div>`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'ProfilePage',
    mainEntity: { '@type': 'Person', name: a.name },
    url: `${SITE.origin}${SITE.base}a/${a.slug}/`
  };
  return layout({ depth: 2, title: `${a.name}的句子`, desc, canonical: `a/${a.slug}/`, hero, content, jsonld, bodyClass: 'page-author' });
}
