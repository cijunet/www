// 情绪标签：一条词句可挂多个情绪，用于跨场景的横向检索
export const moods = [
  { id: 'haomai',   name: '豪迈',   desc: '胸中有气，声音要大' },
  { id: 'zhuangzhi',name: '壮志',   desc: '想干一件大事' },
  { id: 'kuangxi',  name: '狂喜',   desc: '好消息来了，压不住' },
  { id: 'shiran',   name: '释然',   desc: '想通了，放下了' },
  { id: 'canglang', name: '苍凉',   desc: '天地很大，人很小' },
  { id: 'chensi',   name: '沉思',   desc: '不说话，在想事' },
  { id: 'wennuan',  name: '温柔',   desc: '心是软的' },
  { id: 'xinshang', name: '欣赏',   desc: '美得说不出话' },
  { id: 'sinian',   name: '思念',   desc: '想一个人，想一个地方' },
  { id: 'gudu',     name: '孤独',   desc: '一个人，但不一定难过' },
  { id: 'shiluo',   name: '失落',   desc: '心里空了一块' },
  { id: 'beiliang', name: '悲凉',   desc: '难过到发冷' },
  { id: 'buping',   name: '不平',   desc: '看不下去，想说话' },
  { id: 'chaoran',  name: '超然',   desc: '不争了，也不慌' },
  { id: 'jueqiang', name: '倔强',   desc: '还没输，还要来' },
  { id: 'tongche',  name: '通透',   desc: '看明白了世事' },
  { id: 'youmo',    name: '幽默',   desc: '苦中带笑，自嘲' },
  { id: 'zhenxi',   name: '珍惜',   desc: '知道这一刻会过去' },
  { id: 'pingjing', name: '平静',   desc: '心跳很慢，日子很稳' },
  { id: 'jiqing',   name: '激励',   desc: '给自己或别人打气' }
];

export const moodMap = Object.fromEntries(moods.map(m => [m.id, m]));
