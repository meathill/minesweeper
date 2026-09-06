// 图表数据转换：操作事件流 → Chart.js 数据集（纯函数，便于测试）

export const SECONDS_PER_BUCKET = 6; // RPM 桶宽度：短局按秒，长局折算 0.1 分钟

export function formatTimeLabel(sec) {
  const totalSec = Math.round(sec)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }
  return `${m}:${String(s).padStart(2,'0')}`
}

// events: operationEvents；efficiencyEvents: 效率事件
// 超过 100s 的局 x 轴以分钟为单位（isMinuteScale），否则以秒为单位
export function transferEventsToData({ events, efficiencyEvents = [], startTimeStamp }) {
  const allTimestamps = [
    ...events.map((e) => e.clickTimestamp),
    ...efficiencyEvents.map((e) => e.clickTimestamp),
  ]
  const maxTimestamp = allTimestamps.length ? Math.max(...allTimestamps) : Date.now()
  const totalSeconds = (maxTimestamp - startTimeStamp) / 1000
  const isMinuteScale = totalSeconds > 100

  function getXForSec(sec) {
    return isMinuteScale ? sec / 60 : sec
  }

  // --- RPM 桶聚合（区域图）：补全从 0 到结束的每个桶，无事件的桶为 0，避免间隙被插值出虚假操作 ---
  const bucketWidthSec = SECONDS_PER_BUCKET;
  const bucketCount = Math.max(1, Math.ceil(totalSeconds / bucketWidthSec));
  const buckets = Array.from({ length: bucketCount + 1 }, (_, i) => ({
    interval: isMinuteScale ? Math.round((i * bucketWidthSec) / 60 * 10) / 10 : i * bucketWidthSec,
    open: 0,
    openBlank: 0,
    openSave: 0,
    flag: 0,
    doubleClick: 0,
  }));
  events.forEach((event) => {
    const elapsedSec = (event.clickTimestamp - startTimeStamp) / 1000
    const idx = Math.max(0, Math.min(bucketCount, Math.ceil(elapsedSec / bucketWidthSec)))
    buckets[idx][event.type] = (buckets[idx][event.type] || 0) + 1;
  });

  // --- 逐操作精确点：效率与地雷概率 x 为真实时刻 ---
  const effPoints = efficiencyEvents.map((ev, idx) => {
    const sec = ev.timeSinceStartSec ?? (ev.clickTimestamp - startTimeStamp) / 1000
    // 轻微 y 抖动避免 y=10 完全重叠导致无法点击
    const jitter = ev.score10 === 10 ? (Math.random() - 0.5) * 0.18 : 0
    return {
      x: getXForSec(sec),
      y: Math.min(10, Math.max(0, ev.score10 + jitter)),
      _y0: ev.score10,
      index: ev.index,
      row: ev.row,
      col: ev.col,
      prob: ev.prob,
      pMin: ev.pMin,
      pMax: ev.pMax,
      action: ev.action,
      score10: ev.score10,
      clickTimestamp: ev.clickTimestamp,
      _effIndex: idx,
    }
  }).sort((a,b)=>a.x-b.x)

  const probPoints = efficiencyEvents
    .filter(ev => ev.action === 'open' || ev.action === 'chord')
    .map(ev => {
      const sec = ev.timeSinceStartSec ?? (ev.clickTimestamp - startTimeStamp) / 1000
      return {
        x: getXForSec(sec),
        y: Math.round(ev.prob * 100) / 10, // 0-10 同轴，tooltip 显示 %
        index: ev.index,
        row: ev.row,
        col: ev.col,
        prob: ev.prob,
        action: ev.action,
        clickTimestamp: ev.clickTimestamp,
      }
    }).sort((a,b)=>a.x-b.x)

  // 旗标与翻开的逐操作精确散点（y 为事件标记，x 为真实时刻）
  // 左轴上 y=0 附近分散，避免与 RPM 区域重叠：flag 在 0.9-1.1，open 在 1.3-1.5 轻微随机
  const flagPoints = events.filter(e => e.type === 'flag').map(e => {
    const sec = e.timeSinceStartSec ?? (e.clickTimestamp - startTimeStamp) / 1000
    return {
      x: getXForSec(sec),
      y: 0.9 + Math.random() * 0.22,
      index: e.index,
      row: e.row,
      col: e.col,
      action: 'flag',
      flagState: e.flagState,
      clickTimestamp: e.clickTimestamp,
    }
  }).sort((a,b)=>a.x-b.x)

  // 去重：同一 index 在 50ms 内只留一条（连开的自动展开只画一个点）
  const openEvents = events.filter(e => ['open','openBlank','openSave'].includes(e.type) && e.index != null)
    .sort((a,b)=>a.clickTimestamp-b.clickTimestamp)
  const dedupEvents = []
  for (const e of openEvents) {
    const last = dedupEvents[dedupEvents.length-1]
    if (last && last.index === e.index && e.clickTimestamp - last.clickTimestamp < 50) continue
    dedupEvents.push(e)
  }
  const dedupOpen = dedupEvents.map((e) => {
    const sec = e.timeSinceStartSec ?? (e.clickTimestamp - startTimeStamp) / 1000
    return {
      x: getXForSec(sec),
      y: 1.35 + Math.random() * 0.22,
      index: e.index,
      row: e.row,
      col: e.col,
      action: e.type,
      clickTimestamp: e.clickTimestamp,
    }
  })

  return { buckets, effPoints, probPoints, flagPoints, openPoints: dedupOpen, totalSeconds, isMinuteScale };
}
