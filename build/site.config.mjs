export const SITE = {
  name: '词句',
  tagline: '此刻，说句好的',
  // 部署前请改成你的真实地址，用于 SEO 的 canonical / og:url：
  //   自定义域名：    'https://ciju.example.com'
  //   user 页(根)：   'https://你的用户名.github.io'
  //   项目子目录页：  'https://你的用户名.github.io/ciju'  并把下面 base 改成 '/ciju/'
  origin: 'https://ciju.net',
  base: '/',           // 若部署在子目录，改成 '/ciju/'
  desc: '按此刻的处境找词句。登顶、放榜、送别、深夜加班……127 个具体场景，每一句都标好了怎么用。古诗词、名人名言、中外金句，点一下就复制。',
  keywords: ['词句','好词好句','古诗词','名人名言','朋友圈文案','文案','金句','诗词摘抄','vlog文案','签名'],
  author: '词句',
  year: new Date().getFullYear()
};

export const NAV = [
  { href: '', label: '首页' },
  { href: 'scenes/', label: '全部场景' },
  { href: 'moods/', label: '按心情' },
  { href: 'places/', label: '按地点' },
  { href: 'authors/', label: '按作者' },
  { href: 'search/', label: '搜索' }
];
