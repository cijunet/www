// 抓取「历史上的今天」全年数据（数据源：jintian.txcx.com 通晓查询）
// 用法：node build/fetch-history.mjs [--force]
//   生成 data/history-raw.json，支持断点续抓（已抓过的日期自动跳过，--force 全量重抓）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'history-raw.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FORCE = process.argv.includes('--force');

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 含 2/29，闰日单独兜底

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchDay(m, d, tries = 3) {
  const url = `https://jintian.txcx.com/today-${m}-${d}.html`;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 404) return []; // 该日无页面（基本不会出现）
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      return parse(html);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1200 * (i + 1));
    }
  }
  return [];
}

function decodeEnt(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

function parse(html) {
  const out = [];
  const re = /<span>\s*\[\s*(\d{2,4})\s*年\s*\][^<]*<\/span>\s*<a[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const y = Number(m[1]);
    const t = decodeEnt(m[2].replace(/<[^>]+>/g, ''));
    if (!y || y < 100 || t.length < 5) continue;
    out.push({ y, t });
  }
  // 去重（同年同文）
  const seen = new Set();
  return out.filter(e => { const k = e.y + '|' + e.t; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ── 主流程 ──
let raw = { source: 'jintian.txcx.com', fetched: '', days: {} };
if (fs.existsSync(OUT) && !FORCE) {
  try { raw = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
}
raw.days = raw.days || {};

const todo = [];
for (let m = 1; m <= 12; m++) for (let d = 1; d <= DAYS_IN_MONTH[m - 1]; d++) {
  const key = String(m).padStart(2, '0') + String(d).padStart(2, '0');
  if (!FORCE && Array.isArray(raw.days[key])) continue;
  todo.push([m, d, key]);
}

console.log(`待抓取 ${todo.length} 天（已有 ${366 - todo.length} 天）`);
let done = 0, failed = [];
for (const [m, d, key] of todo) {
  try {
    const ev = await fetchDay(m, d);
    raw.days[key] = ev;
    done++;
    if (done % 20 === 0 || done === todo.length) {
      raw.fetched = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(OUT, JSON.stringify(raw));
      console.log(`  进度 ${done}/${todo.length}（${key} 收录 ${ev.length} 条）`);
    }
    await sleep(300 + Math.random() * 250);
  } catch (e) {
    failed.push(key);
    console.warn(`  ✗ ${key} 失败：${e.message}`);
  }
}

raw.fetched = new Date().toISOString().slice(0, 10);
fs.writeFileSync(OUT, JSON.stringify(raw));

const empty = Object.entries(raw.days).filter(([k, v]) => !v.length).map(([k]) => k);
console.log(`\n完成：${Object.keys(raw.days).length} 天，失败 ${failed.length}${failed.length ? '（' + failed.join(',') + '）' : ''}`);
if (empty.length) console.log(`空数据日期 ${empty.length} 个：${empty.join(',')}`);
if (failed.length) console.log('可重新运行本脚本续抓失败日期。');
