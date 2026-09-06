<template>
  <div class="w-full max-w-4xl flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">{{ t('chart.title') }}</h3>
      <button class="btn btn-outline btn-xs" @click="emit('download')">{{ t('chart.download') }}</button>
    </div>
    <div class="h-96">
      <Line :options="chartOptions" :data="chartData" />
    </div>

    <!-- 时间窗口滑块：缩放到分钟级精细查看 -->
    <time-range-slider v-if="totalSeconds > 30" v-model="windowSec" :min="0" :max="Math.ceil(totalSeconds)" />

    <!-- SVG 图例：2 区域 + 2 折线分工 -->
    <chart-legend />

    <!-- 备用列表：点不动时可直接点列表回溯 -->
    <div v-if="lowScoreOps.length" class="rounded-lg border border-base-300 bg-base-100 p-3">
      <div class="text-xs font-semibold text-slate-600 mb-2">{{ t('chart.lowScoreList') }}</div>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="op in lowScoreOps" :key="op.clickTimestamp"
          class="btn btn-xs"
          :class="operationStore.selectedTimestamp===op.clickTimestamp ? 'btn-warning' : 'btn-outline'"
          @click="replayTo(op.clickTimestamp, op.index)">
          #{{ op.index }} ({{ op.row }},{{ op.col }}) {{ op.score10 }}/10 · {{ (op.prob*100).toFixed(0) }}%
          <span class="opacity-60">{{ formatTimeLabel(op.timeSinceStartSec) }}</span>
        </button>
      </div>
      <div class="text-[11px] text-slate-400 mt-1">{{ t('chart.lowScoreHint') }}</div>
    </div>

    <div v-if="selectedDetail" class="flex flex-wrap items-center gap-2 text-sm bg-warning/10 border border-warning/30 rounded px-3 py-2">
      <span class="font-semibold">⏪ {{ t('chart.replayed') }}</span>
      <span class="badge badge-sm" :class="selectedDetail.action==='flag'?'badge-error':'badge-info'">{{ selectedDetail.action }}</span>
      <span>{{ t('chart.cell') }} ({{ selectedDetail.row }}, {{ selectedDetail.col }}) #{{ selectedDetail.index }}</span>
      <span class="opacity-60">·</span>
      <span>{{ t('chart.efficiency') }} {{ selectedDetail.score10 }}/10</span>
      <span class="opacity-60">·</span>
      <span>{{ t('chart.mineProb') }} {{ (selectedDetail.prob*100).toFixed(1) }}%</span>
      <span class="opacity-60">·</span>
      <span>{{ formatTimeLabel(selectedDetail.timeSinceStartSec) }}</span>
      <button class="btn btn-xs btn-ghost ml-auto" @click="backToFinal">{{ t('chart.backToFinal') }}</button>
    </div>
    <div v-else class="text-xs opacity-60 text-center">{{ t('chart.clickHint') }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useI18n } from 'vue-i18n';
import { useOperationRecordsStore } from "./store/operationRecords.js";
import { Line } from "vue-chartjs";
import TimeRangeSlider from "./time-range-slider.vue";
import ChartLegend from "./chart-legend.vue";
import { transferEventsToData, formatTimeLabel } from "./chart-data.js";
const { t } = useI18n()
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const emit = defineEmits(['replay', 'download']);

const operationStore = useOperationRecordsStore();
const operationEvents = operationStore.operationRecords.operationEvents;

// 桶计数换算 RPM：桶宽 6s，×60/6
const RPM_FACTOR = 10;
const totalSeconds = ref(0);
const isMinuteScale = ref(false);
const windowSec = ref([0, 0]); // 当前查看的时间窗口（秒）
const operationEventsData = ref([]);
const efficiencyPerOp = ref([]);
const mineProbPerOp = ref([]);
const flagPerOp = ref([]);
const openPerOp = ref([]);

const lowScoreOps = computed(() => {
  return [...operationStore.efficiencyEvents]
    .filter(e => e.score10 < 9)
    .sort((a,b)=>a.score10 - b.score10 || a.timeSinceStartSec - b.timeSinceStartSec)
    .slice(0, 8)
})
const selectedDetail = computed(() => {
  const idx = operationStore.selectedIndex
  if (idx == null) return null
  const ts = operationStore.selectedTimestamp
  // 找到最近的 efficiency 事件
  const ev = operationStore.efficiencyEvents.find(e => e.index === idx && (ts == null || e.clickTimestamp === ts))
    || operationStore.efficiencyEvents.find(e => e.index === idx)
  if (!ev) {
    // 可能是 flag 但没有效率？尝试从 operationEvents 找
    const op = operationEvents.find(e => e.index === idx)
    if (!op) return null
    return { index: idx, row: op.row ?? '?', col: op.col ?? '?', action: op.type, score10: '-', prob: 0, timeSinceStartSec: op.timeSinceStartSec ?? 0 }
  }
  return ev
})

