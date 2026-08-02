// 一次性：第三批补强（shiye/gaochu/jiuzhao）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.join(__dirname, '..', 'data', '词句数据.xlsx');
const NEW = [
  { 正文:'千磨万击还坚劲，任尔东西南北风。', 作者:'郑燮', 作品:'竹石', 年代国别:'清', 场景id:'shiye', 心情id:'jueqiang,zhuangzhi', 怎么用:'被优化也不垮，发这句表你扛得住。', 外文原句:'', 白话:'千磨万击依旧坚韧，任凭四面风雨。' },
  { 正文:'咬定青山不放松，立根原在破岩中。', 作者:'郑燮', 作品:'竹石', 年代国别:'清', 场景id:'shiye', 心情id:'jueqiang,zhenxi', 怎么用:'丢了工作但根基还在，用这句说你站得稳。', 外文原句:'', 白话:'竹根咬定青山不松，生在破岩里也立得住。' },
  { 正文:'丈夫志四海，万里犹比邻。', 作者:'曹植', 作品:'赠白马王彪', 年代国别:'三国', 场景id:'shiye', 心情id:'zhuangzhi,haomai', 怎么用:'换城市换赛道，发这句讲志向不被距离限。', 外文原句:'', 白话:'大丈夫志在四方，万里也像邻居。' },
  { 正文:'精卫衔微木，将以填沧海。', 作者:'陶渊明', 作品:'读山海经', 年代国别:'晋', 场景id:'shiye', 心情id:'jueqiang,zhuangzhi', 怎么用:'起点低也要干，用这句说小力量也能成事。', 外文原句:'', 白话:'精卫叼小木，想填平沧海——认准了就做。' },
  { 正文:'黄河落天走东海，万里写入胸怀间。', 作者:'李白', 作品:'赠裴十四', 年代国别:'唐', 场景id:'gaochu', 心情id:'haomai,xinshang', 怎么用:'高处看大河奔流，发这句把气势收进胸怀。', 外文原句:'', 白话:'黄河从天而落奔向东海，万里风光写进胸襟。' },
  { 正文:'物是人非事事休，欲语泪先流。', 作者:'李清照', 作品:'武陵春', 年代国别:'宋', 场景id:'jiuzhao', 心情id:'sinian,gudu', 怎么用:'旧物还在人已不在，发这句最沉。', 外文原句:'', 白话:'景物依旧人事全非，话没出口泪先流。' }
];
const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: 'buffer' });
const ws = wb.Sheets['词句'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
const exist = new Set(rows.map(r => String(r['正文'] || '').replace(/\s/g, '')));
let added = 0, skip = 0; const fresh = [];
for (const n of NEW) { const key = String(n['正文']).replace(/\s/g, ''); if (exist.has(key)) { skip++; continue; } fresh.push(n); exist.add(key); }
if (fresh.length) { XLSX.utils.sheet_add_json(ws, fresh, { skipHeader: true, origin: -1 }); XLSX.writeFile(wb, XLSX_PATH); }
console.log(`新增 ${fresh.length} 条，跳过 ${skip} 条，现共 ${rows.length + fresh.length} 条。`);
