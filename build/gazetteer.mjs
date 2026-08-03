/* 中国文学地名词典（gazetteer）—— 「附近的诗句」的唯一真源
 *
 * 为什么要有这个文件：
 *   地点成千上万，不可能在 Excel 里给每条词句人工标注。所以改用「地名关键词自动扫描」：
 *   构建时拿这份词典去扫每条词句的 **出处/题目**（→ 题咏地，这首多半就写于此）
 *   和 **正文/注释**（→ 描写地，这首写到了这个地方），自动生成地名索引。
 *   前端定位到坐标后，按距离分环去索引里捞，尽可能把全站相关内容都露出来。
 *
 * 字段：
 *   id     唯一标识（英文，用于索引，改名会导致旧缓存失配，尽量别改）
 *   name   显示名（用古称，读起来有味道）
 *   city   今地（帮用户对上号）
 *   lat/lng 坐标（约取地标或城区中心）
 *   alias  古今别名 —— 扫描用。**必须 ≥2 字**，单字（蜀/湘/吴/越/秦…）歧义太大一律不收。
 *          排序无所谓，扫描时会按长度优先匹配。
 *   region 所属文化区，取 data/词句数据.xlsx「地点」sheet 的 id：
 *          jiangnan 江南 / saiwai 塞外 / changan 长安 / guxiang 故乡 / taxiang 他乡
 *          bianguan 边关 / jianghu 江湖 / tianyuan 田园 / loutai 楼台 / jiangpan 江畔
 *          yueye 月夜 / guoguo 故国 / yiyu 异域 / gudao 古道
 */

