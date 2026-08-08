// build/cleanup_fragments.mjs
// 第一步（按用户新计划）：删除「既重复又特别短」的硬拆碎片。
// 判定口径（与用户确认）：
//   1) 短句(≤24字) 是另一条更长句的连续子串（正文包含）；
//   2) 两者作品名归一化后相容（一含另一，如 念奴娇 ⊂ 念奴娇·赤壁怀古、劝学 ⊂ 荀子·劝学）；
//   3) 两者作品名都非空（作品为空/互斥 → 保守跳过，避免误删独立名句）。
// 处理：删短留长；碎片独有的 场景/心情/地点 标签并入最长整句（不丢可发现性）。
// 安全：先备份 xlsx（外部已做）；被删条目全部写入 data/removed_<ts>.json 可还原。
// 用法：
//   node build/cleanup_fragments.mjs --dry     # 预演：只统计 + 写隔离清单，不改 xlsx
//   node build/cleanup_fragments.mjs           # 真正写回 xlsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'data', '词句数据.xlsx');
const DRY = process.argv.includes('--dry');
const TS = '20260808b';
// 用户口径（2026-08-08）：只删「既重复又特别短」的 ≤4 字残片；5 字以上名句碎片保留
const FRAG_MAX = 4;   // 仅删除归一化长度 ≤4 字的碎片
const SCAN_MAX = 24;  // 检测范围：短句(≤24字) 是否被更长句包含

// 归一化（与 load.mjs 口径一致）
const normText = s => String(s == null ? '' : s).replace(/[\s，。、？！；：""''‘’“”（）()《》·—…\-.,!?;:]/g, '');
// 作品名归一化：去书名号、去标点空白、去「·」前后缀差异仅保留字符序列
const normWork = s => String(s == null ? '' : s)
  .replace(/[《》\s，。、？！；：""''‘’“”（）()·—…\-.,!?;:]/g, '')
  .replace(/^[·]+|[·]+$/g, '');
const splitIds = v => String(v == null ? '' : v).split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
const joinIds = arr => [...new Set(arr)].join('，');
// 作品名相容：一含另一（含完全相等）
const workCompat = (a, b) => {
  const na = normWork(a), nb = normWork(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
};

console.log(DRY ? '模式: [DRY] 预演（不改 xlsx）' : '模式: [APPLY] 将写回 xlsx');
console.log('读取:', XLSX_PATH);

const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: 'buffer' });
const ws = wb.Sheets['词句'];
if (!ws) throw new Error('词句 sheet 不存在');
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
const header = aoa[0].map(h => String(h).trim());
const col = name => header.indexOf(name);
const CI = {
  t: col('正文'), a: col('作者'), w: col('作品'), d: col('年代国别'),
  s: col('场景id'), m: col('心情id'), pl: col('地点id'),
  n: col('怎么用'), o: col('外文原句'), x: col('白话')
};
if ([CI.t, CI.a, CI.w, CI.s, CI.m, CI.pl].some(i => i < 0)) throw new Error('表头列缺失: ' + JSON.stringify(CI));

const dataRows = aoa.slice(1);
const entries = dataRows.map((row, i) => {
  const t = String(row[CI.t] ?? '').trim();
  const norm = normText(t);
  return {
    i, row,
    t, norm,
    len: norm.length,
    a: String(row[CI.a] ?? '').trim(),
    w: String(row[CI.w] ?? '').trim(),
    sRaw: String(row[CI.s] ?? '').trim(),
    mRaw: String(row[CI.m] ?? '').trim(),
    plRaw: String(row[CI.pl] ?? '').trim(),
    removed: false,
    reason: null,
    mergedInto: null,
  };
});

const removed = new Set();      // 待删 entry index
const reason = new Map();       // i -> 'substring' | 'exact_dup'
const mergedInto = new Map();   // i(碎片) -> 保留整句正文
const quarantine = [];

// ── 主检测：短句(≤MAX_LEN) 被更长句包含，且作品名相容 → 碎片 ──
const byLen = entries.filter(e => e.norm.length > 0).slice().sort((a, b) => a.norm.length - b.norm.length);
const lens = byLen.map(x => x.norm.length);

