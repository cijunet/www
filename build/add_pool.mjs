// 一次性把语料池里「真正未收录」的行并入 xlsx（经 load.mjs 自动并标，不增量）。
// 格式兼容：紧凑数组 [正文,作者,作品,年代国别,场景id,心情id,地点id,怎么用,外文原句,白话]
//            或对象 {"正文":..., "作者":...}，两种都认。
// 用法：node build/add_pool.mjs [classicTarget] [garnishTarget]
//   classicTarget/garnishTarget 为该两类各自最多写入条数（默认全部 OK）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from './load.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLASSIC_DYN = ['先秦','春秋','战国','秦','汉','西汉','东汉','新','三国','魏','蜀','吴','晋','西晋','东晋','南北朝','南朝','北朝','北魏','南齐','梁','陈','隋','唐','初唐','盛唐','中唐','晚唐','五代','五代十国','宋','北宋','南宋','辽','金','西夏','元','明','清','汉乐府','乐府','近代','魏晋','周','南朝梁','南朝宋','唐宋','北周'];
const fileArgs = process.argv.slice(2).filter(a => a.endsWith('.json'));
const numArgs = process.argv.slice(2).filter(a => !a.endsWith('.json')).map(Number);
const MAX_C = numArgs[0] || 1e9;
const MAX_G = numArgs[1] || 1e9;

const normText = s => (s || '').replace(/[\s，。、？！；：""''‘’“”（）()《》·—…\-.,!?;:]/g, '');
function originOf(r) {
  const dyn = r.dyn || '', foreign = r.foreign || '';
  if (foreign) return 'world';
  if (CLASSIC_DYN.includes(dyn)) return 'classic';
  if (/现代|当代/.test(dyn)) return 'modern';
  if (!dyn) return 'modern';
  return 'world';
}
function normRow(row) {
  if (Array.isArray(row)) return {
    t: row[0], author: row[1], work: row[2], dyn: row[3],
    scenes: row[4], moods: row[5], places: row[6], how: row[7], foreign: row[8], plain: row[9]
  };
  return {
    t: row['正文'], author: row['作者'], work: row['作品'], dyn: row['年代国别'],
    scenes: row['场景id'], moods: row['心情id'], places: row['地点id'],
    how: row['怎么用'], foreign: row['外文原句'], plain: row['白话']
  };
}

async function main() {
  const D = await loadAll();
  const sceneIds = new Set(D.scenes.map(x => x.id));
  const moodIds = new Set(D.moods.map(x => x.id));
  const placeIds = new Set(D.places.map(x => x.id));
  const known = id => sceneIds.has(id) || moodIds.has(id) || placeIds.has(id);
  const exist = new Set(D.pieces.map(p => normText(p.t)));
  let total = D.pieces.length;

  const dataDir = path.join(ROOT, 'data');
  const files = fs.readdirSync(dataDir);
  const readPools = re => files.filter(f => re.test(f)).sort()
    .flatMap(f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')));
  let classical, garnish;
  const explicit = fileArgs;
  if (explicit.length) {
    const read = f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')).map(normRow);
    classical = explicit.filter(f => f.includes('classical')).flatMap(read);
    garnish = explicit.filter(f => f.includes('garnish')).flatMap(read);
    console.log(`(仅处理显式文件: classical ${classical.length} / garnish ${garnish.length})`);
  } else {
    classical = readPools(/^_pool_classical.*\.json$/).map(normRow);
    garnish = readPools(/^_pool_garnish.*\.json$/).map(normRow);
  }

  const usedIdx = files.map(f => /^supplement_auto_(\d+)\.json$/.exec(f)).filter(Boolean).map(m => +m[1]);
  const IDX = usedIdx.length ? Math.max(...usedIdx) + 1 : 0;

  const pieces = [];
  const stat = { c: 0, g: 0 };
  const dropped = {};
  const consider = (r, kind, cap) => {
    if (stat[kind === 'c' ? 'c' : 'g'] >= cap) return;
    const t = (r.t || '').trim();
    if (!t) { dropped['空正文'] = (dropped['空正文'] || 0) + 1; return; }
    const sc = String(r.scenes || '').split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
    const mo = String(r.moods || '').split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
    const pl = String(r.places || '').split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
    const all = [...sc, ...mo, ...pl];
    if (!sc.some(id => sceneIds.has(id))) { dropped['无真实场景:' + t.slice(0, 8)] = (dropped['无真实场景:' + t.slice(0, 8)] || 0) + 1; return; }
    const bad = all.find(id => !known(id));
    if (bad) { dropped['未知id ' + bad] = (dropped['未知id ' + bad] || 0) + 1; return; }
    const o = originOf(r);
    if (exist.has(normText(t))) { dropped['重复:' + t.slice(0, 8)] = (dropped['重复:' + t.slice(0, 8)] || 0) + 1; return; }
    pieces.push({
      正文: t, 作者: r.author || '', 作品: r.work || '', 年代国别: r.dyn || '',
      场景id: String(r.scenes || ''), 心情id: String(r.moods || ''), 地点id: String(r.places || ''),
      怎么用: r.how || '', 外文原句: r.foreign || '', 白话: r.plain || ''
    });
    if (o !== 'classic') stat[kind === 'c' ? '_g' : 'g'] = (stat[kind === 'c' ? '_g' : 'g'] || 0);
    if (kind === 'c') stat.c++; else stat.g++;
    exist.add(normText(t));
  };

  classical.forEach(r => consider(r, 'c', MAX_C));
  garnish.forEach(r => consider(r, 'g', MAX_G));

  if (pieces.length === 0) {
    console.log('无新增（全部重复/未知id/无场景）。dropped 摘要:', JSON.stringify(dropped, null, 0));
    return;
  }
  fs.writeFileSync(path.join(ROOT, 'data', `supplement_auto_${IDX}.json`),
    JSON.stringify({ scenes: [], pieces }, null, 0), 'utf8');
  const cAdd = pieces.filter(p => CLASSIC_DYN.includes(p.年代国别) && !p.外文原句).length;
  const gAdd = pieces.length - cAdd;
  console.log(`写入 data/supplement_auto_${IDX}.json → 新增 ${pieces.length}（古典 ${cAdd} / 非古典 ${gAdd}）| 原总量 ${total} → 累计 ${total + pieces.length}`);
  if (Object.keys(dropped).length) console.log('丢弃摘要:', JSON.stringify(dropped, null, 0));
}
main().catch(e => { console.error(e); process.exit(1); });