export const GAZETTEER = [
  // ───────────────── 江苏 · 浙江 · 上海（江南） ─────────────────
  { id: 'xihu', name: '西湖', city: '杭州', lat: 30.2450, lng: 120.1490,
    alias: ['西湖', '钱塘', '临安', '武林', '苏堤', '断桥', '孤山', '灵隐', '杭州'], region: ['jiangnan'] },
  { id: 'gusu', name: '姑苏', city: '苏州', lat: 31.2990, lng: 120.5850,
    alias: ['姑苏', '苏州', '寒山寺', '枫桥', '吴中', '吴门', '阊门', '虎丘', '吴江'], region: ['jiangnan'] },
  { id: 'jinling', name: '金陵', city: '南京', lat: 32.0603, lng: 118.7969,
    alias: ['金陵', '建康', '建业', '石头城', '秦淮', '乌衣巷', '朱雀桥', '台城', '钟山', '南京', '江宁'], region: ['jiangnan', 'guoguo'] },
  { id: 'yangzhou', name: '广陵', city: '扬州', lat: 32.3936, lng: 119.4130,
    alias: ['扬州', '广陵', '维扬', '二十四桥', '瘦西湖', '平山堂', '竹西'], region: ['jiangnan'] },
  { id: 'jingkou', name: '京口·北固山', city: '镇江', lat: 32.2297, lng: 119.4536,
    alias: ['京口', '北固', '润州', '丹徒', '甘露寺', '多景楼', '铁瓮', '镇江'], region: ['jiangnan', 'loutai'] },
  { id: 'jinshan', name: '金山·焦山', city: '镇江', lat: 32.2320, lng: 119.4050,
    alias: ['金山寺', '焦山', '西津渡', '妙高台'], region: ['jiangnan', 'jiangpan'] },
  { id: 'guazhou', name: '瓜洲渡', city: '扬州', lat: 32.2380, lng: 119.4230,
    alias: ['瓜洲', '瓜州'], region: ['jiangnan', 'jiangpan'] },
  { id: 'taihu', name: '太湖', city: '无锡', lat: 31.2000, lng: 120.2000,
    alias: ['太湖', '震泽', '无锡', '惠山'], region: ['jiangnan'] },
  { id: 'lanting', name: '兰亭·会稽', city: '绍兴', lat: 30.0000, lng: 120.5300,
    alias: ['兰亭', '会稽', '山阴', '越州', '鉴湖', '绍兴', '沈园'], region: ['jiangnan'] },
  { id: 'fuchun', name: '富春江', city: '桐庐', lat: 29.7970, lng: 119.6860,
    alias: ['富春', '桐庐', '严陵', '七里滩', '钓台'], region: ['jiangpan', 'tianyuan'] },
  { id: 'tianmu', name: '天姥·剡溪', city: '绍兴新昌', lat: 29.4000, lng: 120.9000,
    alias: ['天姥', '剡溪', '天台'], region: ['jiangnan', 'tianyuan'] },
  { id: 'yandang', name: '雁荡山', city: '温州', lat: 28.3800, lng: 121.0500,
    alias: ['雁荡', '永嘉', '温州'], region: ['tianyuan'] },
  { id: 'huating', name: '华亭·云间', city: '上海', lat: 31.0300, lng: 121.2200,
    alias: ['华亭', '云间', '松江', '沪渎'], region: ['jiangnan'] },
  { id: 'piling', name: '毗陵', city: '常州', lat: 31.8100, lng: 119.9700,
    alias: ['毗陵', '常州', '兰陵'], region: ['jiangnan'] },
  { id: 'huaiyin', name: '淮阴·楚州', city: '淮安', lat: 33.5100, lng: 119.1500,
    alias: ['淮阴', '楚州', '淮上', '淮安'], region: ['jiangnan'] },
  { id: 'pengcheng', name: '彭城', city: '徐州', lat: 34.2600, lng: 117.1800,
    alias: ['彭城', '徐州', '燕子楼', '云龙'], region: ['jianghu'] },
  { id: 'mingzhou', name: '明州·四明', city: '宁波', lat: 29.8700, lng: 121.5500,
    alias: ['明州', '四明', '甬上'], region: ['jiangnan'] },

  // ───────────────── 安徽 ─────────────────
  { id: 'jingting', name: '敬亭山', city: '宣城', lat: 30.9800, lng: 118.7300,
    alias: ['敬亭', '宣城', '宣州', '谢朓楼', '宛陵'], region: ['loutai', 'tianyuan'] },
  { id: 'caishi', name: '采石矶', city: '马鞍山', lat: 31.6300, lng: 118.4700,
    alias: ['采石', '牛渚', '当涂', '天门山'], region: ['jiangpan'] },
  { id: 'huangshan', name: '黄山', city: '黄山', lat: 30.1300, lng: 118.1700,
    alias: ['黄山', '黟山', '新安江'], region: ['tianyuan'] },
  { id: 'taohuatan', name: '桃花潭', city: '宣城泾县', lat: 30.6300, lng: 118.4000,
    alias: ['桃花潭', '汪伦'], region: ['jiangnan'] },
  { id: 'chuzhou', name: '滁州·醉翁亭', city: '滁州', lat: 32.3000, lng: 118.3000,
    alias: ['滁州', '醉翁亭', '琅琊', '丰乐亭'], region: ['tianyuan'] },
  { id: 'jiuhua', name: '九华山', city: '池州', lat: 30.4800, lng: 117.8000,
    alias: ['九华', '池州', '秋浦'], region: ['tianyuan'] },
  { id: 'luzhou', name: '庐州', city: '合肥', lat: 31.8200, lng: 117.2300,
    alias: ['庐州', '合肥', '巢湖'], region: ['jianghu'] },

  // ───────────────── 江西 ─────────────────
  { id: 'tengwang', name: '滕王阁', city: '南昌', lat: 28.6830, lng: 115.8710,
    alias: ['滕王阁', '豫章', '洪都', '南昌'], region: ['loutai'] },
  { id: 'lushan', name: '庐山', city: '九江', lat: 29.5500, lng: 115.9800,
    alias: ['庐山', '匡庐', '香炉峰', '五老峰', '柴桑'], region: ['tianyuan'] },
  { id: 'xunyang', name: '浔阳江', city: '九江', lat: 29.7100, lng: 116.0000,
    alias: ['浔阳', '江州', '湓浦', '琵琶亭', '九江'], region: ['jiangpan'] },
  { id: 'poyang', name: '鄱阳湖', city: '上饶鄱阳', lat: 29.2000, lng: 116.3000,
    alias: ['鄱阳', '彭蠡'], region: ['jianghu'] },
  { id: 'yugutai', name: '郁孤台', city: '赣州', lat: 25.8300, lng: 114.9300,
    alias: ['郁孤台', '赣江', '虔州', '造口'], region: ['loutai'] },
  { id: 'shangrao', name: '带湖·鹅湖', city: '上饶', lat: 28.4500, lng: 117.9700,
    alias: ['上饶', '信州', '鹅湖', '带湖', '博山'], region: ['tianyuan'] },

  // ───────────────── 湖北 ─────────────────
  { id: 'huanghelou', name: '黄鹤楼', city: '武汉', lat: 30.5450, lng: 114.3020,
    alias: ['黄鹤楼', '黄鹤', '鹦鹉洲', '汉阳', '江夏', '武昌', '鄂州', '晴川'], region: ['loutai'] },
  { id: 'chibi', name: '赤壁', city: '咸宁赤壁', lat: 29.7200, lng: 113.9000,
    alias: ['赤壁', '乌林'], region: ['jianghu'] },
  { id: 'huangzhou', name: '黄州·东坡', city: '黄冈', lat: 30.4500, lng: 114.8700,
    alias: ['黄州', '东坡', '雪堂', '定慧院', '承天寺'], region: ['taxiang'] },
  { id: 'xiangyang', name: '襄阳·鹿门', city: '襄阳', lat: 32.0100, lng: 112.1200,
    alias: ['襄阳', '岘山', '鹿门', '汉江', '汉水', '隆中'], region: ['guxiang'] },
  { id: 'jiangling', name: '江陵·荆州', city: '荆州', lat: 30.3300, lng: 112.2400,
    alias: ['江陵', '荆州', '云梦', '南郡'], region: ['jianghu'] },
  { id: 'sanxia', name: '三峡', city: '宜昌', lat: 30.7000, lng: 111.3000,
    alias: ['三峡', '西陵峡', '夷陵'], region: ['jianghu'] },

  // ───────────────── 湖南 ─────────────────
  { id: 'yueyang', name: '岳阳楼·洞庭', city: '岳阳', lat: 29.3800, lng: 113.1300,
    alias: ['岳阳', '洞庭', '君山', '巴陵'], region: ['loutai', 'jianghu'] },
  { id: 'changsha', name: '长沙·湘江', city: '长沙', lat: 28.2300, lng: 112.9400,
    alias: ['长沙', '潇湘', '三湘', '湘江', '汨罗', '橘子洲', '岳麓', '湘水'], region: ['jianghu'] },
  { id: 'hengyang', name: '衡阳·回雁峰', city: '衡阳', lat: 27.2500, lng: 112.7000,
    alias: ['衡阳', '衡山', '回雁峰', '祝融', '南岳'], region: ['jianghu', 'tianyuan'] },
  { id: 'taohuayuan', name: '桃花源·武陵', city: '常德', lat: 28.9000, lng: 111.5000,
    alias: ['桃花源', '武陵'], region: ['tianyuan'] },
  { id: 'yongzhou', name: '永州·愚溪', city: '永州', lat: 26.4200, lng: 111.6100,
    alias: ['永州', '零陵', '愚溪'], region: ['taxiang'] },

  // ───────────────── 河南 ─────────────────
  { id: 'luoyang', name: '洛阳', city: '洛阳', lat: 34.6200, lng: 112.4500,
    alias: ['洛阳', '洛城', '东都', '伊阙', '龙门', '天津桥', '洛水'], region: ['guxiang'] },
  { id: 'bianjing', name: '汴京', city: '开封', lat: 34.7970, lng: 114.3070,
    alias: ['汴京', '汴梁', '大梁', '东京', '汴水', '汴河'], region: ['guoguo'] },
  { id: 'songshan', name: '嵩山', city: '郑州登封', lat: 34.5000, lng: 113.0300,
    alias: ['嵩山', '嵩阳', '少室', '颍川'], region: ['tianyuan'] },
  { id: 'nanyang', name: '南阳', city: '南阳', lat: 32.9900, lng: 112.5300,
    alias: ['南阳', '宛城'], region: ['tianyuan'] },
  { id: 'suiyang', name: '睢阳·梁园', city: '商丘', lat: 34.4100, lng: 115.6500,
    alias: ['睢阳', '梁园', '宋州'], region: ['guoguo'] },

  // ───────────────── 陕西 ─────────────────
  { id: 'changan', name: '长安', city: '西安', lat: 34.2650, lng: 108.9540,
    alias: ['长安', '西京', '灞桥', '灞陵', '曲江', '乐游原', '杜陵', '香积寺', '西安'], region: ['changan'] },
  { id: 'zhongnan', name: '终南·辋川', city: '西安', lat: 33.9900, lng: 108.9500,
    alias: ['终南', '辋川', '蓝田', '鹿柴'], region: ['changan', 'tianyuan'] },
  { id: 'huashan', name: '华山', city: '渭南', lat: 34.4800, lng: 110.0800,
    alias: ['华山', '太华', '华阴'], region: ['tianyuan'] },
  { id: 'tongguan', name: '潼关', city: '渭南潼关', lat: 34.5400, lng: 110.2500,
    alias: ['潼关'], region: ['bianguan', 'gudao'] },
  { id: 'lishan', name: '骊山·华清池', city: '西安临潼', lat: 34.3600, lng: 109.2100,
    alias: ['骊山', '华清', '马嵬'], region: ['changan'] },
  { id: 'hanzhong', name: '汉中·大散关', city: '汉中', lat: 33.0700, lng: 107.0300,
    alias: ['汉中', '南郑', '大散关'], region: ['bianguan'] },
  { id: 'yanzhou', name: '延州', city: '延安', lat: 36.6000, lng: 109.5000,
    alias: ['延州', '肤施'], region: ['saiwai'] },

  // ───────────────── 山西 ─────────────────
  { id: 'yanmen', name: '雁门关', city: '忻州代县', lat: 39.3000, lng: 112.8500,
    alias: ['雁门', '代州', '龙城'], region: ['saiwai', 'bianguan'] },
  { id: 'guanque', name: '鹳雀楼', city: '运城永济', lat: 34.8600, lng: 110.3300,
    alias: ['鹳雀楼', '蒲州'], region: ['loutai'] },
  { id: 'jinyang', name: '晋阳', city: '太原', lat: 37.8700, lng: 112.5500,
    alias: ['晋阳', '太原', '并州', '汾水'], region: ['taxiang'] },
  { id: 'wutai', name: '五台山', city: '忻州', lat: 38.9700, lng: 113.6000,
    alias: ['五台', '清凉山'], region: ['tianyuan'] },

  // ───────────────── 京津冀 ─────────────────
  { id: 'youzhou', name: '幽州台', city: '北京', lat: 39.9000, lng: 116.4000,
    alias: ['幽州', '燕京', '蓟北', '蓟门', '大都', '北平', '居庸', '燕山'], region: ['taxiang'] },
  { id: 'yishui', name: '易水', city: '保定易县', lat: 39.3500, lng: 115.5000,
    alias: ['易水', '易河'], region: ['bianguan'] },
  { id: 'handan', name: '邯郸·邺城', city: '邯郸', lat: 36.6200, lng: 114.5400,
    alias: ['邯郸', '邺城', '漳水'], region: ['guoguo'] },
  { id: 'shanhaiguan', name: '山海关·碣石', city: '秦皇岛', lat: 40.0100, lng: 119.7500,
    alias: ['山海关', '榆关', '碣石'], region: ['bianguan'] },

  // ───────────────── 山东 ─────────────────
  { id: 'taishan', name: '泰山', city: '泰安', lat: 36.2500, lng: 117.1000,
    alias: ['泰山', '岱宗', '岱岳', '齐鲁'], region: ['tianyuan'] },
  { id: 'jinan', name: '济南·大明湖', city: '济南', lat: 36.6700, lng: 117.0000,
    alias: ['济南', '历下', '大明湖', '趵突'], region: ['guxiang'] },
  { id: 'qufu', name: '曲阜·阙里', city: '济宁曲阜', lat: 35.6000, lng: 116.9900,
    alias: ['曲阜', '阙里', '洙泗', '泗水'], region: ['guxiang'] },
  { id: 'penglai', name: '蓬莱', city: '烟台', lat: 37.8100, lng: 120.7600,
    alias: ['蓬莱', '登州'], region: ['jianghu'] },
  { id: 'mizhou', name: '密州·超然台', city: '潍坊诸城', lat: 35.9900, lng: 119.4100,
    alias: ['密州', '超然台'], region: ['taxiang'] },

  // ───────────────── 四川 · 重庆 ─────────────────
  { id: 'chengdu', name: '锦官城', city: '成都', lat: 30.6600, lng: 104.0630,
    alias: ['锦官', '锦城', '成都', '浣花溪', '草堂', '武侯祠', '益州', '蜀州'], region: ['taxiang'] },
  { id: 'emei', name: '峨眉山', city: '乐山', lat: 29.5200, lng: 103.3300,
    alias: ['峨眉', '峨嵋', '嘉州', '平羌'], region: ['tianyuan'] },
  { id: 'jianmen', name: '剑门·蜀道', city: '广元', lat: 32.2200, lng: 105.5800,
    alias: ['剑门', '剑阁', '蜀道'], region: ['gudao'] },
  { id: 'baidi', name: '白帝城·夔州', city: '重庆奉节', lat: 31.0500, lng: 109.5700,
    alias: ['白帝', '夔州', '瞿塘'], region: ['jianghu'] },
  { id: 'wushan', name: '巫山·巫峡', city: '重庆巫山', lat: 31.0700, lng: 109.8800,
    alias: ['巫山', '巫峡', '神女'], region: ['jianghu'] },
  { id: 'yuzhou', name: '渝州', city: '重庆', lat: 29.5600, lng: 106.5500,
    alias: ['渝州', '巴渝', '嘉陵', '巴山'], region: ['taxiang'] },
  { id: 'langzhong', name: '阆中', city: '南充阆中', lat: 31.5600, lng: 106.0000,
    alias: ['阆中', '阆州'], region: ['taxiang'] },

  // ───────────────── 西北（塞外 · 边关 · 异域） ─────────────────
  { id: 'yumen', name: '玉门关·阳关', city: '敦煌', lat: 40.3600, lng: 93.8700,
    alias: ['玉门', '阳关', '敦煌', '沙州'], region: ['bianguan'] },
  { id: 'liangzhou', name: '凉州', city: '武威', lat: 37.9300, lng: 102.6400,
    alias: ['凉州', '武威', '河西'], region: ['bianguan'] },
  { id: 'jincheng', name: '金城', city: '兰州', lat: 36.0600, lng: 103.8300,
    alias: ['金城', '兰州'], region: ['bianguan'] },
  { id: 'qinzhou', name: '秦州', city: '天水', lat: 34.5800, lng: 105.7200,
    alias: ['秦州', '天水', '陇上', '陇头', '陇西'], region: ['bianguan'] },
  { id: 'shuofang', name: '朔方·贺兰', city: '银川', lat: 38.4900, lng: 106.2300,
    alias: ['朔方', '灵州', '贺兰', '受降城', '回乐峰'], region: ['saiwai'] },
  { id: 'xiaoguan', name: '萧关', city: '固原', lat: 36.0000, lng: 106.2800,
    alias: ['萧关'], region: ['bianguan'] },
  { id: 'qinghai', name: '青海·湟中', city: '西宁', lat: 36.6200, lng: 101.7800,
    alias: ['青海', '湟中', '西宁'], region: ['saiwai'] },
  { id: 'yinshan', name: '阴山·大漠', city: '呼和浩特', lat: 40.8400, lng: 111.7500,
    alias: ['阴山', '大漠', '朔漠', '单于', '敕勒'], region: ['saiwai'] },
  { id: 'juyan', name: '居延', city: '阿拉善额济纳', lat: 41.9500, lng: 101.0700,
    alias: ['居延', '燕然'], region: ['saiwai'] },
  { id: 'luntai', name: '轮台·天山', city: '巴音郭楞轮台', lat: 41.7800, lng: 84.2500,
    alias: ['轮台', '西域', '天山'], region: ['yiyu', 'saiwai'] },
  { id: 'loulan', name: '楼兰', city: '巴音郭楞若羌', lat: 40.5100, lng: 89.8700,
    alias: ['楼兰', '鄯善'], region: ['yiyu'] },
  { id: 'wusun', name: '伊犁·乌孙', city: '伊犁', lat: 43.9200, lng: 81.3200,
    alias: ['乌孙', '伊犁'], region: ['yiyu'] },

  // ───────────────── 东南 · 岭南 ─────────────────
  { id: 'fuzhou', name: '福州·闽中', city: '福州', lat: 26.0700, lng: 119.3000,
    alias: ['福州', '闽中', '榕城'], region: ['taxiang'] },
  { id: 'wuyi', name: '武夷山', city: '南平', lat: 27.7500, lng: 118.0300,
    alias: ['武夷', '建溪'], region: ['tianyuan'] },
  { id: 'quanzhou', name: '泉州·刺桐', city: '泉州', lat: 24.8700, lng: 118.6800,
    alias: ['泉州', '刺桐'], region: ['jianghu'] },
  { id: 'guangzhou', name: '广州·五羊', city: '广州', lat: 23.1300, lng: 113.2600,
    alias: ['广州', '岭南', '番禺', '五羊', '南海'], region: ['taxiang'] },
  { id: 'huizhou', name: '惠州·罗浮', city: '惠州', lat: 23.1100, lng: 114.4200,
    alias: ['惠州', '罗浮'], region: ['taxiang'] },
  { id: 'chaozhou', name: '潮州·韩江', city: '潮州', lat: 23.6600, lng: 116.6200,
    alias: ['潮州', '潮阳', '韩江'], region: ['taxiang'] },
  { id: 'guilin', name: '桂林·漓江', city: '桂林', lat: 25.2800, lng: 110.2900,
    alias: ['桂林', '漓江', '桂州'], region: ['tianyuan'] },
  { id: 'liuzhou', name: '柳州', city: '柳州', lat: 24.3300, lng: 109.4200,
    alias: ['柳州'], region: ['taxiang'] },
  { id: 'danzhou', name: '儋州·琼州', city: '儋州', lat: 19.5200, lng: 109.5800,
    alias: ['儋州', '琼州', '海南'], region: ['taxiang', 'yiyu'] },

  // ───────────────── 西南 ─────────────────
  { id: 'yelang', name: '夜郎', city: '贵阳', lat: 26.6500, lng: 106.6300,
    alias: ['夜郎', '贵阳', '黔中'], region: ['taxiang'] },
  { id: 'kunming', name: '滇池', city: '昆明', lat: 25.0400, lng: 102.7100,
    alias: ['滇池', '昆明', '南诏'], region: ['yiyu'] },

  // ───────────────── 东北 ─────────────────
  { id: 'liaodong', name: '辽东', city: '沈阳', lat: 41.8000, lng: 123.4300,
    alias: ['辽东', '盛京', '辽海'], region: ['saiwai'] },
  { id: 'songhua', name: '松花江', city: '哈尔滨', lat: 45.8000, lng: 126.5300,
    alias: ['松花江', '白山黑水'], region: ['saiwai'] },
  { id: 'changbai', name: '长白山', city: '延边', lat: 42.0000, lng: 128.0500,
    alias: ['长白'], region: ['saiwai'] },

  // ═══════════════ 第二批扩充 ═══════════════
  // 一、诗里点了名、之前没收进来的地方

  { id: 'poshansi', name: '破山寺·虞山', city: '常熟', lat: 31.6500, lng: 120.7300,
    alias: ['破山寺', '虞山', '常熟', '琴川'], region: ['jiangnan'] },
  { id: 'jiandejiang', name: '建德江·严陵', city: '杭州建德', lat: 29.4750, lng: 119.2800,
    alias: ['建德江', '建德'], region: ['jiangnan', 'jiangpan'] },
  { id: 'furongshan', name: '芙蓉山', city: '郴州', lat: 25.7700, lng: 113.0200,
    alias: ['芙蓉山', '郴州', '郴江'], region: ['taxiang'] },
  { id: 'shangshan', name: '商山', city: '商洛', lat: 33.8700, lng: 109.9400,
    alias: ['商山', '商洛', '商州', '武关'], region: ['gudao'] },
  { id: 'weicheng', name: '渭城·咸阳', city: '咸阳', lat: 34.3300, lng: 108.7100,
    alias: ['渭城', '咸阳', '渭水', '渭川'], region: ['changan', 'gudao'] },
  { id: 'fuliang', name: '浮梁', city: '景德镇', lat: 29.2700, lng: 117.1800,
    alias: ['浮梁', '昌江'], region: ['taxiang'] },
  { id: 'yingzhou', name: '颍州西湖', city: '阜阳', lat: 32.8900, lng: 115.8100,
    alias: ['颍州', '颍水', '汝阴'], region: ['loutai'] },

  // 二、江苏 · 浙江 · 上海 · 安徽（补密）

  { id: 'langshan', name: '狼山·崇川', city: '南通', lat: 31.9800, lng: 120.8900,
    alias: ['狼山', '崇川', '通州'], region: ['jiangpan'] },
  { id: 'haizhou', name: '海州·郁洲', city: '连云港', lat: 34.6000, lng: 119.2200,
    alias: ['海州', '郁洲', '朐山'], region: ['taxiang'] },
  { id: 'hailing', name: '海陵', city: '泰州', lat: 32.4600, lng: 119.9200,
    alias: ['海陵', '泰州'], region: ['jiangnan'] },
  { id: 'xiapi', name: '下邳', city: '宿迁', lat: 33.9600, lng: 118.2800,
    alias: ['下邳', '宿迁'], region: ['jianghu'] },
  { id: 'wuxing', name: '吴兴·苕溪', city: '湖州', lat: 30.8900, lng: 120.0900,
    alias: ['吴兴', '苕溪', '湖州', '霅溪'], region: ['jiangnan'] },
  { id: 'jiahe', name: '嘉禾·鸳湖', city: '嘉兴', lat: 30.7500, lng: 120.7600,
    alias: ['嘉禾', '嘉兴', '鸳湖', '槜李'], region: ['jiangnan'] },
  { id: 'quzhou', name: '衢州·烂柯', city: '衢州', lat: 28.9700, lng: 118.8700,
    alias: ['衢州', '烂柯', '信安'], region: ['tianyuan'] },
  { id: 'wuzhou', name: '婺州', city: '金华', lat: 29.0800, lng: 119.6500,
    alias: ['婺州', '金华', '双溪'], region: ['jiangnan'] },
  { id: 'tiantai', name: '天台山', city: '台州', lat: 29.1400, lng: 121.0300,
    alias: ['天台山', '赤城', '石梁'], region: ['tianyuan'] },
  { id: 'putuo', name: '普陀·海天', city: '舟山', lat: 30.0000, lng: 122.1000,
    alias: ['普陀', '舟山', '昌国'], region: ['jianghu'] },
  { id: 'chuzhou_zj', name: '处州·括苍', city: '丽水', lat: 28.4700, lng: 119.9200,
    alias: ['处州', '括苍', '丽水'], region: ['tianyuan'] },
  { id: 'shouchun', name: '寿春·八公山', city: '淮南', lat: 32.6300, lng: 116.9900,
    alias: ['寿春', '八公山', '淝水', '寿州'], region: ['bianguan'] },
  { id: 'wancheng', name: '皖城', city: '安庆', lat: 30.5100, lng: 117.0600,
    alias: ['皖城', '安庆', '皖江'], region: ['jiangpan'] },
  { id: 'jiuzi', name: '鸠兹', city: '芜湖', lat: 31.3500, lng: 118.3800,
    alias: ['鸠兹', '芜湖'], region: ['jiangpan'] },
  { id: 'qiaojun', name: '谯郡', city: '亳州', lat: 33.8500, lng: 115.7800,
    alias: ['谯郡', '亳州'], region: ['guxiang'] },

  // 三、中原 · 齐鲁 · 燕赵（补密）

  { id: 'xuchang', name: '许都', city: '许昌', lat: 34.0400, lng: 113.8500,
    alias: ['许都', '许昌', '许州'], region: ['guoguo'] },
  { id: 'yinxu', name: '殷墟·彰德', city: '安阳', lat: 36.1000, lng: 114.3900,
    alias: ['殷墟', '安阳', '彰德', '洹水'], region: ['guoguo'] },
  { id: 'yiyang', name: '义阳·淮源', city: '信阳', lat: 32.1300, lng: 114.0900,
    alias: ['义阳', '信阳', '申州'], region: ['taxiang'] },
  { id: 'caizhou', name: '蔡州', city: '驻马店', lat: 33.0100, lng: 114.0200,
    alias: ['蔡州', '汝南'], region: ['taxiang'] },
  { id: 'linzi', name: '临淄', city: '淄博', lat: 36.8300, lng: 118.3100,
    alias: ['临淄', '齐城'], region: ['guoguo'] },
  { id: 'yishui_sd', name: '沂水·琅琊', city: '临沂', lat: 35.1000, lng: 118.3500,
    alias: ['沂水', '沂蒙', '临沂'], region: ['tianyuan'] },
  { id: 'donge', name: '东昌·聊城', city: '聊城', lat: 36.4500, lng: 115.9800,
    alias: ['东昌', '聊城', '博平'], region: ['taxiang'] },
  { id: 'jimo', name: '即墨·崂山', city: '青岛', lat: 36.0700, lng: 120.3800,
    alias: ['即墨', '崂山', '劳山'], region: ['jianghu'] },
  { id: 'zhending', name: '真定·常山', city: '石家庄', lat: 38.1400, lng: 114.5700,
    alias: ['真定', '镇州', '井陉'], region: ['bianguan'] },
  { id: 'luanzhou', name: '滦州', city: '唐山', lat: 39.7400, lng: 118.7000,
    alias: ['滦州', '滦河', '卢龙'], region: ['bianguan'] },
  { id: 'mulan', name: '木兰围场·热河', city: '承德', lat: 40.9900, lng: 117.9400,
    alias: ['木兰围场', '避暑山庄', '承德'], region: ['saiwai'] },
  { id: 'yunzhong', name: '云中·平城', city: '大同', lat: 40.0900, lng: 113.3000,
    alias: ['平城', '大同', '云州', '云中'], region: ['saiwai', 'bianguan'] },
  { id: 'shangdang', name: '上党', city: '长治', lat: 36.2000, lng: 113.1200,
    alias: ['上党', '潞州'], region: ['bianguan'] },
  { id: 'pingyang', name: '平阳·尧都', city: '临汾', lat: 36.0900, lng: 111.5200,
    alias: ['尧都', '临汾'], region: ['guxiang'] },

  // 四、荆楚 · 湖湘 · 江右（补密）

  { id: 'wudang', name: '武当山', city: '十堰', lat: 32.4000, lng: 111.0000,
    alias: ['武当', '太和山', '均州'], region: ['tianyuan'] },
  { id: 'jingmen', name: '荆门', city: '荆门', lat: 31.0300, lng: 112.2000,
    alias: ['荆门', '当阳'], region: ['taxiang'] },
  { id: 'suizhou', name: '随州', city: '随州', lat: 31.7100, lng: 113.3800,
    alias: ['随州', '厉山'], region: ['taxiang'] },
  { id: 'wulingyuan', name: '武陵源·澧水', city: '张家界', lat: 29.1200, lng: 110.4800,
    alias: ['武陵源', '澧水', '慈利'], region: ['tianyuan'] },
  { id: 'yuanling', name: '沅陵·五溪', city: '怀化', lat: 28.4600, lng: 110.4000,
    alias: ['沅陵', '五溪', '辰州'], region: ['taxiang'] },
  { id: 'jizhou_jx', name: '吉州·白鹭洲', city: '吉安', lat: 27.1100, lng: 114.9900,
    alias: ['吉州', '庐陵'], region: ['taxiang'] },
  { id: 'linchuan', name: '临川', city: '抚州', lat: 27.9800, lng: 116.3600,
    alias: ['临川', '抚州', '汝水'], region: ['guxiang'] },
  { id: 'yuanzhou', name: '袁州·仰山', city: '宜春', lat: 27.8000, lng: 114.4200,
    alias: ['袁州', '宜春', '仰山'], region: ['tianyuan'] },

  // 五、岭南 · 闽海（补密）

  { id: 'meiling', name: '梅岭·大庾', city: '韶关', lat: 25.4200, lng: 114.3000,
    alias: ['梅岭', '大庾', '庾岭', '韶州'], region: ['gudao', 'taxiang'] },
  { id: 'zhujiang', name: '珠江·南海', city: '深圳东莞', lat: 22.7500, lng: 113.8000,
    alias: ['珠江', '东莞', '宝安'], region: ['taxiang'] },
  { id: 'leizhou', name: '雷州', city: '湛江', lat: 20.9100, lng: 110.0900,
    alias: ['雷州', '徐闻'], region: ['taxiang', 'yiyu'] },
  { id: 'hepu', name: '合浦·北海', city: '北海', lat: 21.4800, lng: 109.1200,
    alias: ['合浦', '廉州'], region: ['yiyu'] },
  { id: 'yongzhou_gx', name: '邕州', city: '南宁', lat: 22.8200, lng: 108.3200,
    alias: ['邕州', '邕江'], region: ['yiyu'] },
  { id: 'xiamen', name: '鹭岛·同安', city: '厦门', lat: 24.4800, lng: 118.0900,
    alias: ['鹭岛', '厦门', '同安', '鹭江'], region: ['jianghu'] },
  { id: 'meizhou', name: '湄洲·莆阳', city: '莆田', lat: 25.4300, lng: 119.0100,
    alias: ['湄洲', '莆阳', '兴化'], region: ['jianghu'] },
  { id: 'haikou', name: '琼台·海口', city: '海口', lat: 20.0400, lng: 110.3200,
    alias: ['海口', '琼山'], region: ['yiyu'] },
  { id: 'xianggang', name: '香江·屯门', city: '中国香港', lat: 22.3200, lng: 114.1700,
    alias: ['香江', '屯门'], region: ['taxiang'] },
  { id: 'aomen', name: '濠镜·妈阁', city: '中国澳门', lat: 22.1900, lng: 113.5400,
    alias: ['濠镜', '妈阁'], region: ['taxiang'] },
  { id: 'taibei', name: '鸡笼·淡水', city: '中国台湾台北', lat: 25.0330, lng: 121.5650,
    alias: ['鸡笼', '淡水河', '东宁'], region: ['taxiang'] },

  // 六、巴蜀 · 云贵（补密）

  { id: 'mianzhou', name: '绵州·涪江', city: '绵阳', lat: 31.4700, lng: 104.6800,
    alias: ['绵州', '涪江', '涪城'], region: ['guxiang'] },
  { id: 'meishan', name: '眉山·三苏', city: '眉山', lat: 30.0500, lng: 103.8300,
    alias: ['眉山', '眉州'], region: ['guxiang'] },
  { id: 'luzhou_sc', name: '泸州', city: '泸州', lat: 28.8700, lng: 105.4400,
    alias: ['泸州', '泸水', '江阳'], region: ['jiangpan'] },
  { id: 'rongzhou', name: '戎州', city: '宜宾', lat: 28.7700, lng: 104.6200,
    alias: ['戎州', '宜宾', '叙州'], region: ['jiangpan'] },
  { id: 'bozhou_gz', name: '播州', city: '遵义', lat: 27.7300, lng: 106.9300,
    alias: ['播州', '遵义'], region: ['taxiang'] },
  { id: 'nanzhao', name: '苍山洱海·南诏', city: '大理', lat: 25.6000, lng: 100.2700,
    alias: ['洱海', '点苍山', '大理', '叶榆'], region: ['yiyu'] },
  { id: 'lijiang', name: '丽江·玉龙', city: '丽江', lat: 26.8700, lng: 100.2300,
    alias: ['丽江', '玉龙雪山'], region: ['yiyu'] },
  { id: 'luoxie', name: '逻些·吐蕃', city: '拉萨', lat: 29.6500, lng: 91.1400,
    alias: ['吐蕃', '逻些', '雪域'], region: ['yiyu'] },

  // 七、西北 · 西域 · 东北（补密）

  { id: 'chencang', name: '陈仓·岐山', city: '宝鸡', lat: 34.3600, lng: 107.1400,
    alias: ['陈仓', '岐山', '扶风', '宝鸡'], region: ['bianguan', 'gudao'] },
  { id: 'shangjun', name: '上郡·统万', city: '榆林', lat: 38.2800, lng: 109.7300,
    alias: ['上郡', '统万', '横山'], region: ['saiwai'] },
  { id: 'jingzhou_gs', name: '泾州', city: '平凉', lat: 35.5400, lng: 106.6800,
    alias: ['泾州', '泾水', '崆峒'], region: ['bianguan'] },
  { id: 'ganzhou', name: '甘州·张掖', city: '张掖', lat: 38.9300, lng: 100.4500,
    alias: ['甘州', '张掖', '删丹'], region: ['saiwai', 'bianguan'] },
  { id: 'suzhou_gs', name: '肃州·酒泉', city: '酒泉', lat: 39.7300, lng: 98.5100,
    alias: ['肃州', '酒泉'], region: ['saiwai', 'bianguan'] },
  { id: 'beiting', name: '北庭·庭州', city: '昌吉吉木萨尔', lat: 44.0000, lng: 89.2000,
    alias: ['北庭', '庭州', '金满'], region: ['yiyu', 'saiwai'] },
  { id: 'gaochang', name: '高昌·交河', city: '吐鲁番', lat: 42.9500, lng: 89.1800,
    alias: ['高昌', '交河', '火焰山', '西州'], region: ['yiyu'] },
  { id: 'shule', name: '疏勒', city: '喀什', lat: 39.4700, lng: 75.9900,
    alias: ['疏勒', '喀什'], region: ['yiyu'] },
  { id: 'lvshun', name: '旅顺口·辽南', city: '大连', lat: 38.9100, lng: 121.6100,
    alias: ['旅顺', '金州'], region: ['saiwai'] },
  { id: 'jilin', name: '吉林·船厂', city: '长春吉林', lat: 43.8400, lng: 126.5500,
    alias: ['乌拉', '船厂'], region: ['saiwai'] }
];

