// 非 v2 页面的搜索框：旧的全量前端搜索已废弃，统一跳转到新搜索页 /search/。
// 这样非搜索页不再依赖 pieces.msgpack，旧搜索逻辑可整体移除。
import { baseHref } from './util.js';

// v2 判定直接读 <html data-runtime="v2">。旧版这个全局量是 app.js 设的，app.js 已删，
// 不能再依赖 window.__CIJU_V2 存在。
export function isV2() {
  return document.documentElement.getAttribute('data-runtime') === 'v2';
}

export function mountSearchDelegate(root = document) {
  if (isV2()) return;               // v2 搜索页由 search-ui 自行处理

  const go = (input) => {
    const v = (input.value || '').trim();
    const url = baseHref() + 'search/' + (v ? '?q=' + encodeURIComponent(v) : '');
    location.href = url;
  };

  root.addEventListener('submit', e => {
    const form = e.target.closest('form');
    if (!form) return;
    const q = form.querySelector('#q') || form.querySelector('input[name="q"]');
    if (!q) return;
    e.preventDefault();
    go(q);
  });

  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const q = e.target.closest('#q, input[name="q"]');
    if (!q) return;
    e.preventDefault();
    go(q);
  });
}
