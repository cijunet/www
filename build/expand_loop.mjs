// 双轨自动扩充循环：每轮 预检→去重→写 supplement→构建→校验零告警→记进度。
// 用法：node build/expand_loop.mjs [maxRounds] [target]
//   语料池：data/_pool_classical.json（古典，年代写朝代）/ data/_pool_garnish.json（近现代/外国）
//   每池为紧凑行数组 [正文,作者,作品,年代国别,场景id,心情id,地点id,怎么用,外文原句,白话]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadAll } from './load.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MAX_ROUNDS = parseInt(process.argv[2] || '100', 10);
const TARGET = parseInt(process.argv[3] || '11500', 10);

const CLASSIC_DYN = ['先秦','春秋','战国','秦','汉','西汉','东汉','新','三国','魏','蜀','吴','晋','西晋','东晋','南北朝','南朝','北朝','北魏','南齐','梁','陈','隋','唐','初唐','盛唐','中唐','晚唐','五代','五代十国','宋','北宋','南宋','辽','金','西夏','元','明','清','汉乐府','乐府','近代','魏晋','周','南朝梁','南朝宋','唐宋','北周'];
function originOfRow(r) {
  const d = r[3] || '', o = r[8] || '';
  if (o) return 'world';
  if (CLASSIC_DYN.includes(d)) return 'classic';
  if (/现代|当代/.test(d)) return 'modern';
  if (!d) return 'modern';
  return 'world';
}
const normText = s => s.replace(/[\s，。、？！；：""''‘’“”（）()《》·—…\-.,!?;:]/g, '');

