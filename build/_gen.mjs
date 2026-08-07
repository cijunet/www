// Safe pool generator: validates every scene/mood/place id against live data
// before writing the pool file. Usage:
//   node build/_gen.mjs <outfile>   (reads spec from stdin as JSON array of rows)
// Each row: [正文, 作者, 作品, 年代国别, 场景id, 心情id, 地点id(可选), 怎么用, 外文原句, 白话]
// Any invalid id => throws, nothing written.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadAll } from './load.mjs';

const out = process.argv[2];
if (!out) { console.error('need outfile arg'); process.exit(1); }

const specFile = process.argv[3];
const spec = specFile ? JSON.parse(readFileSync(specFile, 'utf8')) : JSON.parse(readFileSync(0, 'utf8'));
const D = await loadAll();
const scenes = new Set(D.scenes.map(s => s.id));
const moods = new Set(D.moods.map(m => m.id));
const places = new Set(D.places.map(p => p.id));

function splitIds(s) {
  return String(s || '').split(/[，,、\s]+/).map(x => x.trim()).filter(Boolean);
}

const bad = [];
const rows = spec.map((r, i) => {
  const [t, a, w, d, sc, mo, pl = '', how = '', o = '', x = ''] = r;
  const scIds = splitIds(sc);
  const moIds = splitIds(mo);
  const plIds = splitIds(pl);
  const badSc = scIds.filter(id => !scenes.has(id));
  const badMo = moIds.filter(id => !moods.has(id));
  const badPl = plIds.filter(id => !places.has(id));
  if (badSc.length || badMo.length || badPl.length) {
    bad.push({ i, t: t.slice(0, 10), badSc, badMo, badPl });
  }
  return [t, a, w, d, sc, mo, pl, how, o, x];
});

if (bad.length) {
  console.error('INVALID IDS — file NOT written:');
  for (const b of bad) {
    console.error(`  row ${b.i} "${b.t}": scene=${JSON.stringify(b.badSc)} mood=${JSON.stringify(b.badMo)} place=${JSON.stringify(b.badPl)}`);
  }
  process.exit(2);
}
// require at least one valid scene
const noScene = rows.findIndex(r => splitIds(r[4]).length === 0);
if (noScene >= 0) {
  console.error('row', noScene, 'has no scene:', JSON.stringify(rows[noScene].slice(0, 6)));
  process.exit(3);
}
writeFileSync(out, JSON.stringify(rows, null, 0) + '\n', 'utf8');
console.log('OK wrote', rows.length, 'rows to', out);
