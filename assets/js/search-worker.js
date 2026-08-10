/* 搜索 Worker（架构 3.7：解码与求交放 Worker，主线程只管输入与渲染）
 *
 * 经典 worker：importScripts 载入 msgpack 解码器。本 Worker 自己不发任何网络请求 ——
 * 所有字节都由主线程经 HashSearch 单例取来后 postMessage 送入（架构 3.3 单一请求出口）。
 *
 * 消息协议（主线程 → Worker）
 *   {t:'idx',   buf, ext}      载入核心倒排索引
 *   {t:'py',    buf, ext}      载入拼音辅助文件（按需）
 *   {t:'shard', i, buf, ext}   载入某个分片
 *   {t:'evict'}                内存压力：丢弃已解码分片
 *   {t:'q',     rid, ...opts}  执行查询
 *   {t:'items', rid, gids}     取这些 gid 的完整记录
 * 消息协议（Worker → 主线程）
 *   {t:'ready', what, ...}     索引/拼音就绪
 *   {t:'res',   rid, total, gids, exact, pending}  查询结果（未验证完会再次推送同 rid 的更新）
 *   {t:'items', rid, items, need}                  记录数据 + 仍缺的分片号
 *   {t:'err',   rid, msg}
 */
importScripts('../msgpack.min.js');

var IDX = null;          // {tks, tokMap, pst, off, lens, cls, total, shardSize, names}
var MAN = null;          // 来自 manifest（含 shardSize）——分片映射不依赖 index，故首屏可不加载 index
var PY = null;           // {full:[], init:[]}
var SHARDS = new Map();  // shardIndex -> 记录数组
var LAST = null;         // 最近一次查询（分片到货后自动重算，实现渐进精确化）
var LAST_PENDING = 0;    // 上次结果里「候选未验证」的条数：为 0 说明已精确，分片再到也不必重算

/* ── 基础工具 ── */
function u8(x) {
  if (x instanceof Uint8Array) return x;
  if (x && x.buffer) return new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength || x.length);
  return new Uint8Array(x);
}
async function inflate(buf, ext) {
  var fmt = ext === 'gz' ? 'gzip' : 'brotli';
  var ds = new DecompressionStream(fmt);
  var stream = new Response(buf).body.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ── 索引载入 ── */
async function loadIndex(buf, ext) {
  var raw = await inflate(buf, ext);
  var p = msgpack.decode(raw);
  var tks = p.tks;
  var tokMap = new Map();
  for (var i = 0; i < tks.length; i++) tokMap.set(tks[i], i);
  var nm = p.names || {};
  // id → 可检索名称串（场景含关键词）。命中校验时用它判定「按名称命中」的条目
  var nameStr = function (list, keyField, extra) {
    var mp = new Map();
    (list || []).forEach(function (x) {
      var s = x.name || '';
      if (extra && x[extra] && x[extra].length) s += ' ' + x[extra].join(' ');
      mp.set(x[keyField], s.toLowerCase());
    });
    return mp;
  };
  IDX = {
    v: p.v, total: p.total, shardSize: p.shardSize,
    tks: tks, tokMap: tokMap,
    pst: u8(p.pst),
    off: new DataView(u8(p.off).buffer, u8(p.off).byteOffset, u8(p.off).byteLength),
    lens: u8(p.lens), cls: u8(p.cls),
    names: nm,
    sName: nameStr(nm.scenes, 'id', 'kw'),
    mName: nameStr(nm.moods, 'id'),
    pName: nameStr(nm.places, 'id'),
    gName: nameStr(nm.geo, 'id')
  };
  self.postMessage({ t: 'ready', what: 'idx', total: IDX.total, tokens: tks.length, names: p.names });
  if (LAST) runQuery(LAST, true);
}

// 解码某 token 的 posting（delta + varint）→ 升序 Int32Array
function posting(tokIdx) {
  var start = IDX.off.getUint32(tokIdx * 4, true);
  var pst = IDX.pst, pos = start, b, shift, n, v;
  // 先读条数
  n = 0; shift = 0;
  do { b = pst[pos++]; n |= (b & 127) << shift; shift += 7; } while (b & 128);
  var out = new Int32Array(n), prev = 0;
  for (var i = 0; i < n; i++) {
    v = 0; shift = 0;
    do { b = pst[pos++]; v |= (b & 127) << shift; shift += 7; } while (b & 128);
    prev += v; out[i] = prev;
  }
  return out;
}
function postingOf(token) {
  if (!IDX) return null;
  var i = IDX.tokMap.get(token);
  return i === undefined ? null : posting(i);
}

/* ── 集合运算（有序整型数组） ── */
function intersect(a, b) {
  var out = new Int32Array(Math.min(a.length, b.length));
  var i = 0, j = 0, k = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out[k++] = a[i]; i++; j++; }
    else if (a[i] < b[j]) i++;
    else j++;
  }
  return out.subarray(0, k);
}
function intersectAll(lists) {
  if (!lists.length) return new Int32Array(0);
  lists.sort(function (x, y) { return x.length - y.length; }); // 先交最短的，减少比较
  var acc = lists[0];
  for (var i = 1; i < lists.length && acc.length; i++) acc = intersect(acc, lists[i]);
  return acc;
}
function union(a, b) {
  if (!a || !a.length) return b || new Int32Array(0);
  if (!b || !b.length) return a;
  var out = new Int32Array(a.length + b.length);
  var i = 0, j = 0, k = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out[k++] = a[i]; i++; j++; }
    else if (a[i] < b[j]) out[k++] = a[i++];
    else out[k++] = b[j++];
  }
  while (i < a.length) out[k++] = a[i++];
  while (j < b.length) out[k++] = b[j++];
  return out.subarray(0, k);
}

