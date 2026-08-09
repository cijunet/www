// IndexedDB 封装：持久化「原始数据字节」（分片/索引/词典的压缩字节）。
// 业务数据走 IndexedDB，绝不进 localStorage（架构 3.4）。版本失效时整库清空。
const DB_NAME = 'ciju-data';
const DB_VER = 1;
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs'); // key=裸名, value={buf,ext}
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');   // version / loadedShards
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

export async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function dbPut(store, key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function dbClear() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(['blobs', 'meta'], 'readwrite');
    tx.objectStore('blobs').clear();
    tx.objectStore('meta').clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
