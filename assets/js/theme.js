// 暗色模式：localStorage 优先，否则跟随系统偏好；切换时同步 <meta name=theme-color>（架构 3.9）。
const KEY = 'ciju.theme';
const LIGHT_COLOR = '#9e3a2e';   // 宣纸朱红（印泥色）
const DARK_COLOR = '#0f0f0f';    // 玄墨金暗色（近纯黑）

function applyTheme(t) {
  const dark = t === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? DARK_COLOR : LIGHT_COLOR);
  syncLabel();
}
// 明暗开关单字标签：暗色模式显示「明」（点击回明），亮色模式显示「暗」（点击切暗）
function syncLabel() {
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '明' : '暗';
}

export function mountTheme() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) applyTheme(saved);
  else applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  // 用户没手动选过时，跟随系统偏好实时变化
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = e => {
      let s = null;
      try { s = localStorage.getItem(KEY); } catch (err) {}
      if (s) return;
      applyTheme(e.matches ? 'dark' : 'light');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
}
