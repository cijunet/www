// 数据缓存层（架构 3.4）：内存 + IndexedDB 双层，版本失效清空，下载后按校验值校验、不符丢弃重试。
// 只持有「压缩字节」（解压与解码交 Worker），manifest 解析为对象常驻内存。
// 数据一律不进 localStorage —— localStorage 里只放「已载分片号清单」这类元信息。
import { dbGet, dbPut, dbClear } from './db.js';
import { fetchBytes, fetchText, pickCompress } from './hashsearch.js';
import { sha256hex } from './codec.js';

const LOADED_KEY = 'ciju.loaded';

let _base = '';
let _manifest = null;
const _mem = { index: null, pinyin: null, suggest: null, shards: new Map() };
const _loaded = new Set();   // 已载分片下标（回访差量 + 进度显示）

export function setDataBase(b) { _base = b; }

// 取 manifest：no-cache 拿最新 ver；版本变化则清空旧库（版本原子性，架构 2.4 / 3.4）
export async function getManifest() {
  if (_manifest) return _manifest;
  const m = JSON.parse(await fetchText(_base + 'data/manifest.json'));
  let prev = null;
  try { prev = await dbGet('meta', 'version'); } catch {}
  if (!prev || prev.ver !== m.ver) {
    try { if (prev) await dbClear(); } catch {}
    try { await dbPut('meta', 'version', { ver: m.ver }); } catch {}
    try { localStorage.removeItem(LOADED_KEY); } catch {}
    _mem.shards.clear(); _mem.index = _mem.pinyin = _mem.suggest = null; _loaded.clear();
  } else {
    // 同版本回访：恢复已载清单，后续只补差量
    try {
      const raw = localStorage.getItem(LOADED_KEY);
      if (raw) JSON.parse(raw).forEach(i => _loaded.add(i));
    } catch {}
  }
  _manifest = m;
  return m;
}

// 期望校验值随压缩格式而定（br/gz 字节流各有各的哈希）
function expectOf(desc, ext) { return ext === 'gz' ? desc.hgz : desc.hbr; }

// 拉取 + 校验 + 落 IDB。校验不符 → 丢弃并换另一种压缩重试；网络失败 → 降级用旧缓存。
async function fetchVerify(desc, opts) {
  const key = desc.n;
  let ext = pickCompress();

  const cached = await dbGet('blobs', key).catch(() => null);
  if (cached && cached.ext && cached.buf) {
    const got = await sha256hex(cached.buf);
    if (got === expectOf(desc, cached.ext)) return cached.buf;   // 命中且校验通过
  }

  let buf = null, lastErr = null;
  for (const tryExt of ext === 'br' ? ['br', 'gz'] : ['gz', 'br']) {
    try {
      const b = await fetchBytes(_base, key, tryExt, opts);
      const got = await sha256hex(b);
      if (got !== expectOf(desc, tryExt)) { lastErr = new Error('校验值不符: ' + key + '.' + tryExt); continue; }
      buf = b; ext = tryExt; break;
    } catch (e) { lastErr = e; }
  }
  if (!buf) {
    if (cached && cached.buf) return cached.buf;   // 全部失败 → 降级用旧缓存，不白屏
    throw lastErr || new Error('取数失败: ' + key);
  }
  dbPut('blobs', key, { buf, ext }).catch(() => {});  // 落库失败不影响本次使用
  return buf;
}

// 返回 {buf, ext}，Worker 需要 ext 才知道用哪种解压
async function fetchPart(desc, opts) {
  const buf = await fetchVerify(desc, opts);
  const ext = (await sha256hex(buf)) === desc.hbr ? 'br' : 'gz';
  return { buf, ext };
}

export async function getIndex() {
  const m = await getManifest();
  if (_mem.index) return _mem.index;
  _mem.index = await fetchPart(m.index);
  return _mem.index;
}
export async function getPinyin() {
  const m = await getManifest();
  if (_mem.pinyin) return _mem.pinyin;
  _mem.pinyin = await fetchPart(m.pinyin);
  return _mem.pinyin;
}
export async function getSuggest() {
  const m = await getManifest();
  if (_mem.suggest) return _mem.suggest;
  _mem.suggest = await fetchPart(m.suggest);
  return _mem.suggest;
}

export async function getShard(i, opts) {
  const m = await getManifest();
  if (i < 0 || i >= m.shards.length) throw new Error('分片下标越界: ' + i);
  if (_mem.shards.has(i)) return _mem.shards.get(i);
  const part = await fetchPart(m.shards[i], opts);
  _mem.shards.set(i, part);
  _loaded.add(i);
  try { localStorage.setItem(LOADED_KEY, JSON.stringify([..._loaded])); } catch {}
  return part;
}
