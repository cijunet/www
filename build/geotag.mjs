/* 构建期地名标注器
 *
 * 给每一条词句自动打两种地名标签，不需要在 Excel 里人工维护：
 *   gw = 题咏地：地名出现在 **出处 / 题目** 里。
 *        例：《永遇乐·京口北固亭怀古》→ 京口；《次北固山下》→ 京口；《泊船瓜洲》→ 瓜洲。
 *        这种最强，基本可以认为「这首就是写这儿的 / 写于此地」。
 *   gd = 描写地：地名只出现在 **正文** 里。
 *        例：「烟花三月下扬州」→ 广陵；「西出阳关无故人」→ 玉门关·阳关。
 *        这种是「诗里写到了这个地方」。
 *
 * 两者不重复：已进 gw 的地名不会再进 gd。
 */

import { GAZETTEER, ALIAS_TABLE, BLOCK_PHRASES } from './gazetteer.mjs';

const GAZ_BY_ID = Object.fromEntries(GAZETTEER.map(g => [g.id, g]));

/** 把一段文本里某个片段整体挖空（用 \0 占位，长度不变，不影响后续 indexOf） */
function mask(s, frag) {
  let idx = s.indexOf(frag);
  while (idx !== -1) {
    s = s.slice(0, idx) + '\u0000'.repeat(frag.length) + s.slice(idx + frag.length);
    idx = s.indexOf(frag);
  }
  return s;
}

/** 在一段文本里找出所有命中的地名 id（长别名优先，命中后把该段挖空，避免重复计） */
function scan(text) {
  if (!text) return [];
  let s = String(text);
  // 先排雷：把「彩云间」「戴天山」这类假地名挖掉
  for (const b of BLOCK_PHRASES) s = mask(s, b);
  const hit = new Set();
  for (const { a, id } of ALIAS_TABLE) {
    let idx = s.indexOf(a);
    if (idx === -1) continue;
    hit.add(id);
    s = mask(s, a); // 挖空已匹配片段，防止短别名在同一位置重复命中
  }
  return [...hit];
}

/**
 * 给 pieces 打地名标签（原地写入 p.gw / p.gd），返回统计信息。
 * @param {Array} pieces load.mjs 产出的词句数组
 */
export function tagPieces(pieces) {
  const perPlace = {};
  let withAny = 0, wCount = 0, dCount = 0;

  for (const p of pieces) {
    // 出处/题目 —— 题咏地
    const gw = scan(p.w || '');
    // 正文 —— 描写地（排除已在题目里出现的）
    const gd = scan(p.t || '').filter(id => !gw.includes(id));

    p.gw = gw;
    p.gd = gd;

    if (gw.length || gd.length) withAny++;
    wCount += gw.length;
    dCount += gd.length;
    for (const id of [...gw, ...gd]) perPlace[id] = (perPlace[id] || 0) + 1;
  }

  return {
    total: pieces.length,
    withAny,
    wCount,
    dCount,
    perPlace,
    covered: Object.keys(perPlace).length,
    gazTotal: GAZETTEER.length,
    /** 打印一份人类可读的小结 */
    report() {
      const pct = (withAny / pieces.length * 100).toFixed(1);
      const top = Object.entries(perPlace).sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([id, n]) => `${GAZ_BY_ID[id] ? GAZ_BY_ID[id].name : id}${n}`).join('  ');
      const empty = GAZETTEER.filter(g => !perPlace[g.id]).length;
      return [
        `  地名标注：${withAny}/${pieces.length} 条命中（${pct}%），题咏 ${wCount} 处 / 描写 ${dCount} 处`,
        `  覆盖地名：${Object.keys(perPlace).length}/${GAZETTEER.length}（${empty} 个暂无词句）`,
        `  最多的：${top}`
      ].join('\n');
    }
  };
}

export { GAZ_BY_ID };
