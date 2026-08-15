// 简繁切换（客户端运行时转换，零第三方 CDN）：
// 全站数据与索引都是简体。切到繁体时在「DOM 出口」统一转换显示文本（静态烘焙 HTML + 动态渲染一体覆盖），
// 检索时再把繁体查询归一成简体进 Worker/词典——数据层零改动、索引零改动，任意时刻一键精确还原。
// 转换字典 opencc-js（MIT AND Apache-2.0）本地化在 assets/js/opencc/，仅在启用繁体时按需加载。
//
// 为什么是 DOM 出口而不是改每个渲染模块：
//   card / detail / today / works / games 等渲染层众多，且大量字符串是构建期烘焙进 HTML 的；
//   统一在 DOM 层把「文本节点 + 少量内容属性」转一遍，静态与动态内容天然都覆盖，切换逻辑只此一处。
//   （OpenCC 自带的 HTMLConverter 会整块替换 DOM 导致监听循环与还原困难，故自实现文本节点级转换。）
//
// 转换管线（v3，与 build/_iter.mjs 全库校验保持同一份逻辑）：
//   s2t = 覆写( opencc_s2t( t2s(s) ) ) —— 先经 t2s 归一简体再转繁体（simplify-first，幂等锚定，杜绝二次转换漂移）
//   t2s = 覆写( opencc_t2s ) → 保护长语境(著/想像) → 残余归一 → 还原
//   覆写表/白名单由 _iter.mjs 对全库 6.4w+ 条文本逐条迭代到「幂等 0 + 往返 0」后回写，此处为最终版。

const KEY = 'ciju.lang';          // localStorage：'s' 简体（默认） | 't' 繁体
const ATTRS = ['data-copy', 'data-txt', 'data-label', 'placeholder', 'aria-label', 'title', 'content'];
const HAS_KANA = /[\u3040-\u30ff]/;  // 日语假名：原文语种内容不参与简繁转换（日语引文保持原作者写法）

let mode = null;                  // 当前生效语言（null=未初始化）
let s2tFn = null;                 // 简→繁 转换器（懒加载）
let t2sFn = null;                 // 繁→简 转换器（懒加载）
let loadP = null;                 // opencc 懒加载 Promise（幂等）

// 转换结果缓存：卡片/白话/注释等大量重复短句，只算一次。简单上限防长会话无界增长。
const cache = new Map();
const CACHE_MAX = 300000;

/* ── S2T 显示纠错：键 = opencc_s2t 输出里的串，值 = 期望繁体串 ── */
const S2T_OVERRIDES = new Map([
  // opencc 未按语境落字的两类高频词形
  ['歲月里', '歲月裡'],   // opencc 把「岁月里」的里当长度单位没转裡
  ['靈魂里', '靈魂裡'],
  ['風后面', '風後面'],   // opencc 未把后→後
  ['鬱郁', '鬱鬱'],       // 郁郁（葱茏/稠密）两字都该转鬱
  // 幂等锚定（simplify-first 下多为安全网）：锚回 opencc 的一次结果，防极端词形二次漂移
  ['劃著', '划著'],       // 划着（船）
  ['幹鏚', '干鏚'],       // 干戚
  ['系著', '繫著'],       // 系着（离情）
  ['疼痛挨著路程', '疼痛捱著路程'], // 捱/挨 双向 2 循环：锚定繁体显示为「捱著」（台湾惯用“捱过”），s2t 幂等
]);

