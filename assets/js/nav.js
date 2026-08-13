// 导航折叠 + 卡片客户端筛选（data-filters）+ 处境词填充（data-fill）。
// 仅操作已烘焙在页面上的卡片属性（data-tier / data-scenes / data-places / data-origin），不依赖数据运行时。

export function mountNav() {
  // 顶部导航折叠（移动端）
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-nav-toggle]');
    if (!t) return;
    // 按钮可显式指定目标（data-nav-toggle=".xxx"）；缺省取 .nav（历史曾写 .site-nav，一并兼容）
    const sel = t.getAttribute('data-nav-toggle') || '.nav';
    const nav = document.querySelector(sel) || document.querySelector('.site-nav');
    if (nav) nav.classList.toggle('open');
  });

  // 底部导航（移动端 tabbar）当前 tab 高亮：按路径匹配 data-tb
  const TB = {
    home: /^\/?(index\.html)?$/,
    scenes: /^\/scenes\//,
    games: /^\/games\//,
    moods: /^\/moods\//,
    places: /^\/places\//,
    authors: /^\/authors\//,
  };
  const p = location.pathname;
  document.querySelectorAll('.tabbar .tb').forEach(a => {
    const k = a.getAttribute('data-tb');
    if (k && TB[k] && TB[k].test(p)) a.classList.add('active');
  });

  // 处境词点一下填进搜索框
  document.addEventListener('click', e => {
    const fill = e.target.closest('[data-fill]');
    if (!fill) return;
    const q = document.querySelector('#q');
    if (q) { q.value = fill.getAttribute('data-fill'); q.dispatchEvent(new Event('input')); q.focus(); }
  });
}

export function mountFilters(root = document) {
  const bar = root.querySelector('[data-filters]');
  if (!bar) return;
  const state = { tier: '', origin: '', place: '' };
  const countEl = root.querySelector('[data-count]');
  const cards = Array.prototype.slice.call(root.querySelectorAll('.q'));

  function apply() {
    let shown = 0;
    cards.forEach(c => {
      const ok =
        (!state.tier || c.getAttribute('data-tier') === state.tier) &&
        (!state.origin || c.getAttribute('data-origin') === state.origin) &&
        (!state.place || (' ' + (c.dataset.places || '') + ' ').indexOf(' ' + state.place + ' ') > -1);
      c.hidden = !ok;
      if (ok) shown++;
    });
    if (countEl) countEl.textContent = shown + ' / ' + cards.length;
  }

  bar.addEventListener('click', e => {
    const chip = e.target.closest('[data-f]');
    if (!chip) return;
    const f = chip.getAttribute('data-f');
    const v = chip.getAttribute('data-v');
    state[f] = (state[f] === v) ? '' : v;     // 再点一次取消
    // 高亮按「当前值」判定，而不是「是不是刚点的那个」——否则取消后连「不限」也会灭掉
    bar.querySelectorAll('[data-f="' + f + '"]').forEach(c =>
      c.classList.toggle('on', (c.getAttribute('data-v') || '') === state[f]));
    apply();
  });
  apply();
}
