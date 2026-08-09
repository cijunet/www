// 复制：所有 [data-copy] 按钮统一处理（构建期烘焙卡片 + 动态注入卡片共用）。
// 优先 navigator.clipboard，降级到临时 textarea + execCommand。
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((res, rej) => {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); res(); }
    catch (e) { rej(e); }
    finally { document.body.removeChild(ta); }
  });
}

let toastEl = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'ciju-toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

export function mountClipboard(root = document) {
  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    copyText(btn.getAttribute('data-copy')).then(() => {
      const old = btn.textContent;
      btn.textContent = '已复制';
      btn.classList.add('done');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('done'); }, 1400);
    }).catch(() => toast('复制失败，请手动选中'));
  });
}