/* 「看着像地名、其实不是」的坑。扫描前先把这些片段从文本里挖掉，
 * 免得「彩云间」被当成松江云间、「访戴天山」被当成新疆天山。 */
export const BLOCK_PHRASES = [
  '彩云间', '白云间', '青云间',   // 云间 → 松江古称，但这些是「云彩之间」
  '戴天山',                       // 李白《访戴天山道士不遇》，在四川，不是新疆天山
  '周郎顾',                       // 「欲得周郎顾」说的是周瑜听琴，不是赤壁
  '云中谁寄', '云中君',           // 「云中」在这些句子里是云端，不是大同云中郡
  // ── 词牌 / 曲牌名里嵌了地名字样，但内容与该地无关 ──
  '武陵春', '兰陵王',
  '酒泉子',                       // 「酒泉子·长忆观潮」写的是钱塘潮
  '八声甘州', '甘州遍',           // 词牌，与河西甘州无关
  '阳关曲',                       // 苏轼「阳关曲·中秋月」写于徐州，不是玉门阳关
  '梁州令', '伊州歌',             // 同为曲牌名
  '六州歌头', '石州慢'
];

/** 扫描用的别名表：按长度降序，长的优先命中，避免「洛阳」被「洛」之类切碎 */
export const ALIAS_TABLE = (() => {
  const rows = [];
  for (const g of GAZETTEER) {
    for (const a of g.alias) {
      if (a && a.length >= 2) rows.push({ a, id: g.id });
    }
  }
  rows.sort((x, y) => y.a.length - x.a.length);
  return rows;
})();

/** 给前端用的精简版（不含 alias，客户端不需要再扫文本） */
export function geoClientJSON() {
  return GAZETTEER.map(g => ({
    i: g.id, n: g.name, c: g.city,
    y: +g.lat.toFixed(4), x: +g.lng.toFixed(4),
    r: g.region
  }));
}
