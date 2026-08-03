// 本地预览：node build/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', process.argv[3] || 'WWW');
const PORT = Number(process.argv[2]) || 4321;

const TYPES = {
  '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8', '.json': 'application/json;charset=utf-8',
  '.msgpack': 'application/octet-stream', '.xml': 'application/xml;charset=utf-8',
  '.txt': 'text/plain;charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.mjs': 'text/javascript;charset=utf-8', '.wasm': 'application/wasm'
};

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('403'); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html;charset=utf-8' }).end('<h1>404</h1>'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': Buffer.byteLength(data),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}).listen(PORT, () => console.log(`\n  预览 → http://localhost:${PORT}\n`));
