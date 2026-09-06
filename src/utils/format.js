// 游戏内计时显示：m:ss，分钟封顶 99（与图表轴 formatTimeLabel 语义不同，各管各）。
export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 99) return `99:${String(Math.min(s, 59)).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
