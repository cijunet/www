// 农历推算（1900–2100）+ 节日/节气日历生成 —— 仅构建期使用
// 输出：为 2026–2040 每一年生成 MMDD -> 节日/节气 映射，随 data/history.json 下发
// 客户端只做查表，不做推算。

// 经典农历数据表：每项编码一个农历年的月份大小与闰月
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, // 2050-2059
  0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, // 2060-2069
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, // 2070-2079
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, // 2080-2089
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252, // 2090-2099
  0x0d520 // 2100
];

function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
function leapDays(y) { if (!leapMonth(y)) return 0; return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29; }
function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function yearDays(y) {
  let sum = 348; // 12 * 29
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}

const MS_PER_DAY = 86400000;
// 农历 1900 年正月初一 = 公历 1900-01-31
function lunarNewYear(y) { // 返回农历 y 年正月初一对应的公历 Date（UTC）
  let ms = Date.UTC(1900, 0, 31);
  for (let i = 1900; i < y; i++) ms += yearDays(i) * MS_PER_DAY;
  return new Date(ms);
}
function addDays(dt, n) { return new Date(dt.getTime() + n * MS_PER_DAY); }
function fmt(dt) { return String(dt.getUTCMonth() + 1).padStart(2, '0') + String(dt.getUTCDate()).padStart(2, '0'); }

// 农历 (y 年 m 月 d 日，非闰月) -> 公历 MMDD
function lunarToMMDD(y, m, d) {
  let ms = lunarNewYear(y).getTime();
  const leap = leapMonth(y);
  for (let i = 1; i < m; i++) {
    ms += monthDays(y, i) * MS_PER_DAY;
    if (i === leap) ms += leapDays(y) * MS_PER_DAY;
  }
  ms += (d - 1) * MS_PER_DAY;
  return fmt(new Date(ms));
}

// 公历某月第 n 个星期 w（0=周日）
function nthWeekday(y, month, w, n) {
  const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
  const day = 1 + ((w - first + 7) % 7) + (n - 1) * 7;
  return String(month).padStart(2, '0') + String(day).padStart(2, '0');
}

// ── 节气：通式公式（21 世纪 C 值） day = floor(Y*0.2422 + C) - floor((Y-1)/4)，Y = 年份后两位 ──
const TERMS = [
  { m: 1, n: '小寒', c: 5.4055 }, { m: 1, n: '大寒', c: 20.12 },
  { m: 2, n: '立春', c: 3.87 }, { m: 2, n: '雨水', c: 18.73 },
  { m: 3, n: '惊蛰', c: 5.63 }, { m: 3, n: '春分', c: 20.646 },
  { m: 4, n: '清明', c: 4.81 }, { m: 4, n: '谷雨', c: 20.1 },
  { m: 5, n: '立夏', c: 5.52 }, { m: 5, n: '小满', c: 21.04 },
  { m: 6, n: '芒种', c: 5.678 }, { m: 6, n: '夏至', c: 21.37 },
  { m: 7, n: '小暑', c: 7.108 }, { m: 7, n: '大暑', c: 22.83 },
  { m: 8, n: '立秋', c: 7.5 }, { m: 8, n: '处暑', c: 23.13 },
  { m: 9, n: '白露', c: 7.646 }, { m: 9, n: '秋分', c: 23.042 },
  { m: 10, n: '寒露', c: 8.318 }, { m: 10, n: '霜降', c: 23.438 },
  { m: 11, n: '立冬', c: 7.438 }, { m: 11, n: '小雪', c: 22.36 },
  { m: 12, n: '大雪', c: 7.18 }, { m: 12, n: '冬至', c: 21.94 }
];
const TERM_SEASON = m => (m >= 3 && m <= 5) ? 'spring' : (m >= 6 && m <= 8) ? 'summer' : (m >= 9 && m <= 11) ? 'autumn' : 'winter';
function termMMDD(y, t) {
  const Y = y % 100;
  const L = (t.m <= 2) ? Math.floor((Y - 1) / 4) : Math.floor(Y / 4);
  const day = Math.floor(Y * 0.2422 + t.c) - L;
  return String(t.m).padStart(2, '0') + String(day).padStart(2, '0');
}

