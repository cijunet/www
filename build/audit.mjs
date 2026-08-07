// 全站质量审计（固化版）：发布前必跑，发现问题退出码 1
// 用法：node build/audit.mjs [--strict]   --strict 时"缺白话"也计入失败
import { loadAll } from './load.mjs';

const STRICT = process.argv.includes('--strict');
const D = await loadAll();
const pieces = D.pieces;
const issues = [];
const info = [];

const norm = s => (s || '').replace(/[\s，。！？；：、,\.!?;:'"“”‘’（）()《》〈〉「」『』【】\[\]·—…～~\-_/\\|]/g, '').toLowerCase();

// 1. 近似重复（去标点）
{
  const seen = new Map();
  for (const p of pieces) {
    const k = norm(p.t);
    if (!k) continue;
    if (seen.has(k)) issues.push(`近似重复：「${seen.get(k).t.slice(0,20)}」==「${p.t.slice(0,20)}」`);
    else seen.set(k, p);
  }
}

// 2. 字段缺失
{
  const noN = pieces.filter(p => !p.n).length;
  const noS = pieces.filter(p => !p.s || !p.s.length).length;
  const noA = pieces.filter(p => !p.a).length;
  const noX = pieces.filter(p => !p.x).length;
  if (noN) issues.push(`缺「怎么用」${noN} 条`);
  if (noS) issues.push(`无有效场景 ${noS} 条`);
  if (noA) issues.push(`缺作者 ${noA} 条`);
  if (STRICT && noX) issues.push(`缺白话 ${noX} 条`);
  info.push(`缺白话(可选字段): ${noX}`);
}

// 3. 异常长度
{
  const long = pieces.filter(p => (p.t || '').length > 120);
  const short = pieces.filter(p => (p.t || '').length < 4);
  if (long.length) issues.push(`超长正文(>120) ${long.length} 条：${long.slice(0,3).map(p=>p.t.slice(0,16)).join(' / ')}`);
  if (short.length) issues.push(`过短正文(<4字) ${short.length} 条：${short.slice(0,5).map(p=>p.t).join(' / ')}`);
}

// 4. 常见错别字
{
  const typos = [
    [/自已/g, '自已→自己'], [/一愁莫展/g, '一筹莫展'], [/既使/g, '即使'], [/再接再励/g, '再接再厉'],
    [/迫不急待/g, '迫不及待'], [/甘败下风/g, '甘拜下风'], [/走头无路/g, '走投无路'], [/谈笑风声/g, '谈笑风生'],
    [/穿流不息/g, '川流不息'], [/名信片/g, '明信片'], [/帐蓬/g, '帐篷'], [/嘎然而止/g, '戛然而止'],
    [/变本加利/g, '变本加厉'], [/消声匿迹/g, '销声匿迹'], [/金榜提名/g, '金榜题名'], [/暗然失色/g, '黯然失色'],
    [/不径而走/g, '不胫而走'], [/出奇不意/g, '出其不意'], [/九宵云外/g, '九霄云外'], [/迫不急待/g, '迫不及待'],
  ];
  for (const p of pieces) for (const [re, label] of typos) if (re.test(p.t)) { issues.push(`疑似错字 ${label}：「${p.t.slice(0,20)}」`); break; }
}

// 5. 正文为外文（中文站正文应为中文）
{
  const en = pieces.filter(p => {
    const t = p.t || '';
    const cn = (t.match(/[\u4e00-\u9fff]/g) || []).length;
    const latin = (t.match(/[A-Za-z]/g) || []).length;
    return latin > 10 && latin > cn;
  });
  if (en.length) issues.push(`外文正文 ${en.length} 条：${en.slice(0,3).map(p=>p.t.slice(0,20)).join(' / ')}`);
}

// 5b. 日/韩文正文（audit 盲区补漏）
{
  const jp = pieces.filter(p => {
    const t = p.t || '';
    const j = (t.match(/[\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    const cn = (t.match(/[\u4e00-\u9fff]/g) || []).length;
    return j > 0 && j >= cn;
  });
  if (jp.length) issues.push(`日韩文正文 ${jp.length} 条：${jp.slice(0,3).map(p=>p.a+'|'+p.t.slice(0,14)).join(' / ')}`);
}

// 5c. 白话=正文（偷懒填写统计，仅提示不拦截）
{
  const same = pieces.filter(p => p.x && norm(p.x) === norm(p.t));
  info.push(`白话=正文(偷懒提示): ${same.length}`);
}

// 6. world 类混入中国年代写法（无外文原句且年代是中国朝代值）
{
  const CN_DYN = ['先秦','春秋','战国','秦','汉','西汉','东汉','新','三国','魏','蜀','吴','晋','西晋','东晋','南北朝','南朝','北朝','北魏','南齐','梁','陈','隋','唐','初唐','盛唐','中唐','晚唐','五代','五代十国','宋','北宋','南宋','辽','金','西夏','元','明','清','民国','近代','汉乐府','乐府','魏晋','周','南朝梁','南朝宋','唐宋','北周','古','古籍','中','民间'];
  const bad = pieces.filter(p => p.origin === 'world' && !p.o && CN_DYN.includes((p.d || '').trim()));
  if (bad.length) issues.push(`world 疑似中国古典(年代写法) ${bad.length} 条：${bad.slice(0,3).map(p=>p.d+'|'+p.t.slice(0,12)).join(' / ')}`);
}

// 7. 占位符检测
{
  const wPh = pieces.filter(p => ['——', '—', '-', '现代', '民间'].includes(p.w));
  const aPh = pieces.filter(p => /^[—-]+$/.test(p.a || ''));
  const dPh = pieces.filter(p => ['——', '—', '-', '古籍', '古', '中', '民间', '未知'].includes(p.d));
  if (wPh.length) issues.push(`作品占位符 ${wPh.length} 条`);
  if (aPh.length) issues.push(`作者占位符 ${aPh.length} 条`);
  if (dPh.length) issues.push(`年代占位符 ${dPh.length} 条`);
}

// 8. loadAll 自身的 warnings
if (D.warnings.length) issues.push(`loadAll warnings ${D.warnings.length}：${D.warnings.slice(0,3).join(' | ')}`);

// 9. 网络误传句黑名单（正文关键词 → 必须是佚名/现代；防回潮）
{
  const FAKE = ['世界上最遥远的距离', '眼睛为她下着雨', '地狱般的磨砺', '走得太快，灵魂', '走得太快,灵魂', '走得太远，忘记', '走得太远,忘记', '走得太远，以至于', '走得太远而忘记', '不再寻找爱情', '人生恰如三月花', '容若，容若', '我行遍世间', '除了生死', '只有经历过地狱', '汗水是脂肪', '晨光不问赶路人', '寂寞中迷失'];
  for (const p of pieces) {
    if (FAKE.some(k => p.t.includes(k))) {
      if (p.a !== '佚名' || (p.d || '').trim() !== '现代') {
        issues.push(`误传句未归位：「${p.t.slice(0,20)}」作者=${p.a} 年代=${p.d}`);
      }
    }
  }
}

// 10. 年代=现代但 origin=world（现代中文句不应挂世界文学，多为回译外文残留）
{
  const bad = pieces.filter(p => (p.d || '').trim() === '现代' && p.origin === 'world');
  if (bad.length) issues.push(`现代句挂 world ${bad.length} 条：${bad.slice(0,3).map(p=>p.t.slice(0,16)).join(' / ')}`);
}

// 11. 场景错配防回潮（V1 规则表复用：命中关键词必须含目标场景）
{
  const { RULES } = await import('./_scene_rules.mjs');
  let bad = 0, sample = [];
  for (const p of pieces) {
    for (const [kws, targets] of RULES) {
      if (kws.some(k => p.t.includes(k))) {
        if (!(p.s || []).some(id => targets.includes(id))) {
          bad++;
          if (sample.length < 5) sample.push(p.t.slice(0, 20));
          break;
        }
      }
    }
  }
  if (bad) issues.push(`场景错配回潮 ${bad} 条（命中关键词但缺目标场景）：${sample.join(' / ')}`);
}

// 12. 同句异译近似检测（同头 8 字 + 长度差≤4 + 前缀重叠≥75%）
{
  // 人工确认的异文/并列句豁免（语义不同，刻意保留）
  const EXEMPT = ['目光放远万事皆悲', '美在于发现在于邂', '我给你我的寂寞我', '玉不琢不成器人不', '保温杯里泡枸杞是', '早睡早起是最好的', '什么都不做只是坐', '流行歌一响青春就', '夜行的人都有自己'];
  const heads = new Map();
  let near = 0, sample = [];
  for (const p of pieces) {
    const k = norm(p.t);
    if (!k || k.length < 8) continue;
    const h = k.slice(0, 8);
    if (!heads.has(h)) heads.set(h, []);
    heads.get(h).push(p);
  }
  for (const [h, arr] of heads) {
    if (arr.length < 2) continue;
    if (EXEMPT.includes(h)) continue;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const a = norm(arr[i].t), b = norm(arr[j].t);
      const short = Math.min(a.length, b.length);
      if (Math.abs(a.length - b.length) > 4) continue;
      let pref = 0;
      while (pref < short && a[pref] === b[pref]) pref++;
      if (pref >= short * 0.75) {
        near++;
        if (sample.length < 5) sample.push(arr[i].t.slice(0, 18) + ' ≋ ' + arr[j].t.slice(0, 18));
      }
    }
  }
  if (near) issues.push(`同句异译近似 ${near} 对：${sample.join(' / ')}`);
}

// ---- 输出 ----
let c = 0, mo = 0, wo = 0;
pieces.forEach(p => { if (p.origin === 'classic') c++; else if (p.origin === 'modern') mo++; else wo++; });
console.log('=== 词句站质量审计 ===');
console.log(`词句 ${pieces.length} | classic ${c} (${Math.round(c/pieces.length*1000)/10}%) | modern ${mo} | world ${wo}`);
console.log(`场景 ${D.scenes.length} | 心情 ${D.moods.length} | 地点 ${D.places.length} | 作者 ${new Set(pieces.map(p=>p.authorSlug)).size}`);
info.forEach(i => console.log('· ' + i));
if (!issues.length) {
  console.log('\n✅ 全部检查通过，无问题。');
  process.exit(0);
}
console.log(`\n⚠️ 发现问题 ${issues.length} 项：`);
issues.forEach(i => console.log('  ✗ ' + i));
process.exit(1);
