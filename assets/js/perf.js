// 性能观测（阶段 G3）：采集 LCP / INP / CLS，仅打点不阻塞；
// 正常情况静默，仅当指标异常（LCP>2500ms / CLS>0.25 / INP>200ms）才 console.warn，绝不抛错阻断页面。
export function mountPerf() {
  if (!('PerformanceObserver' in window)) return;
  // 最大内容绘制（LCP）：首屏主体超时才算问题，正常静默（不再每次进页打 info 噪声）
  try {
    new PerformanceObserver(list => {
      const e = list.getEntries().slice(-1)[0];
      if (e && e.startTime > 2500) console.warn('[perf] LCP 偏慢', Math.round(e.startTime), 'ms', e.element ? (e.element.className || e.element.tagName) : '');
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  // 累积布局偏移（CLS）：衡量视觉稳定性
  let cls = 0;
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value;
      if (cls > 0.25) console.warn('[perf] CLS 偏高', cls.toFixed(3));
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  // 交互到下一次绘制（INP）：衡量响应迟缓
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (e.duration > 200) console.warn('[perf] 慢交互', e.name, Math.round(e.duration) + 'ms');
    }).observe({ type: 'event', durationThreshold: 104, buffered: true });
  } catch (e) {}
}