// ── 节日定义 ──
// 农历节日：lm/ld；公历节日：fm/fd；浮动节日：特殊计算
const LUNAR_FESTS = [
  { lm: 1, ld: 1, n: '春节', s: 'spring', scenes: ['kuanian', 'shousui'], kw: ['春节', '新春', '过年', '拜年', '新年'] },
  { lm: 1, ld: 15, n: '元宵节', s: 'spring', scenes: [], kw: ['元宵', '元夕', '花灯', '灯', '月圆'] },
  { lm: 2, ld: 2, n: '龙抬头', s: 'spring', scenes: ['chuchun'], kw: ['龙抬头', '春龙', '春耕'] },
  { lm: 5, ld: 5, n: '端午节', s: 'summer', scenes: [], kw: ['端午', '屈原', '龙舟', '粽', '离骚', '楚辞'] },
  { lm: 7, ld: 7, n: '七夕', s: 'summer', scenes: [], kw: ['七夕', '鹊桥', '牛郎', '织女', '银河', '情人'] },
  { lm: 7, ld: 15, n: '中元节', s: 'summer', scenes: ['zhongyuan'], kw: ['中元', '祭故人', '思念'] },
  { lm: 8, ld: 15, n: '中秋节', s: 'autumn', scenes: ['zhongqiu'], kw: ['中秋', '满月', '明月', '月圆', '婵娟', '桂花', '团圆'] },
  { lm: 9, ld: 9, n: '重阳节', s: 'autumn', scenes: ['chongyang'], kw: ['重阳', '登高', '茱萸', '菊花', '敬老'] },
  { lm: 12, ld: 8, n: '腊八', s: 'winter', scenes: [], kw: ['腊八', '粥', '年味'] },
  { lm: 12, ld: 23, n: '小年', s: 'winter', scenes: ['kuanian'], kw: ['小年', '灶', '年味'] }
];
const SOLAR_FESTS = [
  { fm: 1, fd: 1, n: '元旦', s: 'winter', scenes: [], kw: ['元旦', '新年', '跨年'] },
  { fm: 2, fd: 14, n: '情人节', s: 'spring', scenes: [], kw: ['情人', '所爱', '爱情'] },
  { fm: 3, fd: 8, n: '妇女节', s: 'spring', scenes: [], kw: ['母亲', '女性', '巾帼'] },
  { fm: 3, fd: 12, n: '植树节', s: 'spring', scenes: ['chuchun'], kw: ['植树', '春风', '绿'] },
  { fm: 4, fd: 1, n: '愚人节', s: 'spring', scenes: [], kw: ['玩笑', '趣'] },
  { fm: 4, fd: 23, n: '世界读书日', s: 'spring', scenes: ['dushu'], kw: ['读书', '书卷', '书香'] },
  { fm: 5, fd: 1, n: '劳动节', s: 'spring', scenes: [], kw: ['劳作', '躬耕', '耕耘', '劳动'] },
  { fm: 5, fd: 4, n: '青年节', s: 'spring', scenes: ['shaonian'], kw: ['青春', '少年', '意气', '青年'] },
  { fm: 6, fd: 1, n: '儿童节', s: 'summer', scenes: ['tongnian'], kw: ['童年', '儿时', '小时候', '儿童'] },
  { fm: 9, fd: 10, n: '教师节', s: 'autumn', scenes: [], kw: ['师恩', '教诲', '先生', '老师'] },
  { fm: 10, fd: 1, n: '国庆节', s: 'autumn', scenes: [], kw: ['山河', '家国', '盛世', '国庆'] },
  { fm: 12, fd: 24, n: '平安夜', s: 'winter', scenes: [], kw: ['平安', '炉火'] },
  { fm: 12, fd: 25, n: '圣诞节', s: 'winter', scenes: [], kw: ['圣诞', '炉火', '雪'] },
  { fm: 12, fd: 31, n: '跨年夜', s: 'winter', scenes: ['kuanian'], kw: ['跨年', '新年', '守岁'] }
];

