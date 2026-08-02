// 数据体检：node build/check.mjs
import { loadAll } from './load.mjs';

const D = await loadAll();

const bySrc = { classic: 0, modern: 0, world: 0 };
const byTier = { short: 0, mid: 0, long: 0 };
for (const p of D.pieces) {
  bySrc[p.origin]++;
  byTier[p.len <= 12 ? 'short' : p.len <= 28 ? 'mid' : 'long']++;
}

const sceneCounts = D.scenes.map(s => ({ id: s.id, name: s.name, n: D.bySceneMap[s.id].length }))
  .sort((a, b) => a.n - b.n);

console.log(`
词句体检报告
────────────────────────────────────────
总量        ${D.pieces.length} 条
场景        ${D.scenes.length} 个（${D.groups.length} 大类）
作者        ${D.authors.length} 位
心情        ${D.moods.length} 种
平均归属    ${(D.pieces.reduce((n, p) => n + p.s.length, 0) / D.pieces.length).toFixed(2)} 个场景/句

来源分布    古典 ${bySrc.classic} · 近现代 ${bySrc.modern} · 外国 ${bySrc.world}
长度分布    极短 ${byTier.short} · 适中 ${byTier.mid} · 偏长 ${byTier.long}
带用法提示  ${D.pieces.filter(p => p.n).length} 条（${(D.pieces.filter(p => p.n).length / D.pieces.length * 100).toFixed(0)}%）
带外文原句  ${D.pieces.filter(p => p.o).length} 条
带白话解释  ${D.pieces.filter(p => p.x).length} 条

最单薄的 15 个场景
${sceneCounts.slice(0, 15).map(s => `  ${String(s.n).padStart(3)} 句  ${s.name}（${s.id}）`).join('\n')}

最充实的 8 个场景
${sceneCounts.slice(-8).reverse().map(s => `  ${String(s.n).padStart(3)} 句  ${s.name}（${s.id}）`).join('\n')}

收录最多的 12 位作者
${D.authors.slice(0, 12).map(a => `  ${String(a.pieces.length).padStart(3)} 句  ${a.name}`).join('\n')}
────────────────────────────────────────`);

if (D.warnings.length) {
  console.log(`\n数据提醒 ${D.warnings.length} 条：`);
  D.warnings.forEach(w => console.log('  - ' + w));
} else {
  console.log('\n无告警。');
}
console.log('');
