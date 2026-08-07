// 生成补充数据 JSON，并对 场景/心情/地点 id 做预检（提前发现非法 id，省去反复 build）。
// 用法：node build/gen_supplement.mjs <compact-source.json> [outName]
//   compact-source.json 结构：
//   {
//     "scenes": [ {id, g, name, desc, kw} ... ],                 // 可选：新增场景（仅场景可从 supplement 注入）
//     "rows": [ [t,a,w,d,s,m,p,n,o,x], ... ]                     // 词句紧凑行
//   }
//   各字段：t正文 a作者 w作品 d年代国别 s场景id(逗号) m心情id(逗号) p地点id(逗号) n怎么用 o外文原句 x白话
//   空串用 "" 表示；id 多个用英文逗号分隔。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from './load.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const srcPath = process.argv[2];
const outName = process.argv[3] || 'supplement_auto';

if (!srcPath) { console.error('用法: node build/gen_supplement.mjs <source.json> [outName]'); process.exit(1); }

const D = await loadAll();
const sceneIds = new Set(D.scenes.map(s => s.id));
const moodIds = new Set(D.moods.map(s => s.id));
const placeIds = new Set(D.places.map(s => s.id));
const groupIds = new Set(D.groups.map(s => s.id));

const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const errs = [];
const warn = [];

function splitIds(v) { return String(v == null ? '' : v).split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean); }

const scenes = [];
for (const s of (src.scenes || [])) {
  if (!s.id) { errs.push('场景缺 id'); continue; }
  if (sceneIds.has(s.id)) { warn.push(`场景已存在(跳过): ${s.id}`); continue; }
  if (s.g && !groupIds.has(s.g)) errs.push(`场景 ${s.id} 的大类 ${s.g} 不存在`);
  scenes.push({ id: s.id, '大类id': s.g || '', 名称: s.name || '', 描述: s.desc || '', 关键词: s.kw || '' });
  sceneIds.add(s.id);
}

// 新颖度统计：候选中有多少是库里没有的新句（其余会与现有句合并标签，不增体积）
const normText = s => s.replace(/[\s，。、？！；：""''‘’“”（）()《》·—…\-.,!?;:]/g, '');
const existKeys = new Set(D.pieces.map(p => normText(p.t)));
let novel = 0, dup = 0;
for (const r of (src.rows || [])) { const t = r[0]; if (!t) continue; if (existKeys.has(normText(t))) dup++; else novel++; }
console.log(`候选新句(体积增量) ${novel} / 与现有重复(仅合并标签) ${dup}`);

const pieces = [];
for (const r of (src.rows || [])) {
  const [t, a, w, d, s, m, p, n, o, x] = r;
  if (!t || !String(t).trim()) { errs.push('空正文: ' + JSON.stringify(r).slice(0, 40)); continue; }
  const sList = splitIds(s), mList = splitIds(m), pList = splitIds(p);
  for (const id of sList) if (!sceneIds.has(id)) errs.push(`未知场景 ${id} | ${String(t).slice(0, 12)}`);
  for (const id of mList) if (!moodIds.has(id)) errs.push(`未知心情 ${id} | ${String(t).slice(0, 12)}`);
  for (const id of pList) if (!placeIds.has(id)) errs.push(`未知地点 ${id} | ${String(t).slice(0, 12)}`);
  if (!sList.length) warn.push(`无有效场景: ${String(t).slice(0, 12)}`);
  pieces.push({
    正文: t, 作者: a || '', 作品: w || '', 年代国别: d || '',
    场景id: sList.join(','), 心情id: mList.join(','), 地点id: pList.join(','),
    怎么用: n || '', 外文原句: o || '', 白话: x || ''
  });
}

console.log(`读取 ${pieces.length} 条词句候选，新增场景 ${scenes.length} 个`);
console.log(`错误(非法id/空正文) ${errs.length} 条，警告 ${warn.length} 条`);
if (warn.length) console.log('  警告样本: ' + warn.slice(0, 8).join(' | '));
if (errs.length) {
  console.log('  错误样本:');
  errs.slice(0, 30).forEach(e => console.log('   - ' + e));
  console.error(`\n存在 ${errs.length} 个错误，未写出（请修正 source 后重跑）。`);
  process.exit(2);
}

const out = { scenes, pieces };
const outPath = path.join(ROOT, 'data', outName + '.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 0), 'utf8');
console.log('已写出: ' + outPath + '  (词句 ' + pieces.length + ' + 场景 ' + scenes.length + ')');