/* ── T2S 还原/归一纠错：键 = opencc_t2s 输出里的串，值 = 期望简体 ── */
const T2S_OVERRIDES = new Map([
  // 非BMP 简化形 → 数据原字（BMP 传统写法；数据本身是传统写法，t2s 后需还原）
  ['𫖯', '頫'], ['𥮾', '篸'], ['𣲗', '湋'], ['𪩘', '巘'], ['𬪩', '醲'], ['𬘘', '紞'], ['𬱖', '頔'],
  // 人名/异体字保护（魏征/魏征传/魏征剑：数据 魏徵与魏征 并存，统一归规范简体「魏征」）
  ['凌蒙初', '凌濛初'], ['魏徵', '魏征'], ['魏徵传', '魏征传'], ['魏徵剑', '魏征剑'], ['洪升', '洪昇'],
  ['朱庆余', '朱庆馀'], ['钱锺书', '钱钟书'], ['黄沾', '黄霑'], ['陈昇', '陈升'],
  ['刘着', '刘著'], ['耿𣲗', '耿湋'], ['舒𬱖', '舒頔'],
  // 濛：数据为繁体濛的语境（用具体短语还原，不做无差别 蒙→濛 以免误伤简体「空蒙」数据）
  ['蒙蒙水云', '濛濛水云'], ['飘在蒙蒙', '飘在濛濛'], ['在蒙蒙水', '在濛濛水'],
  ['下著蒙蒙', '下着濛濛'], ['下着蒙蒙', '下着濛濛'], ['着蒙蒙的', '着濛濛的'], ['时雨蒙蒙', '时雨濛濛'],
  ['草蒙蒙', '草濛濛'], ['杨花蒙蒙', '杨花濛濛'], ['点空蒙隔', '点空濛隔'], ['蒙蒙乱扑', '濛濛乱扑'],
  ['草色蒙蒙', '草色濛濛'], ['色蒙蒙。', '色濛濛。'], ['碧水蒙', '碧水濛'], ['雨蒙蒙。', '雨濛濛。'],
  // 蘋：数据为繁体蘋的语境
  ['白苹洲', '白蘋洲'], ['绿水苹', '绿水蘋'], ['绿苹', '绿蘋'], ['水苹', '水蘋'], ['采苹', '采蘋'],
  ['青苹', '青蘋'], ['断白苹洲', '断白蘋洲'], ['满白苹的', '满白蘋的'], ['怡红快绿苹转', '怡红快绿蘋转'],
  ['使绿苹转色', '使绿蘋转色'], ['想采苹花却', '想采蘋花却'], ['欲采苹花不', '欲采蘋花不'],
  ['的绿苹。', '的绿蘋。'], ['与水苹初', '与水蘋初'],
  // 乾（桑乾河）/璿/搧/簷/菓/澂/於潜/锺（钟子期，保留钱锺书）
  ['桑干河', '桑乾河'], ['必桑干', '必桑乾'], ['到桑干河', '到桑乾河'],
  ['璇枢', '璿枢'], ['扇过桥东', '搧过桥东'], ['簷', '檐'], ['菓', '果'], ['澂', '澄'],
  ['於潜', '于潜'], ['万锺', '万钟'],
  // 近现代词汇归一（数据用简体，opencc tw→cn 未归的）
  ['纸上覆活', '纸上复活'], ['愁的座标', '愁的坐标'], ['人的座标', '人的坐标'],
  ['航人座标', '航人坐标'], ['环境薰陶', '环境熏陶'], ['敢於坦然', '敢于坦然'],
  ['我要藉著', '我要借着'], ['当年拼却', '当年拚却'], ['亲暱', '亲昵'], ['为亲暱', '为亲昵'],
  ['分亲暱随', '分亲昵随'], ['鸟亲暱地', '鸟亲昵地'], ['着亲暱与', '着亲昵与'],
  ['舞干鏚', '舞干戚'],
  // 捱/背（opencc 误给传统形，还原为数据简体）
  ['愁绪难挨', '愁绪难捱'], ['子行挨推问', '子行捱推问'], ['耽疼痛，挨程途', '耽疼痛，捱程途'],
  ['疼痛挨著路程', '疼痛捱着路程'],
  ['自己揹着', '自己背着'], ['自己揹著', '自己背着'], ['肩挑揹负', '肩挑背负'],
  ['酒旗揹着', '酒旗背着'], ['酒旗揹著', '酒旗背着'], ['苍山揹负', '苍山背负'],
  ['只会揹人名', '只会背人名'],
  // 古典「著」语境还原（opencc t2s 把著→着，须还原回数据原字；随后由 ZHU_KEEP 保护不再转回）
  ['慢着火', '慢著火'], ['少着水', '少著水'], ['寒梅着花未', '寒梅著花未'],
  ['更着风和雨', '更著风和雨'], ['文章着', '文章著'], ['脚着谢公屐', '脚著谢公屐'],
  ['着得眼高', '著得眼高'], ['着得一部新书', '著得一部新书'], ['逢着则', '逢著则'],
  ['信着全无是处', '信著全无是处'], ['天上着词声', '天上著词声'], ['花着露', '花著露'],
  ['着瓦轻', '著瓦轻'], ['着地垂', '著地垂'], ['着危冠', '著危冠'], ['艾束着危冠', '艾束著危冠'],
  ['见微知着', '见微知著'], ['积微成着', '积微成著'], ['心不着相', '心不著相'],
  ['外不着相', '外不著相'], ['知见不着', '知见不著'],
  ['心无着', '心无著'], ['无染着', '无染著'], ['心无染着', '心无染著'], ['何处着我', '何处著我'],
  ['物皆着我', '物皆著我'], ['着此身', '著此身'], ['冰雪林中着此身', '冰雪林中著此身'],
  ['为时而着', '为时而著'], ['文章合为时而着', '文章合为时而著'], ['安排着', '安排著'],
  ['深更着花', '深更著花'], ['带着走', '带著走'],
]);

