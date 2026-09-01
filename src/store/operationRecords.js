import { defineStore } from "pinia";
import { ref, reactive } from "vue";

export const useOperationRecordsStore = defineStore("operationRecords", () => {
  const isShowChart = ref(false);
  const operationRecords = reactive({
    startTimeStamp: 0,
    operationEvents: [],
  });
  // 选中回溯的格子，供图表点击后高亮棋盘
  const selectedIndex = ref(null);
  const selectedTimestamp = ref(null);

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
    switch (eventType) {
      case "open":
      case "openBlank":
      case "openSave":
      case "flag":
      case "doubleClick":
        operationRecords.operationEvents.push(base);
        break;
      default:
        // 保留扩展：未知类型也记录，便于调试
        operationRecords.operationEvents.push(base);
        break;
    }
  }

  function onStopOperateRecords() {
    isShowChart.value = true;
  }

  // 决策效率记录：每次操作相对最佳操作的得分 0-10，逐操作精确记录
  const efficiencyEvents = reactive([]);

  function onRecordEfficiency({ prob, pBest, score, action, index, row, col }) {
    const now = Date.now();
    if (operationRecords.startTimeStamp === 0) {
      operationRecords.startTimeStamp = now;
    }
    efficiencyEvents.push({
      clickTimestamp: now,
      timeSinceStartSec: (now - operationRecords.startTimeStamp) / 1000,
      prob,
      pBest,
      score, // 0-1
      score10: Math.round(score * 100) / 10, // 0-10 保留1位
      action, // 'open' | 'flag' | 'chord'
      index,
      row,
      col,
    });
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
    if (isShowChart.value === false) return;
    operationRecords.operationEvents = [];
    operationRecords.startTimeStamp = 0;
    efficiencyEvents.splice(0, efficiencyEvents.length);
    clearSelection();
    isShowChart.value = false;
  }

  return {
    isShowChart,
    operationRecords,
    efficiencyEvents,
    selectedIndex,
    selectedTimestamp,
    onUpdateOperateRecords,
    onRecordEfficiency,
    selectOperation,
    clearSelection,
    onStopOperateRecords,
    onFreshOperateRecords,
  };
});
