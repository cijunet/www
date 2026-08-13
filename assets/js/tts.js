// 语音朗读（Web Speech API，零依赖）。为每张 .q 卡片注入「朗读」按钮，朗读中切换为「停止」。
// 两个坑（旧实现踩过）：
//  1) 'end' 是 SpeechSynthesisUtterance 的事件，不是 speechSynthesis 的 —— 挂在后者上永远不触发，
//     而且每张卡都挂一个还不解绑，等于内存泄漏。这里改成 utterance.onend。
//  2) inject 本身会改 DOM，MutationObserver 不防抖就会被自己触发出的变更反复唤醒。
const SYN = window.speechSynthesis;

function miniToast(msg) {
  let el = document.querySelector('.round2-toast');
  if (!el) { el = document.createElement('div'); el.className = 'round2-toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(miniToast._t);
  miniToast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

let activeBtn = null;
function reset(b) {
  if (!b) return;
  b.classList.remove('on');
  b.textContent = b.dataset.label || '朗读';   // 恢复原始文案（朗读中的按钮文字由调用方自定义）
  b.setAttribute('aria-pressed', 'false');
  if (activeBtn === b) activeBtn = null;
}
function stopAll() {
  if (SYN) SYN.cancel();
  reset(activeBtn);
}
function speak(btn, txt) {
  if (!SYN || !('SpeechSynthesisUtterance' in window)) { miniToast('当前浏览器不支持语音朗读'); return; }
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  stopAll();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'zh-CN'; u.rate = 0.9;
  const vs = SYN.getVoices();
  for (let i = 0; i < vs.length; i++) {
    if (/zh|cmn|Chinese/i.test(vs[i].lang + vs[i].name)) { u.voice = vs[i]; break; }
  }
  u.onend = () => reset(btn);
  u.onerror = () => reset(btn);
  activeBtn = btn;
  btn.classList.add('on');
  btn.textContent = '停止';
  btn.setAttribute('aria-pressed', 'true');
  SYN.speak(u);
}

export function mountTTS(root = document) {
  if (!SYN) return;
  const host = root === document ? document.body : root;
  if (!host) return;

  const inject = () => {
    host.querySelectorAll('.q').forEach(card => {
      if (card.querySelector('[data-speak]')) return;
      const text = card.querySelector('.q-text');
      const act = card.querySelector('.q-act');
      if (!text || !act) return;
      const plain = card.querySelector('.q-x');
      const b = document.createElement('button');
      b.className = 'btn-copy speak'; b.type = 'button'; b.setAttribute('data-speak', '');
      b.textContent = '朗读'; b.title = '朗读这句'; b.setAttribute('aria-label', '朗读这句');
      b.setAttribute('aria-pressed', 'false');
      b.dataset.txt = text.textContent + (plain ? '。' + plain.textContent : '');
      act.insertBefore(b, act.firstChild);
    });
  };

  host.addEventListener('click', e => {
    const b = e.target.closest('[data-speak]');
    if (!b) return;
    e.stopPropagation();
    if (b.classList.contains('on')) stopAll();
    else speak(b, b.dataset.txt || '');
  });

  inject();
  if ('MutationObserver' in window) {
    let t = 0;
    new MutationObserver(() => {
      if (t) return;
      t = setTimeout(() => { t = 0; inject(); }, 120);
    }).observe(host, { childList: true, subtree: true });
  }
  // 离开页面时停掉朗读，免得后台一直在说
  window.addEventListener('pagehide', stopAll);
}

// ── 公共朗读入口（原文详情页等复用）────────────────────
// 按钮状态自动切换：未读 → 朗读（on）；朗读中 → 停止
export function speakText(btn, txt) {
  if (!btn || !txt) return false;
  if (btn.classList.contains('on')) { stopAll(); return false; }
  speak(btn, txt);
  return true;
}
