// 暗色模式：localStorage 优先，否则跟随系统偏好；切换时同步 <meta name=theme-color>（架构 3.9）。
const KEY = 'ciju.theme';
const LIGHT_COLOR = '#a8322d';   // 品牌红
const DARK_COLOR = '#17110d';    // 深色背景

function applyTheme(t) {
  const dark = t === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? DARK_COLOR : LIGHT_COLOR);
}
function icon() { return document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '🌙'; }

export function mountTheme() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) applyTheme(saved);
  else applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  const head = document.querySelector('.head-inner');
  if (head && !document.querySelector('[data-theme-toggle]')) {
    const b = document.createElement('button');
    b.className = 'theme-toggle'; b.type = 'button'; b.setAttribute('data-theme-toggle', '');
    b.setAttribute('aria-label', '切换明暗模式'); b.title = '切换明暗模式';
    b.textContent = icon();
    head.appendChild(b);
  }

  // 用户没手动选过时，跟随系统偏好实时变化
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = e => {
      let s = null;
      try { s = localStorage.getItem(KEY); } catch (err) {}
      if (s) return;
      applyTheme(e.matches ? 'dark' : 'light');
      const btn = document.querySelector('[data-theme-toggle]');
      if (btn) btn.textContent = icon();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    t.textContent = icon();
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
}
