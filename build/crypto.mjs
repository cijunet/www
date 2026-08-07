// 轻量对称混淆：固定密钥逐字节异或。
// 目的：避免源数据文件被"点一下就下载 / 克隆公开仓库直接拿明文"。
// 重要：密钥需随站点下发给浏览器才能解密，故此方案只是"提高复制门槛"，并非绝对保密。
// 加密端（Node / build）与解密端（浏览器 / app.js）使用完全相同的算法与密钥。
const KEY = Buffer.from('ciju-net-2026key', 'utf8'); // 16 字节

export function xor(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const out = Buffer.allocUnsafe(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b[i] ^ KEY[i % KEY.length];
  return out;
}
// 异或对称：加密与解密是同一函数
export const encrypt = xor;
export const decrypt = xor;
// 供前端镜像使用的字节序列（与 app.js 内联的 CJU_KEY 必须完全一致）
export const KEY_BYTES = Array.from(KEY);
