<template>
  <div class="w-1/2 h-96">
    <Line :options="chartOptions" :data="chartData" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useOperationRecordsStore } from "./store/operationRecords.js";
import { Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const operationStore = useOperationRecordsStore();
const { startTimeStamp, operationEvents } = operationStore.operationRecords;

const ticksPerMinute = 0.1; //  在横坐标上一个刻度代表0.1min
const operationEventsData = ref([]);

onMounted(() => {
  operationEventsData.value = transferEventsToData(operationEvents);
});

const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: "linear",
      title: {
        display: true,
        text: "时间（分钟）",
      },
      min: 0,
      ticks: {
        stepSize: ticksPerMinute,
      },
    },
    y: {
      title: {
        display: true,
        text: "RPM（操作次数/分钟）",
      },
      min: -1,
      ticks: {
        stepSize: 1,
        beginAtZero: true,
      },
    },
  },
  plugins: {
    legend: {
      position: "top",
    },
    title: {
      display: true,
      text: "⭐玩家操作结算",
    },
  },
  animation: {
    duration: 250, // 动画时长（毫秒）
    easing: "ease-out",
  },
});

const chartData = computed(() => ({
  labels: operationEventsData.value.map((item) => item.minute.toString()),
  datasets: [
    {
      label: "点击操作",
      borderColor: "#36A2EB",
      data: operationEventsData.value.map((item) => item.open),
      pointRadius: 5,
      tension: 0.1,
    },
    {
      label: "插旗操作",
      borderColor: "#FF6B6B",
      data: operationEventsData.value.map((item) => item.flag),
      pointRadius: 5,
      tension: 0.1,
    },
    {
      label: "空白点开",
      borderColor: "#4BC0C0",
      data: operationEventsData.value.map((item) => item.openBlank),
      pointRadius: 5,
      tension: 0.1,
    },
  ],
}));

function transferEventsToData(events) {
  const groupedData = {};
  groupedData[0] = { minute: 0, open: 0, flag: 0, openBlank: 0 };
  events.forEach((event) => {
    const timeSinceStart = (event.clickTimestamp - startTimeStamp) / 1000;
    const tickNumber = Math.ceil(timeSinceStart / (ticksPerMinute * 60));
    const minute = tickNumber * ticksPerMinute;
    if (!groupedData[minute]) {
      groupedData[minute] = { minute: minute, open: 0, flag: 0, openBlank: 0 };
    }
    groupedData[minute][event.type] += 1;
  });
  return Object.values(groupedData).sort((a, b) => a.minute - b.minute); // 按照时间刻度排序
}
</script>

<script>
export default {
  name: "OperationChart",
};
</script>
