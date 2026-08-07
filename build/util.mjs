// 通用工具：slug 生成、转义、路径

// 常见作者拼音表（保证 URL 干净稳定）；表外作者回退到 hash slug
export const authorSlugTable = {
  '李白': 'libai', '杜甫': 'dufu', '苏轼': 'sushi', '辛弃疾': 'xinqiji', '李清照': 'liqingzhao',
  '白居易': 'baijuyi', '王维': 'wangwei', '李商隐': 'lishangyin', '杜牧': 'dumu', '陆游': 'luyou',
  '王安石': 'wanganshi', '欧阳修': 'ouyangxiu', '柳永': 'liuyong', '晏殊': 'yanshu', '晏几道': 'yanjidao',
  '范仲淹': 'fanzhongyan', '孟浩然': 'menghaoran', '王勃': 'wangbo', '刘禹锡': 'liuyuxi', '韩愈': 'hanyu',
  '陶渊明': 'taoyuanming', '曹操': 'caocao', '屈原': 'quyuan', '张若虚': 'zhangruoxu', '王昌龄': 'wangchangling',
  '岑参': 'censhen', '高适': 'gaoshi', '李煜': 'liyu', '纳兰性德': 'nalanxingde', '龚自珍': 'gongzizhen',
  '杨慎': 'yangshen', '文天祥': 'wentianxiang', '于谦': 'yuqian', '郑燮': 'zhengxie', '王之涣': 'wangzhihuan',
  '崔颢': 'cuihao', '张继': 'zhangji', '贺知章': 'hezhizhang', '柳宗元': 'liuzongyuan', '元稹': 'yuanzhen',
  '秦观': 'qinguan', '周敦颐': 'zhoudunyi', '朱熹': 'zhuxi', '黄庭坚': 'huangtingjian', '张孝祥': 'zhangxiaoxiang',
  '蒋捷': 'jiangjie', '姜夔': 'jiangkui', '吴文英': 'wuwenying', '马致远': 'mazhiyuan', '关汉卿': 'guanhanqing',
  '曹雪芹': 'caoxueqin', '孔子': 'kongzi', '孟子': 'mengzi', '老子': 'laozi', '庄子': 'zhuangzi',
  '荀子': 'xunzi', '司马迁': 'simaqian', '诸葛亮': 'zhugeliang', '王羲之': 'wangxizhi', '刘勰': 'liuxie',
  '鲁迅': 'luxun', '朱自清': 'zhuziqing', '沈从文': 'shencongwen', '汪曾祺': 'wangzengqi', '木心': 'muxin',
  '钱钟书': 'qianzhongshu', '杨绛': 'yangjiang', '林语堂': 'linyutang', '张爱玲': 'zhangailing', '席慕蓉': 'ximurong',
  '余光中': 'yuguangzhong', '海子': 'haizi', '北岛': 'beidao', '顾城': 'gucheng', '徐志摩': 'xuzhimo',
  '戴望舒': 'daiwangshu', '穆旦': 'mudan', '史铁生': 'shitiesheng', '路遥': 'luyao', '王小波': 'wangxiaobo',
  '三毛': 'sanmao', '毛泽东': 'maozedong', '梁启超': 'liangqichao', '王国维': 'wangguowei', '胡适': 'hushi',
  '冯友兰': 'fengyoulan', '费孝通': 'feixiaotong', '丰子恺': 'fengzikai', '老舍': 'laoshe', '巴金': 'bajin',
  '茅盾': 'maodun', '冰心': 'bingxin', '梁实秋': 'liangshiqiu', '周作人': 'zhouzuoren', '陈寅恪': 'chenyinke'
};

// 作者名归一：同人异名 / 书名号变体 → 统一写法，避免同一作者被拆成多个作者页
export const authorAlias = {
  '荀况': '荀子',
  '庄周': '庄子',
  '《诗经》': '诗经',
  '孔丘': '孔子',
  '李耳': '老子',
  '孟轲': '孟子',
  '陶潜': '陶渊明',
  '苏东坡': '苏轼',
  '纳兰容若': '纳兰性德',
  '诸葛孔明': '诸葛亮',
  '韩非子': '韩非',
  '无名氏': '佚名',
  // 外文作者译名归一（全名/译名变体 → 常用名）
  '赫尔曼·黑塞': '黑塞',
  '豪尔赫·路易斯·博尔赫斯': '博尔赫斯',
  '勒内·笛卡尔': '笛卡尔',
  '托马斯·爱迪生': '爱迪生',
  '圣雄甘地': '甘地',
  '本杰明·富兰克林': '富兰克林',
  '乔治·萧伯纳': '萧伯纳',
  'A.A.米尔恩': '米尔恩',
  '阿尔弗雷德·丁尼生': '丁尼生',
  '维克多·雨果': '雨果',
  '玛丽·居里': '居里夫人',
  'F.斯科特·菲茨杰拉德': '菲茨杰拉德',
  '约翰·邓恩': '约翰·多恩',
  '罗伯特·勃朗宁': '勃朗宁',
  '汉斯·克里斯蒂安·安徒生': '安徒生',
  '巴勃罗·毕加索': '毕加索',
  '释迦牟尼(谚语)': '释迦牟尼',
  '阿甘正传': '电影《阿甘正传》'
};

// 外文作者用姓名转写
export function slugify(name, table = {}) {
  if (!name) return 'unknown';
  if (table[name]) return table[name];
  // 纯 ASCII：直接规范化
  if (/^[\x20-\x7e]+$/.test(name)) {
    const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (s) return s;
  }
  return 'x' + hash(name);
}

export function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 去掉标点，用于纯文本摘要 / 字数统计
export function plain(s = '') {
  return String(s).replace(/[，。！？；：、"'""''（）《》〈〉…—·,.!?;:"'()\[\]\s]/g, '');
}

export function charLen(s) { return plain(s).length; }

// 长度档：短（适合当标题/签名）/ 中 / 长
export function lengthTier(s) {
  const n = charLen(s);
  if (n <= 12) return 'short';
  if (n <= 28) return 'mid';
  return 'long';
}

export const tierLabel = { short: '极短', mid: '适中', long: '偏长' };

// 相对根路径：depth 为当前页面所在目录深度
export function rel(depth) { return depth === 0 ? './' : '../'.repeat(depth); }
