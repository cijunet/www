// 数据装载 + 规范化 + 校验
// 数据源：data/词句数据.xlsx（唯一真源）。改数据只改这个 Excel，再跑 build。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { slugify, authorSlugTable, hash, charLen } from './util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'data', '词句数据.xlsx');

const CLASSIC_DYN = ['先秦','春秋','战国','汉','三国','晋','南北朝','隋','唐','五代','宋','元','明','清','近代'];

function originOf(p) {
  const d = p.d || '';
  if (p.o) return 'world';
  if (CLASSIC_DYN.includes(d)) return 'classic';
  if (/现代|当代/.test(d)) return 'modern';
  if (!d) return 'modern';
  return 'world';
}

// 读取某个工作表为二维数组（含表头）
function rowsOf(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
}
function toObj(rows) {
  if (!rows.length) return [];
  const head = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i]; });
    return o;
  });
}
const splitIds = (v) => String(v == null ? '' : v).split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
const asStr = (v) => (v == null ? '' : String(v).trim());

export async function loadAll() {
  if (!fs.existsSync(XLSX_PATH)) throw new Error(`找不到数据源：${XLSX_PATH}\n请先运行 node build/make-xlsx.mjs 生成，或直接提供该 Excel。`);
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: 'buffer' });
  const warnings = [];

  // ── 大类 ──
  const groups = toObj(rowsOf(wb, '大类')).map(g => ({ id: asStr(g.id), name: asStr(g['名称']), tag: asStr(g['标签']) }))
    .filter(g => g.id);

  // ── 场景 ──
  const scenes = toObj(rowsOf(wb, '场景')).map(s => ({
    id: asStr(s.id), g: asStr(s['大类id']), name: asStr(s['名称']),
    desc: asStr(s['描述']), kw: splitIds(s['关键词'])
  })).filter(s => s.id);

  // ── 心情 ──
  const moods = toObj(rowsOf(wb, '心情')).map(m => ({ id: asStr(m.id), name: asStr(m['名称']), desc: asStr(m['描述']) }))
    .filter(m => m.id);

  const sceneMap = Object.fromEntries(scenes.map(s => [s.id, s]));
  const moodMap = Object.fromEntries(moods.map(m => [m.id, m]));
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));
  const scenesByGroup = groups.map(g => ({ ...g, scenes: scenes.filter(s => s.g === g.id) }));

  // ── 词句 ──
  const raw = toObj(rowsOf(wb, '词句'))
    .map((p, i) => ({
      t: asStr(p['正文']), a: asStr(p['作者']), w: asStr(p['作品']), d: asStr(p['年代国别']),
      s: splitIds(p['场景id']), m: splitIds(p['心情id']),
      n: asStr(p['怎么用']), o: asStr(p['外文原句']), x: asStr(p['白话']), _i: i
    }))
    .filter(p => p.t);

  const seen = new Map();
  const pieces = [];
  for (const p of raw) {
    if (!p.t) { warnings.push(`第 ${p._i + 2} 行缺正文，已跳过`); continue; }
    const key = p.t.replace(/\s/g, '');
    if (seen.has(key)) { warnings.push(`重复词句「${p.t.slice(0, 14)}…」 与第 ${seen.get(key) + 2} 行`); continue; }
    seen.set(key, p._i);

    // 自动纠错：场景/心情 id 写串位是最常见的错误，能救的直接救
    const sRaw = [...new Set(p.s)];
    const mRaw = [...new Set(p.m)];
    const sList = [], mList = [...mRaw.filter(id => moodMap[id])];

    for (const id of sRaw) {
      if (sceneMap[id]) { sList.push(id); continue; }
      if (moodMap[id]) { if (!mList.includes(id)) mList.push(id); continue; }      // 心情写进了场景位
      if (groupMap[id]) { warnings.push(`第 ${p._i + 2} 行「${p.t.slice(0, 10)}」用了大类 ${id} 当场景，已忽略`); continue; }
      warnings.push(`第 ${p._i + 2} 行「${p.t.slice(0, 10)}」未知场景 ${id}`);
    }
    for (const id of mRaw) {
      if (moodMap[id]) continue;
      if (sceneMap[id]) { if (!sList.includes(id)) sList.push(id); continue; }     // 场景写进了心情位
      warnings.push(`第 ${p._i + 2} 行「${p.t.slice(0, 10)}」未知心情 ${id}`);
    }
    if (!sList.length) warnings.push(`第 ${p._i + 2} 行「${p.t.slice(0, 10)}」没有任何有效场景，不会出现在任何场景页`);

    const author = p.a || '佚名';
    const authorSlug = slugify(author, authorSlugTable);
    pieces.push({
      ...p,
      id: hash(key),
      a: author,
      authorSlug,
      s: sList,
      m: mList,
      origin: originOf(p),
      len: charLen(p.t),
      sceneRefs: sList.map(id => sceneMap[id])
    });
  }

  // 作者索引
  const authorMap = new Map();
  for (const p of pieces) {
    if (!authorMap.has(p.authorSlug)) authorMap.set(p.authorSlug, { slug: p.authorSlug, name: p.a, d: p.d, pieces: [] });
    authorMap.get(p.authorSlug).pieces.push(p);
  }
  const authors = [...authorMap.values()].sort((a, b) => b.pieces.length - a.pieces.length);

  // 场景 -> 词句
  const bySceneMap = {};
  for (const s of scenes) bySceneMap[s.id] = [];
  for (const p of pieces) for (const id of p.s) bySceneMap[id].push(p);
  for (const id in bySceneMap) bySceneMap[id].sort((a, b) => a.len - b.len);

  const byMoodMap = {};
  for (const m of moods) byMoodMap[m.id] = [];
  for (const p of pieces) for (const id of p.m) byMoodMap[id].push(p);

  const empties = scenes.filter(s => !bySceneMap[s.id].length).map(s => s.id);
  if (empties.length) warnings.push(`空场景（无任何词句）：${empties.join(', ')}`);
  const thin = scenes.filter(s => bySceneMap[s.id].length > 0 && bySceneMap[s.id].length < 8)
    .map(s => `${s.id}(${bySceneMap[s.id].length})`);
  if (thin.length) warnings.push(`偏少场景（<8 句）：${thin.join(', ')}`);

  return {
    pieces, scenes, groups, moods, authors,
    sceneMap, groupMap, moodMap, scenesByGroup,
    bySceneMap, byMoodMap, warnings, ROOT
  };
}
