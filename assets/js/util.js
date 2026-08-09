// 站点根路径推导：基于样式表绝对 URL 回退到 assets/ 上一级，跨页面深度都成立。
export function baseHref() {
  const link = document.querySelector('link[rel=stylesheet]');
  if (!link) return '/';
  const url = new URL(link.getAttribute('href'), document.baseURI);
  return url.href.replace(/\/assets\/style\.css(\?[^#]*)?(#.*)?$/, '/');
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
