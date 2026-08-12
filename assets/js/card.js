// 卡片渲染（新数据模型）。动态注入的卡片（随机/今日/附近/相关）与构建期烘焙卡片共用同一套样式。
// 场景/地点/作者名由 meta.js 提供，故先 setMeta 再渲染。
import { esc } from './util.js';
export { esc } from './util.js';   // 兼容旧引用（related.js 等），实现统一在 util.js
export function lengthTier(l) {
  l = l == null ? 0 : +l;
  return l <= 12 ? 'short' : l <= 28 ? 'mid' : 'long';
}
export const tierLabel = { short: '短', mid: '中等', long: '偏长' };

const _meta = { scenes: {}, places: {}, authors: {} };
export function setMeta(m) { if (m) Object.assign(_meta, m); }

export function renderCard(r, { R = '' } = {}) {
  if (!r) return '';
  const t = lengthTier(r.l);
  const src = [r.a, r.w ? `《${r.w}》` : ''].filter(Boolean).join(' ');
  const extra = [];
  if (r.s && r.s.length) {
    const links = r.s.map(id => {
      const s = _meta.scenes[id];
      return s ? `<a href="${R}scenes/?id=${id}">${esc(s.name)}</a>` : '';
    }).filter(Boolean);
    if (links.length) extra.push('适用场景：' + links.join('、'));
  }
  if (r.pl && r.pl.length) {
    const links = r.pl.map(id => {
      const p = _meta.places[id];
      return p ? `<a href="${R}places/?id=${id}">${esc(p.name)}</a>` : '';
    }).filter(Boolean);
    if (links.length) extra.push('地点：' + links.join('、'));
  }
  const copyFull = esc(r.t + (src ? ' —— ' + src : ''));
  return `<article class="q"${r._gid != null ? ` data-gid="${r._gid}"` : ''} data-tier="${t}">`
    + `<blockquote class="q-text">${esc(r.t)}</blockquote>`
    + (r.o ? `<p class="q-o">${esc(r.o)}</p>` : '')
    + (r.x ? `<p class="q-x">${esc(r.x)}</p>` : '')
    + `<div class="q-meta"><span class="q-src">${esc(src || '佚名')}</span>`
    + (r.d ? `<span class="q-dyn">${esc(r.d)}</span>` : '')
    + `<span class="q-tier t-${t}">${tierLabel[t]}</span></div>`
    + (r.n ? `<p class="q-note"><span>怎么用</span>${esc(r.n)}</p>` : '')
    + (extra.length ? `<p class="q-extra">${extra.join(' · ')}</p>` : '')
    + (r.w ? `<a class="q-work" href="${R}works/?w=${encodeURIComponent(r.w)}">查看原文 <i>↗</i></a>` : '')
    + `<div class="q-act"><button class="btn-copy" data-copy="${esc(r.t)}" aria-label="复制这句">复制</button>`
    + `<button class="btn-copy alt" data-copy="${copyFull}" aria-label="复制带出处">带出处复制</button></div>`
    + `</article>`;
}
