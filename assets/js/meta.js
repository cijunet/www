// 轻量元数据（场景/心情/地点/作者名映射），供卡片渲染、今日提示词、相关推荐展示用。
// 构建期产出 data/meta.json（仅 .gz 预压缩）；这里只在首次需要时拉取一次并缓存。
// aslug = 作者名 → slug 的反查表：分面 token #a 存的是 slug，而分片记录里的 a 是作者名。
import { baseHref } from './util.js';
import { fetchJSON } from './hashsearch.js';

let _promise = null;
// 阶段 I：场景/心情/地点/作者改为 {name,desc,...} 富结构；新增 groups、jq（详情页查询串渲染需要）
let _meta = { scenes: {}, moods: {}, places: {}, authors: {}, groups: {}, jq: [], aslug: {} };

export async function loadMeta() {
  if (_promise) return _promise;
  _promise = (async () => {
    try {
      const j = await fetchJSON(baseHref(), 'meta.json');
      _meta = {
        scenes: j.scenes || {},
        moods: j.moods || {},
        places: j.places || {},
        authors: j.authors || {},
        groups: j.groups || {},
        jq: Array.isArray(j.jq) ? j.jq : [],
        aslug: j.aslug || {}
      };
    } catch (e) { /* meta 缺失不致命，卡片只是少显示场景名 */ }
    return _meta;
  })();
  return _promise;
}
