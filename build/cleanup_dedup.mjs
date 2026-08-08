// 同源近重复去重 + 长度卫生（安全、可复现、可还原）
// 唯一真源：data/词句数据.xlsx。本脚本只改「词句」sheet，其余 sheet 不动。
// 安全：调用前请先备份 xlsx；运行后生成 data/removed_<日期>.json 隔离清单（含原文，可还原）。
// 用法：
//   node build/cleanup_dedup.mjs            # 真正执行（写回 xlsx）
//   node build/cleanup_dedup.mjs --dry      # 预演：只打印统计 + 写隔离清单，不碰 xlsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'data', '词句数据.xlsx');
const DRY = process.argv.includes('--dry');

// 与 load.mjs 完全一致的归一化与 id 解析
const normText = (s) => String(s == null ? '' : s).replace(/[\s，。、？！；：""''‘’“”（）()《》·—…\-.,!?;:]/g, '');
const splitIds = (v) => String(v == null ? '' : v).split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
const joinIds = (arr) => [...new Set(arr)].join('，');

const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: 'buffer' });
const ws = wb.Sheets['词句'];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
const head = aoa[0];
const col = (name) => head.findIndex(h => String(h).trim() === name);
const CI = { t: col('正文'), a: col('作者'), w: col('作品'), s: col('场景id'), m: col('心情id'), pl: col('地点id') };
const data = aoa.slice(1);

// 建条目
const entries = data.map((row, i) => {
  const t = String(row[CI.t] ?? '').trim();
  const a = String(row[CI.a] ?? '').trim();
  const w = String(row[CI.w] ?? '').trim();
  return {
    idx: i, row,
    t, a, w,
    norm: normText(t),
    len: normText(t).length,
    sIds: splitIds(row[CI.s]),
    mIds: splitIds(row[CI.m]),
    pIds: splitIds(row[CI.pl]),
    removed: false, reason: null, mergedInto: null,
  };
});

const MIN = 4, MAX = 50;
let nShort = 0, nLong = 0, nSub = 0;
const quarantine = [];

// ── Pass1：长度卫生 ──
for (const e of entries) {
  if (e.removed) continue;
  if (e.len < MIN) { e.removed = true; e.reason = 'too_short'; nShort++; }
  else if (e.len > MAX) { e.removed = true; e.reason = 'too_long'; nLong++; }
}

// ── Pass2：同源近重复（同作者+同作品 内，短句为长句的子串）──
// 按 (作者,作品) 分组，仅当两者都非空才参与（避免误并独立名句）
const groups = new Map();
for (const e of entries) {
  if (e.removed) continue;
  if (!e.a || !e.w) continue;
  const key = e.a + '\u0000' + e.w;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(e);
}

function mergeTags(frag, into) {
  const ns = [...new Set([...into.sIds, ...frag.sIds])];
  const nm = [...new Set([...into.mIds, ...frag.mIds])];
  const np = [...new Set([...into.pIds, ...frag.pIds])];
  into.row[CI.s] = joinIds(ns); into.sIds = ns;
  into.row[CI.m] = joinIds(nm); into.mIds = nm;
  into.row[CI.pl] = joinIds(np); into.pIds = np;
}

for (const [, g] of groups) {
  // 标记碎片：norm 是组内更长的某条的子串
  for (const f of g) {
    if (f.removed) continue;
    const containers = g.filter(c => c !== f && !c.removed && c.norm.length >= f.norm.length && c.norm.includes(f.norm));
    if (containers.length) {
      // 优先并入「在界内(未因长度移除)」的最长容器；否则退而求其次取最长容器
      const inb = containers.filter(c => !c.removed);
      const pool = inb.length ? inb : containers;
      // 最长优先，平局取原序靠前的
      pool.sort((x, y) => (y.norm.length - x.norm.length) || (x.idx - y.idx));
      const target = pool[0];
      mergeTags(f, target);
      f.removed = true; f.reason = 'substring'; f.mergedInto = target.t; nSub++;
    }
  }
}

// 隔离清单
for (const e of entries) {
  if (!e.removed) continue;
  quarantine.push({
    index: e.idx, reason: e.reason, mergedInto: e.mergedInto,
    '正文': e.t, '作者': e.a, '作品': e.w,
    '场景id': e.row[CI.s], '心情id': e.row[CI.m], '地点id': e.row[CI.pl],
    '怎么用': e.row[col('怎么用')], '外文原句': e.row[col('外文原句')], '白话': e.row[col('白话')],
  });
}

const kept = entries.filter(e => !e.removed);
const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const QPATH = path.join(ROOT, 'data', `removed_${date}.json`);
fs.writeFileSync(QPATH, JSON.stringify(quarantine, null, 2), 'utf8');

console.log('=== ciju 数据去重预演/执行报告 ===');
console.log('  总条目:', entries.length);
console.log('  删除 - 同源拆分(子串):', nSub);
console.log('  删除 - 太短(<' + MIN + '字):', nShort);
console.log('  删除 - 太长(>' + MAX + '字):', nLong);
console.log('  删除合计:', nShort + nLong + nSub, ' (', ((nShort + nLong + nSub) / entries.length * 100).toFixed(1) + '% )');
console.log('  保留:', kept.length);
console.log('  隔离清单:', QPATH, `(共 ${quarantine.length} 条，含原文，可还原)`);

if (DRY) {
  console.log('\n[DRY] 未改动 xlsx。确认无误后去掉 --dry 再运行。');
  // 抽样展示将被删的同源碎片
  const sample = quarantine.filter(q => q.reason === 'substring').slice(0, 8);
  console.log('\n  同源碎片抽样(删前→并入整句):');
  for (const q of sample) console.log('   -', q['正文'], '  → ', q.mergedInto);
} else {
  // 写回：重建 词句 sheet（仅删行，其余 sheet 原样保留）
  const newAoa = [head, ...data.filter((_, i) => !entries[i].removed)];
  wb.Sheets['词句'] = XLSX.utils.aoa_to_sheet(newAoa);
  XLSX.writeFile(wb, XLSX_PATH);
  console.log('\n[DONE] 已写回', XLSX_PATH, '，保留', kept.length, '条。');
}
