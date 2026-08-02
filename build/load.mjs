// 数据装载 + 规范化 + 校验
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenes, groups, sceneMap, groupMap, scenesByGroup } from '../data/scenes.js';
import { moods, moodMap } from '../data/moods.js';
import { slugify, authorSlugTable, hash, charLen } from './util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PIECES_DIR = path.join(ROOT, 'data', 'pieces');

const CLASSIC_DYN = ['先秦','春秋','战国','汉','三国','晋','南北朝','隋','唐','五代','宋','元','明','清','近代'];

function originOf(p) {
  const d = p.d || '';
  if (p.o) return 'world';
  if (CLASSIC_DYN.includes(d)) return 'classic';
  if (/现代|当代/.test(d)) return 'modern';
  if (!d) return 'modern';
  return 'world';
}

export async function loadAll() {
  const files = fs.readdirSync(PIECES_DIR).filter(f => f.endsWith('.js')).sort();
  const warnings = [];
  const raw = [];
  for (const f of files) {
    const mod = await import('file://' + path.join(PIECES_DIR, f).replace(/\\/g, '/'));
    const arr = mod.default;
    if (!Array.isArray(arr)) { warnings.push(`${f} 没有导出数组`); continue; }
    arr.forEach((p, i) => raw.push({ ...p, _file: f, _i: i }));
  }

  const seen = new Map();
  const pieces = [];
  for (const p of raw) {
    if (!p.t || typeof p.t !== 'string') { warnings.push(`${p._file}#${p._i} 缺 t`); continue; }
    const key = p.t.replace(/\s/g, '');
    if (seen.has(key)) { warnings.push(`重复词句「${p.t.slice(0, 14)}…」 ${p._file} 与 ${seen.get(key)}`); continue; }
    seen.set(key, p._file);

    // 自动纠错：场景/心情 id 写串位是最常见的错误，能救的直接救
    const sRaw = [...new Set(p.s || [])];
    const mRaw = [...new Set(p.m || [])];
    const sList = [], mList = [...mRaw.filter(id => moodMap[id])];

    for (const id of sRaw) {
      if (sceneMap[id]) { sList.push(id); continue; }
      if (moodMap[id]) { if (!mList.includes(id)) mList.push(id); continue; }      // 心情写进了场景位
      if (groupMap[id]) { warnings.push(`${p._file}「${p.t.slice(0, 10)}」用了大类 ${id} 当场景，已忽略`); continue; }
      warnings.push(`${p._file}「${p.t.slice(0, 10)}」未知场景 ${id}`);
    }
    for (const id of mRaw) {
      if (moodMap[id]) continue;
      if (sceneMap[id]) { if (!sList.includes(id)) sList.push(id); continue; }     // 场景写进了心情位
      warnings.push(`${p._file}「${p.t.slice(0, 10)}」未知心情 ${id}`);
    }
    if (!sList.length) warnings.push(`${p._file}「${p.t.slice(0, 10)}」没有任何有效场景，不会出现在任何场景页`);

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
  // 每个场景内：先按来源多样性排（古典/近现代/外国交替感），再按长度
  for (const id in bySceneMap) {
    bySceneMap[id].sort((a, b) => a.len - b.len);
  }

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