// 回放到某个时刻：取 ≤ 时间戳的最近快照，通知父组件恢复棋盘
function replayTo(timestamp, cellIndex = null) {
  const snap = operationStore.findSnapshotAt(timestamp)
  if (!snap) return
  if (cellIndex != null) operationStore.selectOperation(cellIndex, timestamp)
  else operationStore.clearSelection()
  emit('replay', snap)
  const stage = document.getElementById('stage')
  if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
function backToFinal() {
  operationStore.clearSelection()
  const final = operationStore.findFinalSnapshot()
  if (final) emit('replay', final)
  const stage = document.getElementById('stage')
  if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// x 轴刻度随窗口宽度自适应细化
const TICK_STEPS_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const xMin = computed(() => (isMinuteScale.value ? windowSec.value[0] / 60 : windowSec.value[0]));
const xMax = computed(() => (isMinuteScale.value ? windowSec.value[1] / 60 : windowSec.value[1]));
const tickStep = computed(() => {
  const widthSec = Math.max(windowSec.value[1] - windowSec.value[0], 1)
  const step = TICK_STEPS_SEC.find((s) => s >= widthSec / 10) ?? 600
  return isMinuteScale.value ? step / 60 : step
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 8, right: 6, bottom: 2, left: 2 } },
  interaction: { mode: 'nearest', intersect: false },
  onClick(_evt, elements, chart) {
    // 兼容 Chart.js 4：elements 可能为空，改用 chart.getElementsAtEventForMode
    let hits = elements
    if ((!hits || hits.length === 0) && chart && _evt) {
      try { hits = chart.getElementsAtEventForMode(_evt, 'nearest', { intersect: false }, false) || [] } catch(e) { hits = [] }
    }
    if (!hits || hits.length === 0) {
      backToFinal()
      return
    }
    const el = hits[0]
    const point = chartData.value.datasets[el.datasetIndex].data[el.index]
    if (point && point.clickTimestamp != null) {
      replayTo(point.clickTimestamp, point.index)
    } else {
      backToFinal()
    }
  },
  scales: {
    x: {
      type: "linear",
      title: {
        display: true,
        text: isMinuteScale.value ? t('chart.timeMinutes') : t('chart.time'),
      },
      min: xMin.value,
      max: xMax.value,
      ticks: {
        maxTicksLimit: 14,
        stepSize: tickStep.value,
        callback(value) {
          const sec = isMinuteScale.value ? value * 60 : value
          return formatTimeLabel(sec)
        },
      },
    },
    y: {
      type: 'linear',
      position: 'left',
      title: {
        display: true,
        text: t('chart.rpm'),
      },
      min: 0,
      suggestedMax: 60,
      ticks: {
        stepSize: 10,
        beginAtZero: true,
      },
    },
    y1: {
      type: 'linear',
      position: 'right',
      min: 0,
      max: 10.6,
      grid: { drawOnChartArea: false },
      title: { display: true, text: t('chart.efficiencyAxis') },
      ticks: { stepSize: 1 },
    },
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        title(items) {
          if (!items.length) return ''
          const x = items[0].parsed.x
          const sec = isMinuteScale.value ? x * 60 : x
          return formatTimeLabel(sec)
        },
        label: (ctx) => {
          const v = ctx.parsed.y
          const raw = ctx.raw
          const coord = raw.row != null ? ` (#${raw.index} ${raw.row},${raw.col})` : (raw.index != null ? ` #${raw.index}` : '')
          if (ctx.dataset.yAxisID === 'y1') {
            if (ctx.dataset.label === t('chart.mineProb')) {
              const pct = raw.prob != null ? (raw.prob * 100).toFixed(1) + '%' : (v*10).toFixed(1)+'%'
              return `${ctx.dataset.label}: ${pct}${coord}`
            }
            // efficiency: y 已抖动，显示原始分
            const score = raw._y0 != null ? raw._y0 : v
            const probStr = raw.prob != null ? ` prob ${(raw.prob*100).toFixed(1)}%` : ''
            return `${ctx.dataset.label}: ${score?.toFixed ? score.toFixed(1) : score} /10${probStr}${coord}`
          }
          // 左轴：RPM 区域 + 精确点散点
          if (raw.index != null) {
            const state = raw.flagState ? ` (${raw.flagState})` : ''
            return `${ctx.dataset.label}: ${coord.trim()}${state}`
          }
          return `${ctx.dataset.label}: ${v} RPM`
        },
        afterLabel: (ctx) => {
          const raw = ctx.raw
          if (raw && raw.action) return `  action: ${raw.action}`
          return ''
        }
      }
    }
  },
  animation: {
    duration: 250,
    easing: "ease-out",
  },
}));

