import { defineStore } from "pinia";
import { ref, reactive } from "vue";

// 单次棋盘快照：完整记录当时哪些格子已开/插旗/问号，用于图表点击后彻底回到当时情景
// 位串与 board-replay.js 的 encodeGridState 对应："0101…"，长度 = 棋盘格数

export const useOperationRecordsStore = defineStore("operationRecords", () => {
  const isShowChart = ref(false);
  const operationRecords = reactive({
    startTimeStamp: 0,
    operationEvents: [],
  });

  // 选中回溯的格子，供图表点击后高亮棋盘
  const selectedIndex = ref(null);
  const selectedTimestamp = ref(null);

  // 逐操作棋盘快照（含 start 首步与 final 终局）
  const snapshots = reactive([]);

  function onUpdateOperateRecords(eventType, meta = {}) {
    const now = Date.now();
    if (operationRecords.startTimeStamp === 0) {
      operationRecords.startTimeStamp = now;
    }
    if (!eventType) return;
    const base = {
      clickTimestamp: now,
      type: eventType,
      timeSinceStartSec: (now - operationRecords.startTimeStamp) / 1000,
    };
    if (meta.index != null) {
      base.index = meta.index;
      base.row = meta.row;
      base.col = meta.col;
    } else if (meta.row != null || meta.col != null) {
      base.row = meta.row;
      base.col = meta.col;
    }
    if (meta.flagState != null) {
      // 右键动作的具体落点：'flag' | 'question' | 'none'（拔旗/取消问号后的状态）
      base.flagState = meta.flagState;
    }
    operationRecords.operationEvents.push(base);
  }

  function onStopOperateRecords() {
    isShowChart.value = true;
  }

  // 决策效率记录：每次操作相对最佳操作的得分 0-10，逐操作精确记录
  const efficiencyEvents = reactive([]);

  function onRecordEfficiency({ prob, pMin, pMax, score, action, index, row, col }) {
    const now = Date.now();
    if (operationRecords.startTimeStamp === 0) {
      operationRecords.startTimeStamp = now;
    }
    efficiencyEvents.push({
      clickTimestamp: now,
      timeSinceStartSec: (now - operationRecords.startTimeStamp) / 1000,
      prob,
      pMin, // 当时全盘最低雷概率
      pMax, // 当时全盘最高雷概率
      score, // 0-1
      score10: Math.round(score * 100) / 10, // 0-10 保留1位
      action, // 'open' | 'flag' | 'unflag' | 'chord'
      index,
      row,
      col,
    });
  }

  function appendSnapshot(snap) {
    const now = Date.now();
    if (operationRecords.startTimeStamp === 0) {
      operationRecords.startTimeStamp = now;
    }
    snapshots.push({
      clickTimestamp: now,
      timeSinceStartSec: (now - operationRecords.startTimeStamp) / 1000,
      ...snap,
    });
  }

  // 找到 ≤ timestamp 的最近快照（点击图表某点时，回到该动作刚完成时的棋盘）
  function findSnapshotAt(timestamp) {
    if (!snapshots.length) return null;
    let found = null;
    for (const snap of snapshots) {
      if (snap.clickTimestamp <= timestamp) {
        found = snap;
      } else {
        break;
      }
    }
    return found ?? snapshots[0];
  }

  function findFinalSnapshot() {
    return snapshots.length ? snapshots[snapshots.length - 1] : null;
  }

  function selectOperation(index, timestamp) {
    selectedIndex.value = index;
    selectedTimestamp.value = timestamp ?? null;
  }
  function clearSelection() {
    selectedIndex.value = null;
    selectedTimestamp.value = null;
  }

  function onFreshOperateRecords() {
    // 无条件清空：中途放弃重开时，旧局数据不能混入新局
    operationRecords.operationEvents = [];
    operationRecords.startTimeStamp = 0;
    efficiencyEvents.splice(0, efficiencyEvents.length);
    snapshots.splice(0, snapshots.length);
    clearSelection();
    isShowChart.value = false;
  }

  return {
    isShowChart,
    operationRecords,
    efficiencyEvents,
    snapshots,
    selectedIndex,
    selectedTimestamp,
    onUpdateOperateRecords,
    onRecordEfficiency,
    appendSnapshot,
    findSnapshotAt,
    findFinalSnapshot,
    selectOperation,
    clearSelection,
    onStopOperateRecords,
    onFreshOperateRecords,
  };
});