/* ── 分词（与构建期 dataplan.mjs 保持一致） ── */
function cjkChars(s) { return s.match(/\p{Script=Han}/gu) || []; }
function latinWords(s) { return s.toLowerCase().match(/[a-z0-9]+/g) || []; }
function hasCJK(s) { return /\p{Script=Han}/u.test(s); }
function tokensOf(term) { return cjkChars(term).concat(latinWords(term)); }

/* ── 分片与记录 ── */
async function loadShard(i, buf, ext) {
  var raw = await inflate(buf, ext);
  var pack = msgpack.decode(raw);            // 分片载荷 = {v, pieces:[...]}
  SHARDS.set(i, pack.pieces || pack);
  // 新分片到货 → 重算，让结果从「候选」收敛到「精确」。
  // 已经精确的查询（无待验证候选）不再重算：29 片全量预载时可省掉近 30 次全表排序。
  if (LAST && LAST_PENDING > 0) runQuery(LAST, true);
}
function recordOf(gid) {
  var size = (MAN || IDX || {}).shardSize || 400;
  var si = Math.floor(gid / size);
  var arr = SHARDS.get(si);
  return arr ? arr[gid % size] : null;
}
function shardOf(gid) { return Math.floor(gid / (MAN ? MAN.shardSize : (IDX ? IDX.shardSize : 400))); }