for (const e of entries) {
  if (e.norm.length === 0 || e.norm.length > SCAN_MAX) continue;
  // 二分：只与更长（或等长且更靠后）的条目比较
  let lo = 0, hi = lens.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (lens[mid] >= e.norm.length) hi = mid; else lo = mid + 1; }
  let best = null; // 最长且作品相容的承载整句
  for (let k = lo; k < byLen.length; k++) {
    const L = byLen[k];
    if (L.i === e.i) continue;
    if (L.norm.length === e.norm.length && L.norm === e.norm) {
      // 完全同正文：作品相容即视为重复（保留先出现者）
      if (workCompat(e.w, L.w)) {
        if (L.i > e.i && (!best || L.norm.length > best.norm.length)) best = L;
        else if (L.i < e.i && !best) best = L;
      }
      continue;
    }
    if (L.norm.length < e.norm.length) break;
    if (!L.norm.includes(e.norm)) continue;
    if (!workCompat(e.w, L.w)) continue; // 作品不相容 → 不同源，跳过
    if (!best || L.norm.length > best.norm.length) best = L;
  }
  // 仅当碎片长度 ≤ FRAG_MAX 才删除（用户口径：只删特别短的残片）
  if (best && e.norm.length <= FRAG_MAX) {
    removed.add(e.i);
    reason.set(e.i, best.norm === e.norm ? 'exact_dup' : 'substring');
    mergedInto.set(e.i, best.t);
  }
}

// ── 标签并入：碎片 → 其最长承载整句（若承载整句本身也是碎片，则级联上溯）──
const mergeIds = (target, src) => {
  const s = new Set([...splitIds(target.row[CI.s] ?? ''), ...splitIds(src.row[CI.s] ?? '')]);
  const m = new Set([...splitIds(target.row[CI.m] ?? ''), ...splitIds(src.row[CI.m] ?? '')]);
  const p = new Set([...splitIds(target.row[CI.pl] ?? ''), ...splitIds(src.row[CI.pl] ?? '')]);
  target.row[CI.s] = joinIds([...s]);
  target.row[CI.m] = joinIds([...m]);
  target.row[CI.pl] = joinIds([...p]);
};

for (const i of removed) {
  const frag = entries[i];
  // 找承载者：正文包含 frag 且作品相容的最长条目（优先未删除的）
  let keeper = null;
  for (const L of byLen) {
    if (L.i === i) continue;
    if (removed.has(L.i)) continue;
    if (L.norm.length < frag.norm.length) continue;
    if (!L.norm.includes(frag.norm)) continue;
    if (!workCompat(frag.w, L.w)) continue;
    if (!keeper || L.norm.length > keeper.norm.length) keeper = L;
  }
  if (keeper) {
    mergeIds(keeper, frag);
    // 更新 mergedInto 为实际保留行正文
    mergedInto.set(i, keeper.t);
  }
}

// ── 生成隔离清单 ──
for (const i of removed) {
  const e = entries[i];
  quarantine.push({
    reason: reason.get(i),
    mergedInto: mergedInto.get(i) || null,
    正文: e.t, 作者: e.a, 作品: e.w, 年代国别: e.row[CI.d],
    场景id: e.sRaw, 心情id: e.mRaw, 地点id: e.plRaw,
    怎么用: e.row[CI.n], 外文原句: e.row[CI.o], 白话: e.row[CI.x]
  });
}

// ── 统计 ──
const byReason = {};
for (const q of quarantine) byReason[q.reason] = (byReason[q.reason] || 0) + 1;

console.log('\n=== 预演/执行 结果 ===');
console.log('原始有效条目:', entries.filter(e => e.norm.length > 0).length);
console.log('删除合计    :', removed.size, JSON.stringify(byReason));
console.log('口径        : 仅删 ≤' + FRAG_MAX + '字 且被更长句包含、作品名相容的碎片');
console.log('保留预计    :', entries.length - removed.size);
console.log('隔离清单    :', `data/removed_${TS}.json (${quarantine.length} 条)`);

// 抽样展示（全部，因数量少）
console.log('\n— 删除清单（全部）—');
for (const q of quarantine) {
  console.log(`  [${q.reason}] ${String(q.正文).slice(0, 22)}  → 并入「${String(q.mergedInto || '(无)').slice(0, 24)}」`);
}

// ── 写隔离清单（无论 dry 与否都写）──
const qPath = path.join(ROOT, 'data', `removed_${TS}.json`);
fs.writeFileSync(qPath, JSON.stringify(quarantine, null, 2), 'utf8');

if (DRY) {
  console.log('\n[DRY] 未改动 xlsx。确认无误后去掉 --dry 重跑即写回。');
  process.exit(0);
}

// ── 真正写回：重建 词句 sheet（仅删行 + 写回合并标签），其余 sheet 原样 ──
const keptRows = dataRows.filter((_, i) => !removed.has(i));
const newAoa = [header, ...keptRows];
wb.Sheets['词句'] = XLSX.utils.aoa_to_sheet(newAoa);
XLSX.writeFile(wb, XLSX_PATH);
console.log('\n[APPLY] 已写回:', XLSX_PATH, '→ 保留', keptRows.length, '条');
console.log('备份: data/词句数据.backup_' + TS + '.xlsx | 隔离: data/removed_' + TS + '.json');
