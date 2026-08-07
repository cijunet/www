import { layout, cardList, filterBar, nearMeBlock } from './templates.mjs';
import { esc } from './util.mjs';
import { SITE } from './site.config.mjs';

const R1 = '../';

/* ── 全部场景索引 ───────────────────────────── */
export function scenesIndexPage(D) {
  const desc = `${SITE.name}的全部 ${D.scenes.length} 个场景索引，按 ${D.groups.length} 大类归置，找到最像你此刻处境的那一个。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R1}">首页</a> › <span>全部场景</span></nav>
    <h1>全部场景</h1>
    <p class="lead">${D.groups.length} 大类，${D.scenes.length} 个具体处境。不用想文学分类，找那个最像你现在的。</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  ${D.scenesByGroup.map(g => `<section class="g-block">
    <h2 class="g-title"><a href="${R1}g/${g.id}/">${esc(g.name)}</a><span>${esc(g.tag)}</span></h2>
    <div class="s-grid">
      ${g.scenes.map(s => `<a class="s-card" href="${R1}s/${s.id}/"><b>${esc(s.name)}</b><i>${esc(s.desc)}</i><em>${D.bySceneMap[s.id].length} 句</em></a>`).join('')}
    </div>
  </section>`).join('')}
</div>`;
  return layout({ depth: 1, title: '全部场景', desc, canonical: 'scenes/', hero, content });
}

/* ── 心情索引 ───────────────────────────────── */
export function moodsIndexPage(D) {
  const desc = `按心情找词句：豪迈、苍凉、思念、释然、通透……共 ${D.moods.length} 种情绪。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R1}">首页</a> › <span>按心情</span></nav>
    <h1>按心情找</h1>
    <p class="lead">说不清处境，但知道自己什么感觉的时候，从这里进。</p>
  </div>
</section>`;
  const content = `<div class="wrap"><div class="m-grid big">
    ${D.moods.map(m => `<a class="m-card" href="${R1}m/${m.id}/"><b>${esc(m.name)}</b><i>${esc(m.desc)}</i><em>${D.byMoodMap[m.id].length}</em></a>`).join('')}
  </div></div>`;
  return layout({ depth: 1, title: '按心情找', desc, canonical: 'moods/', hero, content });
}

/* ── 地点索引 ───────────────────────────────── */
export function placesIndexPage(D) {
  const desc = `按地点找词句：江南、塞外、长安、故乡、他乡……共 ${D.places.length} 处地方，每处都收着与之相称的句子。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R1}">首页</a> › <span>按地点</span></nav>
    <h1>按地点找</h1>
    <p class="lead">同一句诗，写在江南是软的，写在塞外是硬的。按地方进，找最对味的那一句。</p>
  </div>
</section>`;
  const content = `<div class="wrap">
    ${nearMeBlock()}
    <div class="m-grid big">
      ${D.places.map(pl => `<a class="m-card" href="${R1}p/${pl.id}/"><b>${esc(pl.name)}</b><i>${esc(pl.desc)}</i><em>${D.byPlaceMap[pl.id].length}</em></a>`).join('')}
    </div></div>`;
  return layout({ depth: 1, title: '按地点找', desc, canonical: 'places/', hero, content });
}

/* ── 作者索引 ───────────────────────────────── */
export function authorsIndexPage(D) {
  const desc = `${SITE.name}收录的 ${D.authors.length} 位作者，从李白杜甫苏轼到王尔德加缪，每位都可单独浏览。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R1}">首页</a> › <span>作者</span></nav>
    <h1>全部作者</h1>
    <p class="lead">共 ${D.authors.length} 位，按收录条数排序。</p>
  </div>
</section>`;
  const content = `<div class="wrap"><div class="a-grid big">
    ${D.authors.map(a => `<a class="a-card" href="${R1}a/${a.slug}/">${esc(a.name)}<em>${a.pieces.length}</em></a>`).join('')}
  </div></div>`;
  return layout({ depth: 1, title: '全部作者', desc, canonical: 'authors/', hero, content });
}

export function searchPage(D) {
  const desc = '在站内搜索词句：可以搜句子本身、作者、出处，也可以直接搜你此刻的处境，比如"落榜""想家"。';
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R1}">首页</a> › <span>搜索</span></nav>
    <h1>搜一句</h1>
    <p class="lead">搜句子、搜作者、搜出处，或者直接搜你此刻的处境。</p>
  </div>
