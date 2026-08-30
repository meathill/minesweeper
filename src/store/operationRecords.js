import { defineStore } from "pinia";
import { ref, reactive } from "vue";

export const useOperationRecordsStore = defineStore("operationRecords", () => {
  const isShowChart = ref(false);
  const operationRecords = reactive({
    startTimeStamp: 0,
    operationEvents: [],
  });

  function onUpdateOperateRecords(eventType) {
    if (operationRecords.startTimeStamp === 0) {
      operationRecords.startTimeStamp = Date.now();
    }
    switch (eventType) {
      case "open":
        operationRecords.operationEvents.push({
          clickTimestamp: Date.now(),
          type: "open",
        });
        break;
      case "openBlank":
        operationRecords.operationEvents.push({
          clickTimestamp: Date.now(),
          type: "openBlank",
        });
        break
      case "openSave":
        operationRecords.operationEvents.push({
          clickTimestamp: Date.now(),
          type: "openSave",
        });
        break;
      case "flag":
        operationRecords.operationEvents.push({
          clickTimestamp: Date.now(),
          type: "flag",
        });
        break;
      case "doubleClick":
        operationRecords.operationEvents.push({
          clickTimestamp: Date.now(),
          type: "doubleClick",
        });
        break;
      default:
        break;
    }
  }

  function onStopOperateRecords() {
    isShowChart.value = true;
  }

  // 决策效率记录：每次操作相对最佳操作的得分 0-10
  const efficiencyEvents = reactive([]);

  function onRecordEfficiency({ prob, pBest, score, action, index }) {
    efficiencyEvents.push({
      clickTimestamp: Date.now(),
      prob,
      pBest,
      score, // 0-1
      score10: Math.round(score * 100) / 10, // 0-10 保留1位
      action, // 'open' | 'flag' | 'chord'
      index,
    });
  }

  function onFreshOperateRecords() {
    if (isShowChart.value === false) return;
    operationRecords.operationEvents = [];
    operationRecords.startTimeStamp = 0;
    efficiencyEvents.splice(0, efficiencyEvents.length);
    isShowChart.value = false;
  }

  return {
    isShowChart,
    operationRecords,
    efficiencyEvents,
    onUpdateOperateRecords,
    onRecordEfficiency,
    onStopOperateRecords,
    onFreshOperateRecords,
  };
});
