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
  interaction: { mode: 'index', intersect: false },
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
      type: 'linear',
      position: 'left',
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
    y1: {
      type: 'linear',
      position: 'right',
      min: 0,
      max: 10,
      grid: { drawOnChartArea: false },
      title: { display: true, text: "决策效率 0-10" },
      ticks: { stepSize: 1 },
    },
  },
  plugins: {
    legend: {
      position: "top",
    },
    title: {
      display: true,
      text: "⭐玩家操作结算 & 决策效率",
    },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.parsed.y
          if (ctx.dataset.yAxisID === 'y1') return `${ctx.dataset.label}: ${v?.toFixed ? v.toFixed(1) : v} /10`
          return `${ctx.dataset.label}: ${v}`
        }
      }
    }
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
      backgroundColor: "rgba(75,192,192,0.15)",
      yAxisID: 'y',
      data: operationEventsData.value.map((item) => item.openSave),
      pointRadius: 5,
      tension: 0.1,
    },
    {
      label: "插旗",
      borderColor: "#FF6B6B",
      backgroundColor: "rgba(255,107,107,0.15)",
      yAxisID: 'y',
      data: operationEventsData.value.map((item) => item.flag),
      pointRadius: 5,
      tension: 0.1,
    },
    {
      label: "决策效率",
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245,158,11,0.15)",
      yAxisID: 'y1',
      data: operationEventsData.value.map((item) => item.efficiencyAvg ?? null),
      spanGaps: true,
      pointRadius: 5,
      tension: 0.2,
      borderWidth: 2,
    },
  ],
}));

onMounted(() => {
  operationEventsData.value = transferEventsToData(operationEvents, operationStore.efficiencyEvents);
});

function transferEventsToData(events, efficiencyEvents = []) {
  // 先判断是否超过100秒（取两类事件的最大时间）
  const allTimestamps = [...events.map(e => e.clickTimestamp), ...efficiencyEvents.map(e => e.clickTimestamp)]
  const maxTimestamp = allTimestamps.length ? Math.max(...allTimestamps) : Date.now()
  const totalSeconds = (maxTimestamp - startTimeStamp) / 1000;
  const _isMoreThanOneHundredSec = totalSeconds > 100;
  isMoreThanOneHundredSec.value = totalSeconds > 100;
  
  const groupedData = {};
  groupedData[0] = { interval: 0, open: 0, openBlank: 0, openSave:0 ,flag: 0, doubleClick: 0, efficiencySum: 0, efficiencyCount: 0, efficiencyAvg: null };

  function getIntervalFor(ts) {
    const timeSinceStart = _isMoreThanOneHundredSec
      ? (ts - startTimeStamp) / 1000 / 60
      : (ts - startTimeStamp) / 1000;
    const IntervalIndex =  _isMoreThanOneHundredSec
      ? Math.ceil(timeSinceStart / (secPerInterval.value / 60))
      : Math.ceil(timeSinceStart / secPerInterval.value)
    return _isMoreThanOneHundredSec
      ? IntervalIndex * (secPerInterval.value / 60)
      : IntervalIndex * secPerInterval.value
  }

  events.forEach((event) => {
    const interval = getIntervalFor(event.clickTimestamp)
    if (!groupedData[interval]) {
      groupedData[interval] = { interval, open: 0, openBlank: 0, openSave:0 , flag: 0,doubleClick: 0, efficiencySum: 0, efficiencyCount: 0, efficiencyAvg: null };
    }
    groupedData[interval][event.type] = (groupedData[interval][event.type] || 0) + 1;
  });

  efficiencyEvents.forEach(ev => {
    const interval = getIntervalFor(ev.clickTimestamp)
    if (!groupedData[interval]) {
      groupedData[interval] = { interval, open: 0, openBlank: 0, openSave:0 , flag: 0,doubleClick: 0, efficiencySum: 0, efficiencyCount: 0, efficiencyAvg: null };
    }
    groupedData[interval].efficiencySum += ev.score10
    groupedData[interval].efficiencyCount += 1
  })

  for (const k of Object.keys(groupedData)) {
    const g = groupedData[k]
    if (g.efficiencyCount) g.efficiencyAvg = +(g.efficiencySum / g.efficiencyCount).toFixed(1)
  }

  return Object.values(groupedData).sort((a, b) => a.interval - b.interval); // 按照时间刻度排序
}
</script>

<script>
export default {
  name: "OperationChart",
};
</script>