/* ── fixZhe 保护白名单：这些「著」语境必须原样保留（数据里的古典/人名/执著语境 + 标准简化词）──
 * 原则：只用长语境（≥2 字且不与其他现代「着」子串冲突），杜绝 睡不着/带着 之类误伤。
 * 数据原文「著」语境经 _zheprobe 全库枚举，此处逐条录入；标准简化词作运行时兜底。 */
const ZHU_KEEP = [
  // 标准简化词（opencc 本就保留著，防残余归一转错；运行时兜底）
  '著作', '著名', '显著', '土著', '编著', '巨著', '名著', '著述', '著者', '著称',
  '卓著', '昭著', '著录', '原著',
  // 数据古典「著」语境（_zheprobe 全库枚举，长语境防误伤）
  '见微知著', '积微成著', '著此身', '冰雪林中著此身', '不著才', '知见不著才',
  '心不著相', '外不著相', '心无著', '无染著', '心无染著', '著我之色彩', '物皆著我', '何处著我',
  '著地垂', '杨柳青青著地垂', '著危冠', '艾束著危冠', '著花未', '寒梅著花未', '更著花', '深更著花',
  '未著花', '秋来未著花',
  '更著风和雨', '文章著', '名岂文章著', '脚著谢公屐', '著论准过秦', '著文立论', '著书立说',
  '立志著书立说', '著书都为稻粱谋', '著书立业', '写著书立业', '著史理想', '著得一部新书',
  '著得眼高', '信著全无是处', '逢著则', '慢著火', '少著水', '安排著', '天上著词声',
  '花著露', '著瓦轻', '新霜著瓦轻', '为时而著', '文章合为时而著', '刘著', '带著走',
  // 数据「执著」语境（数据原文用传统体执著，须保留；其余「执着」语境归一为简体）
  '执著之者', '执著于德名', '不执著才是高手', '成败的执著', '德行不执著', '身意的执著',
  '无沾染执著', '下感官执著', '写放下执著的洒脱', '心不执著外相', '有牵挂执著',
  // 特殊：数据里唯一一处「想像春天」（其余 62 处用「想象」），残余归一 想像→想象 时保护
  '想像春天',
];

// 残余归一：把未保护的 著→着、想像→想象、执著→执着（执著已被 protect 兜住，此处兜底）
const RESIDUAL = [['著', '着'], ['想像', '想象'], ['执著', '执着']];

/* ── 工具 ── */
function applyOvs(s, ovs) { for (const [k, v] of ovs) if (s.includes(k)) s = s.split(k).join(v); return s; }
// 保护：最长优先、不重叠 地把白名单短语替换为占位符（返回 [带占位串, 映射]）
function protect(s, list) {
  const sorted = [...list].filter(Boolean).sort((a, b) => b.length - a.length);
  const ph = '\u0001';
  const map = new Map();
  let out = '', i = 0, k = 0;
  while (k < s.length) {
    let w = null;
    for (const cand of sorted) if (s.startsWith(cand, k)) { w = cand; break; }
    if (w) { const p = ph + (i++) + ph; out += p; map.set(p, w); k += w.length; }
    else { out += s[k]; k++; }
  }
  return [out, map];
}
function restore(s, map) { for (const [p, w] of map) s = s.split(p).join(w); return s; }
function residual(s) { for (const [k, v] of RESIDUAL) s = s.split(k).join(v); return s; }

// t2s 核心管线：覆写( opencc_t2s ) → 保护长语境 → 残余归一 → 还原
function t2sCore(s) {
  if (HAS_KANA.test(s)) return s;   // 日语原文：不归一（检索/还原两侧都保持原样，杜绝 猫→貓 之类误改）
  const [out, map] = protect(applyOvs(t2sFn(s), T2S_OVERRIDES), ZHU_KEEP);
  return restore(residual(out), map);
}

