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
      case "flag":
        operationRecords.operationEvents.push({
          clickTimestamp: Date.now(),
          type: "flag",
        });
        break;
      case "openBlank":
        operationRecords.operationEvents.push({
          clickTimestamp: Date.now(),
          type: "openBlank",
        });
        break;
      default:
        break;
    }
  }

  function onStopOperateRecords() {
    isShowChart.value = true;
  }

  function onFreshOperateRecords() {
    if (isShowChart.value === false) return;
    operationRecords.operationEvents = [];
    operationRecords.startTimeStamp = 0;
    isShowChart.value = false;
  }

  return {
    isShowChart,
    operationRecords,
    onUpdateOperateRecords,
    onStopOperateRecords,
    onFreshOperateRecords,
  };
});