const chartData = computed(() => ({
  datasets: [
    {
      label: t('chart.openSafe'),
      borderColor: "rgba(75,192,192,0.75)",
      backgroundColor: "rgba(75,192,192,0.16)",
      fill: 'origin',
      yAxisID: 'y',
      data: operationEventsData.value.map((item) => ({ x: item.interval, y: item.openSave * RPM_FACTOR })),
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.15,
      borderWidth: 2,
      order: 3,
    },
    {
      label: t('chart.flag'),
      borderColor: "rgba(255,107,107,0.75)",
      backgroundColor: "rgba(255,107,107,0.13)",
      fill: 'origin',
      yAxisID: 'y',
      data: operationEventsData.value.map((item) => ({ x: item.interval, y: item.flag * RPM_FACTOR })),
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.15,
      borderWidth: 2,
      order: 3,
    },
    {
      label: t('chart.openExact'),
      borderColor: "rgba(75,192,192,0)",
      backgroundColor: "#4bc0c0",
      yAxisID: 'y',
      data: openPerOp.value,
      pointRadius: 3.5,
      pointHoverRadius: 6,
      pointHitRadius: 10,
      showLine: false,
      pointStyle: 'circle',
      order: 1,
    },
    {
      label: t('chart.flagExact'),
      borderColor: "rgba(255,107,107,0)",
      backgroundColor: "#FF6B6B",
      yAxisID: 'y',
      data: flagPerOp.value,
      pointRadius: 3.5,
      pointHoverRadius: 6,
      pointHitRadius: 10,
      showLine: false,
      pointStyle: 'rectRot',
      order: 1,
    },
    {
      label: t('chart.efficiency'),
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245,158,11,0.9)",
      yAxisID: 'y1',
      data: efficiencyPerOp.value,
      pointRadius: (ctx) => {
        const raw = ctx.raw
        if (raw && operationStore.selectedIndex === raw.index && operationStore.selectedTimestamp === raw.clickTimestamp) return 9
        return 5
      },
      pointHoverRadius: 8,
      pointHitRadius: 12,
      showLine: true,
      tension: 0.2,
      borderWidth: 2,
      order: 0,
      pointBackgroundColor: (ctx) => {
        const raw = ctx.raw
        if (!raw) return "rgba(245,158,11,0.9)"
        if (raw.score10 < 6) return "#ef4444"
        if (raw.score10 < 9) return "#f59e0b"
        return "#22c55e"
      },
    },
    {
      label: t('chart.mineProb'),
      borderColor: "#a855f7",
      backgroundColor: "rgba(168,85,247,0.15)",
      yAxisID: 'y1',
      data: mineProbPerOp.value,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointHitRadius: 12,
      showLine: true,
      tension: 0.2,
      borderWidth: 2,
      borderDash: [6, 3],
      pointStyle: 'triangle',
      order: 0,
    },
  ],
}));

onMounted(() => {
  const { buckets, effPoints, probPoints, flagPoints, openPoints, totalSeconds: total, isMinuteScale: minuteScale } =
    transferEventsToData({ events: operationEvents, efficiencyEvents: operationStore.efficiencyEvents, startTimeStamp: operationStore.operationRecords.startTimeStamp });
  operationEventsData.value = buckets
  efficiencyPerOp.value = effPoints
  mineProbPerOp.value = probPoints
  flagPerOp.value = flagPoints
  openPerOp.value = openPoints
  totalSeconds.value = Math.ceil(total)
  isMinuteScale.value = minuteScale
  windowSec.value = [0, Math.ceil(total)]
});
</script>

<script>
export default {
  name: "OperationChart",
};
</script>
