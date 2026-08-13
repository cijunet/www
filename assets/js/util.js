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

// 文本规整：去空白与全部标点（多模块共用：飞花令校验 / 拼句比对 / 原文检索）
export function norm(s) {
  return String(s || '').replace(/[\s，。！？；：、,.!?;:'"“”‘’（）()《》〈〉「」『』【】\[\]·—…～~\-_/\\|]+/g, '');
}
