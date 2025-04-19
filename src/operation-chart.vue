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

const isMoreThanOneHundredSec = ref(false);
const secPerInterval = ref(6)
const operationEventsData = ref([]);

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      type: "linear",
      title: {
        display: true,
        text: isMoreThanOneHundredSec.value ? "时间（分钟）" : "时间（秒）",
      },
      min: 0,
      ticks: {
        stepSize: isMoreThanOneHundredSec.value ? (secPerInterval.value / 60) : secPerInterval.value
      },
    },
    y: {
      title: {
        display: true,
        text: "RPM（操作次数/分钟）",
      },
      min: 0,
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
}));

const chartData = computed(() => ({
  labels: operationEventsData.value.map((item) => item.interval.toString()),
  datasets: [
    {
      label: "打开安全区",
      borderColor: "#4bc0c0",
      data: operationEventsData.value.map((item) => item.openSave),
      pointRadius: 5,
      tension: 0.1,
    },
    {
      label: "插旗",
      borderColor: "#FF6B6B",
      data: operationEventsData.value.map((item) => item.flag),
      pointRadius: 5,
      tension: 0.1,
    },
  ],
}));

onMounted(() => {
  operationEventsData.value = transferEventsToData(operationEvents);
});

function transferEventsToData(events) {
  // 先判断是否超过100秒
  const maxTimestamp = Math.max(...events.map((event) => event.clickTimestamp));
  const totalSeconds = (maxTimestamp - startTimeStamp) / 1000;
  const _isMoreThanOneHundredSec = totalSeconds > 100;
  isMoreThanOneHundredSec.value = totalSeconds > 100;
  
  const groupedData = {};
  groupedData[0] = { interval: 0, open: 0, openBlank: 0, openSave:0 ,flag: 0, doubleClick: 0 };

  events.forEach((event) => {
    // 超过100秒，据开始过去了多少分钟
    // 小于100秒，据开始过去了多少秒
    const timeSinceStart = _isMoreThanOneHundredSec
      ? (event.clickTimestamp - startTimeStamp) / 1000 / 60
      : (event.clickTimestamp - startTimeStamp) / 1000; 
    // 超过100秒，所属的区间块index（分钟） = 据开始过去了多少分钟 / 每个区间多少分钟(每个区间多少秒/60)
    // 小于100秒，所属的区间块index（秒） = 据开始过去了多少秒 / 每个区间多少秒
    const IntervalIndex =  _isMoreThanOneHundredSec
      ? Math.ceil(timeSinceStart / (secPerInterval.value / 60))
      : Math.ceil(timeSinceStart / secPerInterval.value) 
    // 超过100秒，当前区间的值(分钟) = 所属的区间块index（分钟）* 每个区间多少分钟
    // 小于100秒，当前区间的值(秒) = 所属的区间块index（秒）* 每个区间多少秒
    const interval = _isMoreThanOneHundredSec
      ? IntervalIndex * (secPerInterval.value / 60)
      : IntervalIndex * secPerInterval.value

    if (!groupedData[interval]) {
      groupedData[interval] = { interval: interval, open: 0,  openBlank: 0, openSave:0 , flag: 0,doubleClick: 0 };
    }
    groupedData[interval][event.type] += 1;
  });

  return Object.values(groupedData).sort((a, b) => a.interval - b.interval); // 按照时间刻度排序
}
</script>

<script>
export default {
  name: "OperationChart",
};
</script>