export function getMode() {
  if (mode == null) mode = readPref();
  return mode;
}
function readPref() {
  try { return localStorage.getItem(KEY) === 't' ? 't' : 's'; } catch { return 's'; }
}
function savePref(v) { try { localStorage.setItem(KEY, v); } catch {} }

// 懒加载 opencc：相对 i18n.js 自身的模块 URL 解析（跨页面深度都成立），不在 SW 预缓存之列、首访不占流量。
// 导出给 build/lang.test.mjs 在 Node 直跑同一份生产管线做全库校验。
export async function ensureOpenCC() {
  if (loadP) return loadP;
  loadP = (async () => {
    const [cn2t, t2cn] = await Promise.all([
      import('./opencc/cn2t.js'),
      import('./opencc/t2cn.js'),
    ]);
    s2tFn = cn2t.Converter({ from: 'cn', to: 'tw' });   // 台湾常用体：為/裡/眾/床 等，贴近繁体读者习惯
    t2sFn = t2cn.Converter({ from: 't', to: 'cn' });    // 检索归一 + 还原
  })().catch(e => { loadP = null; throw e; });
  return loadP;
}

// 简→繁（显示方向）。simplify-first：先归一简体再转繁体 → 幂等锚定。
// 无中文原样返回（省一次字典查找）。
export function s2t(text) {
  const s = String(text == null ? '' : text);
  if (!/[\u4e00-\u9fa5]/.test(s) || HAS_KANA.test(s)) return s;   // 无中文 或 日语原文：原样返回
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  let out = s2tFn ? s2tFn(t2sFn ? t2sCore(s) : s) : s;
  out = applyOvs(out, S2T_OVERRIDES);
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(s, out);
  return out;
}

// 繁→简。转换器未加载（简体模式）时原样返回。
export function t2s(text) {
  const s = String(text == null ? '' : text);
  if (!/[\u4e00-\u9fa5]/.test(s)) return s;
  return t2sFn ? t2sCore(s) : s;
}

// 查询归一：繁体模式下把用户输入的繁体查询转回简体，再进检索链路（索引/词典/建议全简体）。
export function normalizeQuery(q) {
  if (getMode() !== 't' || !t2sFn) return q;
  return t2sCore(String(q == null ? '' : q));
}

// 动态出口工具：渲染层在「元素已插入后再设置内容属性」（placeholder/title/data-txt 等）时用它包裹文本，
// 繁体模式下转繁体，简体模式下原样返回。插入时已带的属性走 walkConvert 统一转换，不需要这个。
export function displayText(s) {
  return getMode() === 't' ? s2t(s) : String(s == null ? '' : s);
}

/* ── DOM 转换：静态烘焙 + 动态渲染的统一出口 ───────────── */
// 只转「叶子文本节点 + 少量内容属性」，不改 href/src 等结构性属性；
// 跳过 data-lang-toggle（开关自身：文案/aria 指向下一语言，由 updateButton 单独维护）、
// .ignore-opencc（游戏题面等需保持简体的区域）、script/style/svg/textarea。
// 主题开关不跳过：其文案是图标、aria/title 是普通中文，随模式一并转换。
// 输入框 value 不转（用户输入原样保留）。
const origText = new WeakMap();   // 文本节点 -> 原始简体
const doneEl = new WeakSet();     // 已处理过属性的元素

function convertTextNode(tn) {
  const p = tn.parentElement;
  if (p && p.closest('[data-lang-toggle],.ignore-opencc')) return;   // 开关/游戏区永不转换（含 observer 路径，防双重转换）
  const cur = tn.nodeValue || '';
  const orig = origText.get(tn);
  if (orig !== undefined) {
    // 已标记过：若当前值就是上次转换的结果 → 跳过（防双转/防环）；
    // 否则说明运行期被更新成新文本（如 document.title 导航时反复改），以当前值重新标记再转。
    if (cur === s2t(orig)) return;
    origText.set(tn, cur);
  } else {
    origText.set(tn, cur);
  }
  if (cur && /[\u4e00-\u9fa5]/.test(cur)) tn.nodeValue = s2t(cur);
}

function convertElAttrs(el) {
  if (doneEl.has(el)) return;
  doneEl.add(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && /[\u4e00-\u9fa5]/.test(v)) el.setAttribute(a, s2t(v));
  }
}