/* ── 三种搜索 ── */
// 精确：整串作为一个短语。倒排求交拿候选，再用已解码分片验证子串；
//       未解码分片内的候选先保留（标记 pending），分片到货后自动收敛。
function searchPhrase(term, verify) {
  var toks = tokensOf(term);
  if (!toks.length) return null;
  var lists = [];
  for (var i = 0; i < toks.length; i++) {
    var p = postingOf(toks[i]);
    if (!p) return { ids: new Int32Array(0), pending: 0 }; // 有字不在索引里 → 必然无结果
    lists.push(p);
  }
  var cand = intersectAll(lists);
  if (!verify || toks.length < 2) return { ids: cand, pending: 0 };
  var keep = [], pending = 0;
  for (var k = 0; k < cand.length; k++) {
    var gid = cand[k], rec = recordOf(gid);
    if (!rec) { keep.push(gid); pending++; continue; }        // 分片未到 → 暂计为候选
    if (matchText(rec, term)) keep.push(gid);
  }
  return { ids: Int32Array.from(keep), pending: pending };
}
// 命中校验：字段口径必须与构建期 index.mjs 完全一致
//   正文域 = t(正文) / x(白话) / o(外文原句) / a(作者) / w(作品)
//   名称域 = 场景名+关键词 / 心情名 / 地点名 / 地名（这些词不在正文里，只能查名称表）
function matchText(rec, term) {
  var t = term.toLowerCase();
  if ((rec.t && rec.t.toLowerCase().indexOf(t) >= 0) ||
    (rec.x && rec.x.toLowerCase().indexOf(t) >= 0) ||
    (rec.o && rec.o.toLowerCase().indexOf(t) >= 0) ||
    (rec.a && rec.a.toLowerCase().indexOf(t) >= 0) ||
    (rec.w && rec.w.toLowerCase().indexOf(t) >= 0)) return true;
  return matchName(rec, t);
}
function matchName(rec, t) {
  var hit = function (ids, mp) {
    if (!ids) return false;
    for (var i = 0; i < ids.length; i++) {
      var s = mp.get(ids[i]);
      if (s && s.indexOf(t) >= 0) return true;
    }
    return false;
  };
  return hit(rec.s, IDX.sName) || hit(rec.m, IDX.mName) || hit(rec.pl, IDX.pName) ||
    hit(rec.gw, IDX.gName) || hit(rec.gd, IDX.gName);
}
// 组合：空格分词，各词分别短语匹配后取交集（AND）
function searchCombo(q) {
  var terms = q.split(/[\s,，、]+/).filter(Boolean);
  if (!terms.length) return null;
  var lists = [], pending = 0;
  for (var i = 0; i < terms.length; i++) {
    var r = searchPhrase(terms[i], true);
    if (!r) continue;
    pending += r.pending;
    lists.push(r.ids);
  }
  if (!lists.length) return null;
  return { ids: intersectAll(lists), pending: pending };
}
// 模糊：拉丁字母 → 拼音全拼/首字母子串扫描（不依赖分片，索引外独立可用）；
//       中文 → 按字宽召回，按命中字数排序
function searchFuzzy(q) {
  var s = q.toLowerCase().replace(/\s+/g, '');
  if (!hasCJK(q) && /^[a-z0-9]+$/.test(s)) {
    if (!PY) return { ids: null, needPinyin: true, pending: 0 };
    var hit = [];
    for (var gid = 0; gid < PY.full.length; gid++) {
      if (PY.full[gid].indexOf(s) >= 0 || PY.init[gid].indexOf(s) >= 0) hit.push(gid);
    }
    return { ids: Int32Array.from(hit), pending: 0 };
  }
  var toks = tokensOf(q);
  if (!toks.length) return null;
  var score = new Map();
  for (var i = 0; i < toks.length; i++) {
    var p = postingOf(toks[i]);
    if (!p) continue;
    for (var k = 0; k < p.length; k++) score.set(p[k], (score.get(p[k]) || 0) + 1);
  }
  var need = Math.max(1, Math.ceil(toks.length / 2)); // 至少命中一半的字
  var out = [];
  score.forEach(function (v, gid) { if (v >= need) out.push([gid, v]); });
  out.sort(function (a, b) { return b[1] - a[1] || a[0] - b[0]; });
  return { ids: Int32Array.from(out.map(function (x) { return x[0]; })), pending: 0, ranked: true };
}

/* ── 筛选（全部走分面 token / 旁路数组，完全不依赖分片） ── */
function filterLists(f) {
  var lists = [];
  if (!f) return lists;
  var push = function (pre, val) {
    if (!val) return;
    var p = postingOf(pre + val);
    lists.push(p || new Int32Array(0));
  };
  push('#s', f.s); push('#m', f.m); push('#p', f.pl);
  push('#a', f.a); push('#g', f.g);
  // 地名分面：gw=题咏地、gd=写到地；geo=两者并集（「附近的诗句」按 POI 取句用它）
  push('#w', f.gw); push('#d', f.gd);
  if (f.geo) lists.push(union(postingOf('#w' + f.geo), postingOf('#d' + f.geo)));
  if (f.c !== undefined && f.c !== '' && f.c !== null) push('#c', String(f.c));
  return lists;
}
function tierFilter(ids, tier) {
  if (tier === undefined || tier === '' || tier === null) return ids;
  var t = Number(tier), lens = IDX.lens, out = [];
  for (var i = 0; i < ids.length; i++) {
    var L = lens[ids[i]];
    var tv = L <= 12 ? 0 : L <= 28 ? 1 : 2;
    if (tv === t) out.push(ids[i]);
  }
  return Int32Array.from(out);
}

