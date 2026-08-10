// 解压 + 哈希工具（浏览器 / Node 共用，架构 3.4 下载后按校验值校验）。
// 数据文件为 gzip 压缩的 msgpack；传输层用内容哈希命名，拉取后先校验再使用。

// 浏览器与 Node 都有 DecompressionStream（Node18+）
export async function decompress(buf, ext) {
  const fmt = (ext === 'br' || (typeof ext === 'string' && ext.endsWith('.br'))) ? 'brotli' : 'gzip';
  const ds = new DecompressionStream(fmt);
  const stream = new Response(buf).body.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// sha256 取前 12 位 hex，与构建期内容哈希一致（manifest 中的 h 字段）
export async function sha256hex(buf) {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

// msgpack 解码：浏览器用全局 msgpack（assets/msgpack.min.js 经典脚本注入），
// Node 测试环境回退到 msgpack-lite（不会进入生产运行时）。
let _mp = null;
async function getMsgpack() {
  if (typeof globalThis !== 'undefined' && globalThis.msgpack) return globalThis.msgpack;
  if (_mp) return _mp;
  _mp = (await import('msgpack-lite')).default;
  return _mp;
}
export async function decodeMsgpack(buf) {
  const mp = await getMsgpack();
  return mp.decode(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
}
