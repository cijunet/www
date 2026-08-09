// 随机一句：首页「随便来一句」按钮触发，从新分片运行时随机取一条渲染。
import { initRecords, randomCards } from './records.js';
import { renderCard, setMeta } from './card.js';
import { loadMeta } from './meta.js';
import { baseHref } from './util.js';

export async function mountRandom(root = document) {
  const box = root.querySelector('[data-random-box]');
  if (!box) return;
  const R = baseHref();
  await initRecords(R);
  setMeta(await loadMeta());

  const paint = async () => {
    const recs = await randomCards(1);
    const rec = recs[0];
    if (!rec) return;
    box.hidden = false;
    box.innerHTML = renderCard(rec, { R });
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  document.addEventListener('click', async e => {
    if (!e.target.closest('[data-random]')) return;
    e.preventDefault();
    try { await paint(); } catch (err) { console.error(err); }
  });
}
