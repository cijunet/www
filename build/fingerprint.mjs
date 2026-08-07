// 数据指纹报告：xlsx 是二进制 git 无法 diff，此脚本输出关键指标快照便于对照每次变更
// 用法：node build/fingerprint.mjs   （由 npm run ci 串联）
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadAll } from './load.mjs';

const OUT = path.join(process.cwd(), 'data-fingerprint.json');

const D = await loadAll();
const pieces = D.pieces;

const count = o => pieces.filter(p => p.origin === o).length;
const classic = count('classic');
const modern = count('modern');
const world = count('world');

const byScene = new Map();
pieces.forEach(p => (p.s || []).forEach(s => byScene.set(s, (byScene.get(s) || 0) + 1)));
const thin20 = D.scenes.filter(s => (byScene.get(s.id) || 0) < 20).length;

const norm = s => (s || '').replace(/[\s，。、？！；：“”"''（）()《》·—…\-.,!?;:]/g, '').toLowerCase();
const bodyHash = createHash('sha256');
[...pieces].sort((a, b) => (a.t || '').localeCompare(b.t || '')).forEach(p => bodyHash.update(norm(p.t) + '\n'));

const fp = {
  generatedAt: new Date().toISOString(),
  totals: {
    pieces: pieces.length,
    scenes: D.scenes.length,
    moods: D.moods.length,
    places: D.places.length,
    authors: new Set(pieces.map(p => p.authorSlug)).size,
    yiming: pieces.filter(p => p.a === '佚名').length,
  },
  composition: {
    classic,
    modern,
    world,
    classicPct: Math.round(classic / pieces.length * 1000) / 10,
  },
  quality: {
    noBaihua: pieces.filter(p => !p.x).length,
    noNote: pieces.filter(p => !p.n).length,
    noScene: pieces.filter(p => !p.s || !p.s.length).length,
    noWork: pieces.filter(p => !p.w).length,
    worldNoOriginal: pieces.filter(p => p.origin === 'world' && !p.o).length,
    thinScenes20: thin20,
    warnings: D.warnings.length,
  },
  fingerprint: bodyHash.digest('hex').slice(0, 16),
};

fs.writeFileSync(OUT, JSON.stringify(fp, null, 2) + '\n', 'utf8');
console.log('📊 数据指纹已写入 data-fingerprint.json');
console.log(`   ${fp.totals.pieces} 条 · classic ${fp.composition.classicPct}% · 作品空 ${fp.quality.noWork} · world无原文 ${fp.quality.worldNoOriginal} · warnings ${fp.quality.warnings} · 指纹 ${fp.fingerprint}`);
