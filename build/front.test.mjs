/* 词句站前端无头自测：假 DOM + 真实 msgpack 数据，真实执行 app.js 核心路径
 * 覆盖：今日主题渲染 / 关键词搜索 / 拼音搜索 / 收藏 / 导出 md / 导入
 * 用法：node _front_test.mjs  （临时脚本，测完删除）
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { JQ } from './_jq_data.mjs';
const require = createRequire(import.meta.url);

/* ── 1. mock 全局 ── */
const BUF = fs.readFileSync('WWW/data/pieces.msgpack');
global.window = global;
// 模拟首页内联注入的节气数据（真实构建由 build/pages.mjs 注入到 index.html）
global.__JQ_DATA = JQ.map(j => ({ id: j.id, name: j.name, date: j.date, time: j.time, folk: j.folk, proverb: j.proverb, food: j.food }));
const winListeners = {};
global.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
global.removeEventListener = (t, fn) => { if (winListeners[t]) winListeners[t] = winListeners[t].filter(f => f !== fn); };
global.__winEmit = (t, ev) => { (winListeners[t] || []).forEach(fn => fn(ev)); };
global.msgpack = require('msgpack-lite');

global.__blobCount = 0; global.__lastBlob = '';
global.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = (opts || {}).type || ''; global.__lastBlob = parts.join(''); } };
global.URL = { createObjectURL() { global.__blobCount++; return 'blob:mock'; }, revokeObjectURL() {} };
global.FileReader = class { readAsText() { this.onload && this.onload({ target: { result: '[]' } }); } };
global.SpeechSynthesisUtterance = class {};
global.Event = class { constructor(t) { this.type = t; } };
global.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
global.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
global.history = { replaceState() {}, pushState() {} };
global.location = { href: 'http://localhost/', search: '', pathname: '/' };
global.scrollTo = () => {};
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
Object.defineProperty(global, 'navigator', {
  value: {
    language: 'zh-CN',
    speechSynthesis: { speak() {}, cancel() {}, getVoices() { return [{ lang: 'zh-CN', name: 'x' }]; } }
  },
  configurable: true
});
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.__fetchedUrls = [];
const HIST = JSON.parse(fs.readFileSync('WWW/data/history.json', 'utf8'));
global.fetch = (url) => {
  const u = String(url);
  global.__fetchedUrls.push(u);
  if (u.includes('msgpack')) return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new Uint8Array(BUF.buffer, BUF.byteOffset, BUF.byteLength)) });
  if (u.includes('history')) return Promise.resolve({ ok: true, json: () => Promise.resolve(HIST) });
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ pieces: [], scenes: [], moods: [], places: [] }) });
};

/* 固定"今天"为立秋日（2026-08-07），验证节气融入今日/搜索提示/随机 */
const RealDate = Date;
const FIXED_T = new RealDate('2026-08-07T10:00:00+08:00').getTime();
class FakeDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [FIXED_T])); }
  static now() { return FIXED_T; }
}
global.Date = FakeDate;