// 生成某一年的日历：MMDD -> { n, kind, s, scenes, kw }
export function yearCalendar(y) {
  const cal = {};
  const put = (mmdd, entry) => { if (!cal[mmdd]) cal[mmdd] = entry; }; // 先入为主：节日优先于节气（节日先放）
  for (const f of SOLAR_FESTS) put(String(f.fm).padStart(2, '0') + String(f.fd).padStart(2, '0'), { n: f.n, kind: '节日', s: f.s, scenes: f.scenes, kw: f.kw });
  // 浮动公历节日
  put(nthWeekday(y, 5, 0, 2), { n: '母亲节', kind: '节日', s: 'spring', scenes: [], kw: ['母亲', '妈妈', '慈母', '游子'] });
  put(nthWeekday(y, 6, 0, 3), { n: '父亲节', kind: '节日', s: 'summer', scenes: [], kw: ['父亲', '爸爸'] });
  // 农历节日（除夕 = 当年正月初一前一天）
  for (const f of LUNAR_FESTS) put(lunarToMMDD(y, f.lm, f.ld), { n: f.n, kind: '节日', s: f.s, scenes: f.scenes, kw: f.kw });
  const nye = addDays(lunarNewYear(y), -1);
  put(fmt(nye), { n: '除夕', kind: '节日', s: 'winter', scenes: ['shousui', 'kuanian'], kw: ['除夕', '守岁', '年关', '团圆'] });
  // 节气
  for (const t of TERMS) put(termMMDD(y, t), { n: t.n, kind: '节气', s: TERM_SEASON(t.m), scenes: [], kw: [] });
  return cal;
}

// 兜底节气表（2026 年的日期），超出预生成年份时使用
export function fallbackTerms(y) {
  const out = {};
  for (const t of TERMS) out[termMMDD(y, t)] = { n: t.n, kind: '节气', s: TERM_SEASON(t.m), scenes: [], kw: [] };
  return out;
}

// 自检：node build/lunar.mjs
if (process.argv[1] && process.argv[1].endsWith('lunar.mjs')) {
  const checks = [
    ['2026 春节', yearCalendar(2026), '0217', '春节'],
    ['2026 除夕', yearCalendar(2026), '0216', '除夕'],
    ['2026 元宵', yearCalendar(2026), '0303', '元宵节'],
    ['2026 端午', yearCalendar(2026), '0619', '端午节'],
    ['2026 七夕', yearCalendar(2026), '0819', '七夕'],
    ['2026 中元', yearCalendar(2026), '0827', '中元节'],
    ['2026 中秋', yearCalendar(2026), '0925', '中秋节'],
    ['2026 重阳', yearCalendar(2026), '1018', '重阳节'],
    ['2025 春节', yearCalendar(2025), '0129', '春节'],
    ['2024 春节', yearCalendar(2024), '0210', '春节'],
    ['2027 春节', yearCalendar(2027), '0206', '春节'],
    ['2028 春节', yearCalendar(2028), '0126', '春节'],
    ['2030 春节', yearCalendar(2030), '0203', '春节']
  ];
  let bad = 0;
  for (const [label, cal, mmdd, name] of checks) {
    const hit = cal[mmdd];
    const ok = hit && hit.n === name;
    console.log(`${ok ? '✓' : '✗'} ${label} 应为 ${mmdd} ${name}，实际 ${hit ? mmdd + ' ' + hit.n : '未命中'}`);
    if (!ok) {
      bad++;
      // 找出实际落在了哪天
      for (const [k, v] of Object.entries(cal)) if (v.n === name) console.log(`    → 实际在 ${k}`);
    }
  }
  const c26 = yearCalendar(2026);
  for (const mmdd of ['0204', '0405', '0807', '1222']) {
    console.log(`2026 ${mmdd}: ${c26[mmdd] ? c26[mmdd].n : '（无）'}`);
  }
  console.log(bad ? `\n${bad} 项不符` : '\n全部通过');
}
