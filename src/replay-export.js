// 导出本局完整数据（JSON），便于复盘与 debug：雷区、事件流、效率评分、全部棋盘快照

export function buildReplayJson({
  version,
  level,
  grid,
  row,
  column,
  bombNumber,
  result,
  startTimeStamp,
  endTimeStamp,
  operationEvents,
  efficiencyEvents,
  snapshots,
}) {
  return {
    app: 'minesweeper',
    version,
    exportedAt: new Date().toISOString(),
    meta: {
      level,
      row,
      column,
      bombNumber,
      result, // 'win' | 'lose'
      startedAt: new Date(startTimeStamp).toISOString(),
      durationSec: Math.round((endTimeStamp - startTimeStamp) / 1000),
    },
    // 雷区全量布尔数组：配合快照/事件流可在离线完整复原这局
    bombs: grid.map((cell) => !!cell.isBomb),
    operationEvents: [...operationEvents],
    efficiencyEvents: [...efficiencyEvents],
    snapshots: [...snapshots],
  };
}

function formatFilenameTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function downloadReplayJson(data) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const startedAt = data?.meta?.startedAt
    ? Date.parse(data.meta.startedAt)
    : Date.now();
  anchor.href = url;
  anchor.download = `minesweeper-replay-${formatFilenameTime(startedAt)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