function walkConvert(node) {
  if (node.nodeType === 1) {
    if (node.closest('[data-lang-toggle],.ignore-opencc')) return;   // 整棵子树跳过
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'TEXTAREA') return;
    convertElAttrs(node);
  }
  for (const child of node.childNodes) {
    if (child.nodeType === 3) convertTextNode(child);
    else if (child.nodeType === 1) walkConvert(child);
  }
}

// 切换回简体：把已转换节点恢复原文（文本取 WeakMap 原始值、属性用 t2s 反推），并清标记以便再次切换。
function restoreWalk(node) {
  if (node.nodeType === 3) {
    const o = origText.get(node);
    if (o !== undefined) { if (node.nodeValue !== o) node.nodeValue = o; origText.delete(node); }
    return;
  }
  if (node.nodeType === 1) {
    if (node.closest('[data-lang-toggle],.ignore-opencc')) return;
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'TEXTAREA') return;
    if (doneEl.has(node)) {
      for (const a of ATTRS) {
        const v = node.getAttribute(a);
        if (v && /[\u4e00-\u9fa5]/.test(v)) node.setAttribute(a, t2s(v));
      }
      doneEl.delete(node);
    }
  }
  for (const child of node.childNodes) {
    if (child.nodeType === 3 || child.nodeType === 1) restoreWalk(child);
  }
}

function applyAll() {
  document.documentElement.setAttribute('lang', 'zh-TW');
  walkConvert(document.documentElement);   // 含 <title> 与整个 body
}
function restoreAll() {
  document.documentElement.setAttribute('lang', 'zh-CN');
  restoreWalk(document.documentElement);
}

/* ── 动态内容监听：仅在繁体模式启用 ─────────────────── */
// 只观察 childList + characterData：转换节点值只触发 characterData，已被 origText 标记跳过，不会成环。
let observer = null;
function startObserver() {
  if (observer) return;
  observer = new MutationObserver(records => {
    for (const mut of records) {
      if (mut.type === 'characterData') convertTextNode(mut.target);
      else if (mut.type === 'childList') {
        for (const n of mut.addedNodes) {
          if (n.nodeType === 3) convertTextNode(n);
          else if (n.nodeType === 1) walkConvert(n);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
function stopObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

/* ── 开关 ─────────────────────────────────────── */
function toggleLabel() { return getMode() === 't' ? '简' : '繁'; }
function updateButton() {
  const b = document.querySelector('[data-lang-toggle]');
  if (!b) return;
  const next = getMode() === 't' ? '简体' : '繁體';
  b.textContent = toggleLabel();
  b.setAttribute('aria-label', '切换到' + next);
  b.title = '切换到' + next;
}

async function switchTo(next) {
  if (next === 't') {
    const b = document.querySelector('[data-lang-toggle]');
    if (b) b.textContent = '…';
    try { await ensureOpenCC(); }
    catch (e) {
      console.error('[i18n] 繁体字典加载失败，保持简体', e);
      updateButton();
      return;
    }
    mode = 't'; savePref('t');
    applyAll();
    startObserver();
  } else {
    mode = 's'; savePref('s');
    stopObserver();
    restoreAll();
  }
  updateButton();
}

// 挂载入口：开关按钮已由模板烘焙进顶栏（.head-inner），此处兜底注入并统一接管点击。
export function mountLang(root = document) {
  if (getMode() === 't') {
    // 上次选了繁体：先立语言标识并启动监听；opencc 字典就绪后再做整树转换。
    // 不能在此刻同步 applyAll()——懒加载未完成时 s2t 无转换器会原样返回（仅 lang 生效、文本转不动），
    // 且 doneEl 会被提前标记、导致字典就绪后的整树转换跳过属性。字典加载失败则回退简体。
    document.documentElement.setAttribute('lang', 'zh-TW');
    startObserver();
    ensureOpenCC()
      .then(() => { applyAll(); })
      .catch(() => { mode = 's'; savePref('s'); document.documentElement.setAttribute('lang', 'zh-CN'); updateButton(); });
  }

  const head = root.querySelector('.head-inner');
  if (head && !root.querySelector('[data-lang-toggle]')) {
    const b = document.createElement('button');
    b.className = 'theme-toggle lang-toggle';
    b.type = 'button';
    b.setAttribute('data-lang-toggle', '');
    head.appendChild(b);
  }
  updateButton();   // 同步按钮文案/aria/title 到当前语言（烘焙进模板或兜底注入的按钮都覆盖）
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-lang-toggle]');
    if (!b) return;
    switchTo(getMode() === 't' ? 's' : 't');
  });
}