async function main() {
  const D = await loadAll();
  const sceneIds = new Set(D.scenes.map(x => x.id));
  const moodIds = new Set(D.moods.map(x => x.id));
  const placeIds = new Set(D.places.map(x => x.id));
  const known = id => sceneIds.has(id) || moodIds.has(id) || placeIds.has(id);

  let total = D.pieces.length;
  let nonClassic = D.pieces.filter(p => p.origin !== 'classic').length;
  // 注：基址非古典已占 ~41%（3387/8173），"古典≥85%"在数学上不可达；
  // 改为"古典保持多数"：新增强化古典，点缀占比随新增自然低于多数。
  const existKeys = new Set(D.pieces.map(p => normText(p.t)));

  const dataDir = path.join(ROOT, 'data');
  const allFiles = fs.readdirSync(dataDir);
  const readPools = re => allFiles.filter(f => re.test(f)).sort()
    .flatMap(f => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')));
  const classical = readPools(/^_pool_classical.*\.json$/);
  const garnish = readPools(/^_pool_garnish.*\.json$/);
  // 续跑时不覆盖已有 supplement_auto_*.json
  const usedIdx = allFiles.map(f => /^supplement_auto_(\d+)\.json$/.exec(f)).filter(Boolean).map(m => +m[1]);
  const IDX0 = usedIdx.length ? Math.max(...usedIdx) + 1 : 0;
  const BATCH_C = 18, BATCH_G = 8; // 古典新增远多于点缀，古典占比只升不降

  const log = [];
  let ci = 0, gi = 0, roundsRun = 0, addedTotal = 0, droppedTotal = 0;

  console.log(`起始: 总量 ${total} | 非古典 ${nonClassic}（占比 ${((nonClassic/total)*100).toFixed(1)}%）| 目标 ${TARGET} | 双轨(古典为主)`);

  for (let r = 0; r < MAX_ROUNDS; r++) {
    if (total >= TARGET) { log.push(`R${r}: 已达目标 ${total}，停止。`); break; }
    const cBatch = classical.slice(ci, ci + BATCH_C); ci += BATCH_C;
    const gBatch = garnish.slice(gi, gi + BATCH_G); gi += BATCH_G;
    if (cBatch.length === 0 && gBatch.length === 0) { log.push(`R${r}: 语料池耗尽，停止。`); break; }

    const kept = [], dropped = [];
    for (const row of [...cBatch, ...gBatch]) {
      const t = (row[0] || '').trim();
      if (!t) { dropped.push('空正文'); continue; }
      const sList = String(row[4] || '').split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
      const mList = String(row[5] || '').split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
      const pList = String(row[6] || '').split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean);
      const allIds = [...sList, ...mList, ...pList];
      if (!sList.some(id => sceneIds.has(id))) { dropped.push(`无真实场景: ${t.slice(0, 10)}`); continue; }
      const bad = allIds.find(id => !known(id));
      if (bad) { dropped.push(`未知id ${bad}: ${t.slice(0, 10)}`); continue; }
      const origin = originOfRow(row);
      if (existKeys.has(normText(t))) { dropped.push(`重复: ${t.slice(0, 10)}`); continue; }
      kept.push({ row, origin });
    }
    if (kept.length === 0) { log.push(`R${r}: 本批 0 新增（valid ${cBatch.length + gBatch.length}，dropped ${dropped.length}）`); roundsRun++; continue; }

    const pieces = kept.map(({ row }) => ({
      正文: row[0], 作者: row[1] || '', 作品: row[2] || '', 年代国别: row[3] || '',
      场景id: String(row[4] || ''), 心情id: String(row[5] || ''), 地点id: String(row[6] || ''),
      怎么用: row[7] || '', 外文原句: row[8] || '', 白话: row[9] || ''
    }));
    fs.writeFileSync(path.join(ROOT, 'data', `supplement_auto_${IDX0 + r}.json`),
      JSON.stringify({ scenes: [], pieces }, null, 0), 'utf8');

    // 构建 + 校验
    let buildOut = '', checkOut = '';
    try {
      buildOut = execFileSync('node', ['build/build.mjs'], { cwd: ROOT, env: { ...process.env, BUILD_OUT: 'WWW' }, encoding: 'utf8' });
      checkOut = execFileSync('node', ['build/check.mjs'], { cwd: ROOT, encoding: 'utf8' });
    } catch (e) {
      log.push(`R${r}: 构建/校验失败 → ${String(e.message).split('\n')[0]}`);
      log.push(`  build: ${buildOut.split('\n').slice(-3).join(' | ')}`);
      log.push(`  check: ${checkOut.split('\n').slice(-3).join(' | ')}`);
      break;
    }
    if (!/无告警/.test(checkOut)) {
      log.push(`R${r}: 出现告警，停止！`);
      log.push(`  check尾: ${checkOut.split('\n').slice(-6).join(' | ')}`);
      break;
    }
    // 记账
    for (const { origin } of kept) { if (origin !== 'classic') nonClassic++; }
    const cAdd = kept.filter(k => k.origin === 'classic').length;
    const gAdd = kept.length - cAdd;
    total += kept.length;
    addedTotal += kept.length;
    droppedTotal += dropped.length;
    for (const k of kept) existKeys.add(normText(k.row[0]));
    roundsRun++;
    log.push(`R${r}: +${kept.length}（古${cAdd}/非${gAdd}） 累计 ${total} | 非古典 ${nonClassic} | 古典占比 ${((total - nonClassic) / total * 100).toFixed(1)}% | drop ${dropped.length}`);
  }

  const summary = [
    `==== 双轨扩充循环结束 ====`,
    `实际轮次: ${roundsRun} | 新增总量: ${addedTotal} | 累计: ${total}`,
    `非古典: ${nonClassic} | 古典占比: ${((total - nonClassic) / total * 100).toFixed(1)}%`,
    `丢弃(未知id/重复/无场景): ${droppedTotal}`,
    `目标 ${TARGET}: ${total >= TARGET ? '已达成' : '未达成（受高质量语料池规模限制，可追加 _pool_*_b.json 续跑）'}`
  ].join('\n');
  log.push(''); log.push(summary);
  const head = `\n\n## 运行 ${new Date().toISOString()} | 池: 古典 ${classical.length} / 点缀 ${garnish.length} | 起始编号 ${IDX0}\n`;
  fs.appendFileSync(path.join(ROOT, '.workbuddy', 'expand_log.md'), head + log.join('\n'), 'utf8');
  console.log(log.join('\n'));
}
main().catch(e => { console.error(e); process.exit(1); });