</section>`;
  const content = `<div class="wrap">
  <form class="big-search" data-search-form onsubmit="return false">
    <input type="search" id="q" name="q" placeholder="比如：杜甫 / 想家 / 一个人吃饭" autocomplete="off" autofocus>
  </form>
  <div class="s-hint">试试：${['dengding','xiangnian','jiaban','yigeren','songbie','chonglai'].map(id => `<button class="chip" data-fill="${esc(D.sceneMap[id].name)}">${esc(D.sceneMap[id].name)}</button>`).join('')}</div>
  <div id="results" class="q-list" aria-live="polite"></div>
  <p class="empty" data-search-empty hidden>没找到。换个说法试试，或者去<a href="${R1}scenes/">全部场景</a>里翻。</p>
</div>`;
  return layout({ depth: 1, title: '搜索', desc, canonical: 'search/', hero, content, bodyClass: 'page-search' });
}

/* ── 关于 ───────────────────────────────────── */
export function aboutPage(D) {
  const desc = `关于${SITE.name}：一个按处境找好词好句的站。`;
  const hero = `<section class="page-hero">
  <div class="wrap">
    <nav class="crumb"><a href="${R1}">首页</a> › <span>关于</span></nav>
    <h1>关于${esc(SITE.name)}</h1>
  </div>
</section>`;
  const content = `<div class="wrap prose">
<p>人在某些时刻是需要一句话的。</p>
<p>爬到山顶风灌进衣服的时候，站在江边看水一直流走的时候，查到分数手还在抖的时候，把人送进安检口那边的时候，凌晨两点写字楼只剩自己这盏灯的时候——心里明明翻涌着东西，打开输入框却只敲得出"绝了""破防了""好美啊"。</p>
<p>不是没有感受，是没有词。</p>
<p>这个站就是干这个的：把古今中外的好词好句拆成能直接用的短句，按<b>具体处境</b>码放整齐。不按"唐诗宋词元曲"分，那是给做题用的；按"爬到山顶那一刻""查到成绩、放榜、录取""发现父母老了"分，因为你是带着处境来的，不是带着朝代来的。</p>

<h2>这里跟别的诗词站有什么不一样</h2>
<ul>
<li><b>拆开用。</b>一首《定风波》能拆出四句，"莫听穿林打叶声""一蓑烟雨任平生""也无风雨也无晴"各归各的场景，你要哪句拿哪句，不用背全篇。</li>
<li><b>一句多挂。</b>同一句话在不同处境下都成立的，就同时出现在多个场景里。"行到水穷处，坐看云起时"既在"一个人在路上"，也在"很努力但没有结果"，还在"放下、算了、不争了"。</li>
<li><b>标了怎么用。</b>每句下面有一行"怎么用"，告诉你这句适合发在哪、配什么图、会不会显得用力过猛。这是本站最花功夫的部分。</li>
<li><b>标了长度。</b>极短的（12 字以内）适合当签名、当标题、当口播；偏长的适合写在长文里。挑之前先看这个。</li>
<li><b>中外都收。</b>古诗词、词曲、诸子文言、近现代作家、外国诗人与哲人、经典电影台词，外文都附原文。</li>
</ul>

<h2>目前收了多少</h2>
<p>${D.pieces.length} 条词句，${D.scenes.length} 个场景，${D.groups.length} 个大类，${D.authors.length} 位作者。还在持续加。</p>

<h2>关于准确性</h2>
<p>中文互联网上流传的"名人名言"里有相当一部分是伪造的，尤其挂在鲁迅、张爱玲、泰戈尔、村上春树、尼采名下的。本站收录时的原则是：<b>拿不准出处的宁可不收</b>。作者不明的标"佚名"，是当代流行表达的标"常用表达"，不硬安一个名人。若你发现错漏，非常欢迎指出。</p>

<h2>版权</h2>
<p>收录内容以进入公有领域的古典作品为主。近现代及外文作品仅摘引短句并标注作者与出处，属合理引用范围；如相关权利人认为不妥，可联系删除。</p>
</div>`;
  return layout({ depth: 1, title: '关于', desc, canonical: 'about/', hero, content });
}