/* ── 查询主流程 ── */
function runQuery(o, isRefresh) {
  if (!IDX) { self.postMessage({ t: 'err', rid: o.rid, msg: '索引尚未就绪' }); return; }
  LAST = o;
  var q = (o.q || '').trim();
  var res = null, needPinyin = false;

  if (!q) {
    res = { ids: null, pending: 0 };  // 无关键词 → 只按筛选条件
  } else if (o.mode === 'fuzzy') {
    res = searchFuzzy(q);
    if (res && res.needPinyin) { needPinyin = true; res = searchPhrase(q, true); }
  } else if (o.mode === 'exact') {
    res = searchPhrase(q, true);      // 显式精确：整串当一个短语，空格也算字面内容
  } else if (o.mode === 'combo' || /[\s,，、]/.test(q)) {
    res = searchCombo(q);
  } else {
    // 智能（默认）：纯拼音查询自动按拼音召回汉字，不必手动切「模糊·拼音」。
    // 先试字面短语（文中若真有这个拉丁词如 OK/love），空结果再转拼音全拼/首字母扫描；
    // PY 未到时返回 needPinyin，主线程拉拼音索引，py 到达后自动重跑（见 onmessage）。
    var flat = q.toLowerCase().replace(/\s+/g, '');
    if (!hasCJK(q) && /^[a-z0-9]+$/.test(flat)) {
      res = searchPhrase(q, true);
      if (!res || !res.ids.length) {
        res = searchFuzzy(q);
        if (res && res.needPinyin) { needPinyin = true; res = searchPhrase(q, true); }
      }
    } else {
      res = searchPhrase(q, true);
    }
  }
  if (res === null) res = { ids: new Int32Array(0), pending: 0 };

  // 与筛选条件求交
  var lists = filterLists(o.f);
  var ids;
  if (res.ids === null) {
    if (lists.length) ids = intersectAll(lists);
    else { ids = new Int32Array(IDX.total); for (var i = 0; i < IDX.total; i++) ids[i] = i; }
  } else {
    ids = lists.length ? intersectAll([res.ids].concat(lists)) : res.ids;
  }
  ids = tierFilter(ids, o.f && o.f.tier);

  // 排序：模糊模式已按相关度排好；其余按「字数升序 → gid」，长句更难用故靠后
  if (!res.ranked) {
    var lens = IDX.lens;
    var arr = Array.prototype.slice.call(ids);
    if (o.sort === 'long') arr.sort(function (a, b) { return lens[b] - lens[a] || a - b; });
    else if (o.sort === 'id') arr.sort(function (a, b) { return a - b; });
    else arr.sort(function (a, b) { return lens[a] - lens[b] || a - b; });
    ids = Int32Array.from(arr);
  }

  LAST_PENDING = res.pending || 0;
  self.postMessage({
    t: 'res', rid: o.rid, total: ids.length,
    gids: ids, exact: !res.pending, pending: res.pending,
    needPinyin: needPinyin, refresh: !!isRefresh
  }, [ids.buffer]);
}

/* ── 取记录（渲染窗口按需要分片） ── */
function getItems(rid, gids) {
  var items = [], need = new Set();
  for (var i = 0; i < gids.length; i++) {
    var gid = gids[i], rec = recordOf(gid);
    if (rec) items.push({ gid: gid, r: rec });
    else { items.push(null); need.add(shardOf(gid)); }
  }
  self.postMessage({ t: 'items', rid: rid, gids: gids, items: items, need: [...need] });
}

self.onmessage = async function (e) {
  var m = e.data || {};
  try {
    if (m.t === 'idx') await loadIndex(m.buf, m.ext);
    else if (m.t === 'manifest') { MAN = m.m; }
    else if (m.t === 'py') {
      var raw = await inflate(m.buf, m.ext);
      var p = msgpack.decode(raw);
      var dec = new TextDecoder();
      PY = { full: dec.decode(u8(p.full)).split('\n'), init: dec.decode(u8(p.init)).split('\n') };
      self.postMessage({ t: 'ready', what: 'py', total: PY.full.length });
      if (LAST) runQuery(LAST, true);
    }
    else if (m.t === 'shard') await loadShard(m.i, m.buf, m.ext);
    else if (m.t === 'evict') { SHARDS.clear(); }
    else if (m.t === 'q') runQuery(m, false);
    else if (m.t === 'items') getItems(m.rid, m.gids);
  } catch (err) {
    self.postMessage({ t: 'err', rid: m.rid, msg: String((err && err.message) || err) });
  }
};