/* ── 2. 假 DOM（共享池：document.querySelector 与 El.querySelector 同池，footer 特殊） ── */
const pool = new Map();
class El {
  constructor(sel) {
    this.sel = sel; this.children = []; this._l = {}; this.style = {};
    this.dataset = {}; this.value = ''; this.placeholder = ''; this.hidden = false;
    this.innerHTML = ''; this.textContent = ''; this.className = ''; this.href = '';
    this.download = ''; this.id = '';
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }
  addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
  dispatchEvent(ev) { (this._l[ev.type] || []).forEach(fn => fn(ev)); return true; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  insertBefore(c) { this.children.push(c); }
  setAttribute(k, v) { this[k] = String(v); }
  getAttribute(k) { return this[k] !== undefined ? this[k] : null; }
  removeAttribute(k) { delete this[k]; }
  closest(sel) {
    if (sel === '[data-fav]' && this.getAttribute('data-fav')) return this;
    if (sel === '[data-copy]' && this.getAttribute('data-copy')) return this;
    if (sel === '[data-rel]' && this.getAttribute('data-rel')) return this;
    return null;
  }
  querySelector(sel) { return elFor(sel); }
  querySelectorAll() { return []; }
  focus() {} select() {} scrollIntoView() {} click() { (this._l.click || []).forEach(fn => fn({ preventDefault() {}, target: this })); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
}
function elFor(sel) { if (!pool.has(sel)) pool.set(sel, new El(sel)); return pool.get(sel); }

const docListeners = {};
global.document = {
  body: elFor('body'),
  documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, getAttribute() { return 'light'; } },
  createElement: () => new El('created'),
  getElementById: () => null,
  querySelector: (sel) => elFor(sel),
  querySelectorAll: (sel) => (sel === '[data-fav]' ? [] : []),
  addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
  execCommand: () => true
};
// 预处理：link[rel=stylesheet] 用相对路径（同真实 index.html）；footer 子查询返回 null 触发注入
elFor('link[rel=stylesheet]').href = './assets/style.css';
const footer = new El('footer'); footer.querySelector = () => null;
pool.set('footer', footer);

/* ── 3. 执行 app.js ── */
const src = fs.readFileSync('assets/app.js', 'utf8');
new Function(src)();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

/* ── 4. 测试序列 ── */
await sleep(1200); // 等首次数据加载 + 今日主题 + favSync 注入

console.log('T0 节气融入今日（固定 8 月 7 日 = 立秋）');
const todayBox = pool.get('[data-today]');
const todayHtml = todayBox ? todayBox.innerHTML : '';
ok(todayHtml.includes('t-jq'), '今日区块渲染节气文化条');
ok(todayHtml.includes('立秋'), '节气条含节气名');
ok(todayHtml.includes('三候') && todayHtml.includes('农谚'), '节气条含三候/农谚');
const hotBar = pool.get('.hero-hot');
ok(hotBar.innerHTML.includes('hot-today'), '搜索区显示今日徽标');
const searchQ = pool.get('.hero-search input[name="q"]');
ok(searchQ.placeholder.includes('立秋'), '搜索占位符含今日节气');

console.log('T1 数据加载与今日主题');
const today = pool.get('[data-today]');
ok(today && today.hidden === false, '今日主题区块显示（hidden=false）');
const todayList = pool.get('[data-today-list]');
ok(todayList && todayList.innerHTML.length > 100, '今日列表已渲染（innerHTML ' + (todayList ? todayList.innerHTML.length : 0) + ' 字符）');

console.log('T2 关键词搜索');
const q = pool.get('#q');
const results = pool.get('#results');
q.value = '想家';
q.dispatchEvent(new global.Event('input'));
await sleep(600);
ok(results.innerHTML.includes('q-text'), '搜索结果渲染卡片（含 q-text）');
ok(results.innerHTML.length > 300, '结果非空（' + results.innerHTML.length + ' 字符）');
ok(/t-(short|mid)/.test(results.innerHTML), '长度分级生效（出现极短/适中，非全偏长）');
ok(results.innerHTML.includes('data-fav'), '动态卡片含收藏按钮');
ok(results.innerHTML.includes('aria-label'), '卡片按钮含 aria-label');

console.log('T3 拼音搜索（sls → 苏轼）');
q.value = 'sls';
q.dispatchEvent(new global.Event('input'));
await sleep(1500); // 拼音扩展 500ms 延迟 + 二次搜索异步渲染
ok(results.innerHTML.includes('苏轼'), '拼音 sls 命中苏轼句（扩展为 "sls 苏轼"）');
console.log('    扩展后输入值: ' + JSON.stringify(q.value));

console.log('T4 收藏');
const favBtn = new El('favbtn');
favBtn.setAttribute('data-fav', 'mock-id-1');
favBtn.closest = (sel) => (sel === '[data-fav]' ? favBtn : null);
(docListeners.click || []).forEach(fn => fn({ target: favBtn }));
ok((store['ciju.fav'] || '').includes('mock-id-1'), '收藏写入 localStorage');
// 再点一次应取消
(docListeners.click || []).forEach(fn => fn({ target: favBtn }));
ok(!(store['ciju.fav'] || '').includes('mock-id-1'), '再点取消收藏');

console.log('T5 页脚清理（导出/纠错入口已移除）');
// 用户要求移除页脚"导出收藏/导出JSON/导入收藏/纠错·建议"注入
const injected = footer.children.find(c => c.getAttribute && c.getAttribute('data-fav-sync') !== null);
ok(!injected, '页脚无导出/导入入口');
const fbLink = footer.children.find(c => c.getAttribute && c.getAttribute('data-feedback') !== null);
ok(!fbLink, '页脚无纠错·建议入口');
ok(footer.children.length === 0, '页脚无多余注入元素');

console.log('T7 数据 URL 拼接健康（防缺斜杠回归）');
const dataUrls = global.__fetchedUrls.filter(u => u.includes('data/'));
ok(dataUrls.length >= 1, '发起过数据请求（' + dataUrls.length + ' 次）');
ok(dataUrls.every(u => /\.\/data\//.test(u) || /^https?:\/\/[^/]+\/data\//.test(u)), '数据 URL 均含正确斜杠分隔: ' + JSON.stringify(dataUrls));
const bad = dataUrls.filter(u => /(localhost|\d{4}|\.[a-z]+)data\//.test(u));
ok(bad.length === 0, '无畸形 URL（' + (bad[0] || '无') + '）');

console.log('T6 数据完整性（msgpack 可解码为真实数据）');
const data = global.msgpack.decode(new Uint8Array(BUF.buffer, BUF.byteOffset, BUF.byteLength));
ok(data.pieces && data.pieces.length > 10000, '词句 ' + (data.pieces ? data.pieces.length : 0) + ' 条');
ok(data.scenes && data.scenes.length === 272, '场景 272');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
