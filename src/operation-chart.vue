<template>
  <div class="w-full max-w-4xl flex flex-col gap-3">
    <div class="h-96">
      <Line :options="chartOptions" :data="chartData" />
    </div>

    <!-- SVG 图例：4 项分工 + 打点方式 -->
    <div class="chart-legend-wrap rounded-lg border border-base-300 bg-base-100 p-3">
      <svg viewBox="0 0 640 56" class="w-full h-auto" role="img" :aria-label="t('chart.legendAria')">
        <!-- 标题 -->
        <text x="0" y="12" font-size="10" font-weight="600" fill="#64748b" letter-spacing="0.6">{{ t('chart.legendTitle') }}</text>
        <!-- 打开安全区 -->
        <g transform="translate(0,22)">
          <line x1="0" y1="10" x2="36" y2="10" stroke="#4bc0c0" stroke-width="3" stroke-linecap="round" />
          <circle cx="10" cy="10" r="4.5" fill="#4bc0c0" stroke="white" stroke-width="1.2"/>
          <circle cx="26" cy="10" r="4.5" fill="white" stroke="#4bc0c0" stroke-width="1.6"/>
          <text x="0" y="30" font-size="10.5" fill="#334155">{{ t('chart.openSafe') }}</text>
          <text x="0" y="42" font-size="8.5" fill="#94a3b8">6s {{ t('chart.bucket') }}</text>
        </g>
        <!-- 插旗 -->
        <g transform="translate(160,22)">
          <line x1="0" y1="10" x2="36" y2="10" stroke="#FF6B6B" stroke-width="3" stroke-linecap="round" />
          <circle cx="10" cy="10" r="4.5" fill="#FF6B6B" stroke="white" stroke-width="1.2"/>
          <circle cx="26" cy="10" r="4.5" fill="white" stroke="#FF6B6B" stroke-width="1.6"/>
          <text x="0" y="30" font-size="10.5" fill="#334155">{{ t('chart.flag') }}</text>
          <text x="0" y="42" font-size="8.5" fill="#94a3b8">6s {{ t('chart.bucket') }}</text>
        </g>
        <!-- 决策效率：散点 + 变色 -->
        <g transform="translate(320,22)">
          <line x1="0" y1="10" x2="36" y2="10" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
          <circle cx="6" cy="10" r="4" fill="#ef4444" stroke="white" stroke-width="1"/>
          <circle cx="18" cy="10" r="4" fill="#f59e0b" stroke="white" stroke-width="1"/>
          <circle cx="30" cy="10" r="4.5" fill="#22c55e" stroke="white" stroke-width="1.2"/>
          <text x="0" y="30" font-size="10.5" fill="#334155">{{ t('chart.efficiency') }}</text>
          <text x="0" y="42" font-size="8.5" fill="#94a3b8">{{ t('chart.legendExact') }}</text>
        </g>
        <!-- 地雷概率：紫三角虚线 -->
        <g transform="translate(480,22)">
          <line x1="0" y1="10" x2="36" y2="10" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 4"/>
          <polygon points="10,4 6,12 14,12" fill="#a855f7" stroke="white" stroke-width="0.8"/>
          <polygon points="26,4 22,12 30,12" fill="white" stroke="#a855f7" stroke-width="1.4"/>
          <text x="0" y="30" font-size="10.5" fill="#334155">{{ t('chart.mineProb') }}</text>
          <text x="0" y="42" font-size="8.5" fill="#94a3b8">{{ t('chart.legendExact') }} · ×10</text>
        </g>
      </svg>
      <!-- 第二行：左右轴说明 + 点可点击提示 -->
      <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-none text-slate-500 mt-1">
        <span class="inline-flex items-center gap-1"><i class="w-2 h-2 rounded-full bg-slate-400 inline-block"></i>{{ t('chart.legendLeftAxis') }}</span>
        <span class="inline-flex items-center gap-1"><i class="w-2 h-2 rounded-full bg-amber-500 inline-block"></i>{{ t('chart.legendRightAxis') }}</span>
        <span class="ml-auto opacity-70">{{ t('chart.legendClickHint') }}</span>
      </div>
    </div>

    <!-- SVG 示例：如何一眼看出盲猜 -->
    <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <svg viewBox="0 0 640 120" class="w-full h-auto" role="img" :aria-label="t('chart.exampleAria')">
        <!-- 背景网格 -->
        <g stroke="#e2e8f0" stroke-width="0.7" opacity="0.9">
          <line x1="48" y1="18" x2="48" y2="92"/><line x1="48" y1="92" x2="592" y2="92"/>
          <line x1="48" y1="74" x2="592" y2="74" stroke-dasharray="2 4" opacity="0.5"/>
          <line x1="48" y1="56" x2="592" y2="56" stroke-dasharray="2 4" opacity="0.5"/>
          <line x1="48" y1="38" x2="592" y2="38" stroke-dasharray="2 4" opacity="0.5"/>
          <line x1="48" y1="18" x2="592" y2="18" opacity="0.6"/>
        </g>
        <!-- Y 轴标签 -->
        <text x="6" y="22" font-size="7" fill="#64748b">10</text>
        <text x="10" y="95" font-size="7" fill="#64748b">0</text>
        <text x="596" y="22" font-size="7" fill="#a855f7">100%</text>
        <text x="598" y="95" font-size="7" fill="#a855f7">0%</text>
        <!-- X 轴标签 -->
        <text x="46" y="106" font-size="7" fill="#64748b">0:00</text>
        <text x="280" y="106" font-size="7" fill="#64748b">0:30</text>
        <text x="542" y="106" font-size="7" fill="#64748b">1:00</text>
        <!-- RPM 背景线（淡） -->
        <polyline fill="none" stroke="#4bc0c0" stroke-width="1.6" stroke-linecap="round" opacity="0.35"
          points="52,78 120,46 200,62 320,68 440,64 520,60 588,78"/>
        <polyline fill="none" stroke="#FF6B6B" stroke-width="1.6" stroke-linecap="round" opacity="0.35"
          points="52,88 120,78 200,82 320,76 440,62 520,78 588,88"/>
        <!-- 效率橙线（实线）带低谷 -->
        <polyline fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
          points="60,30 140,30 210,30 290,34 360,30 430,30 470,38 520,66 588,62"/>
        <!-- 效率点：变色 -->
        <circle cx="60" cy="30" r="4" fill="#22c55e" stroke="white" stroke-width="1"/>
        <circle cx="140" cy="30" r="4" fill="#22c55e" stroke="white" stroke-width="1"/>
        <circle cx="210" cy="30" r="4" fill="#22c55e" stroke="white" stroke-width="1"/>
        <circle cx="290" cy="34" r="4" fill="#f59e0b" stroke="white" stroke-width="1"/>
        <circle cx="360" cy="30" r="4" fill="#22c55e" stroke="white" stroke-width="1"/>
        <circle cx="430" cy="30" r="4" fill="#22c55e" stroke="white" stroke-width="1"/>
        <circle cx="470" cy="38" r="4.5" fill="#f59e0b" stroke="white" stroke-width="1"/>
        <circle cx="520" cy="66" r="5.5" fill="#ef4444" stroke="white" stroke-width="1.3"/>
        <circle cx="588" cy="62" r="4" fill="#ef4444" stroke="white" stroke-width="1"/>
        <!-- 地雷概率紫三角虚线 -->
        <polyline fill="none" stroke="#a855f7" stroke-width="1.7" stroke-dasharray="6 4" opacity="0.95"
          points="60,78 140,74 210,76 290,56 360,30 430,36 470,50 520,28 588,68"/>
        <polygon points="290,52 286,60 294,60" fill="#a855f7"/>
        <polygon points="360,26 356,34 364,34" fill="#a855f7"/>
        <polygon points="520,24 515,33 525,33" fill="#a855f7" stroke="#7c3aed" stroke-width="0.6"/>
        <!-- 低谷高风险标注 -->
        <g transform="translate(500,66)">
          <rect x="-46" y="-36" width="92" height="22" rx="6" fill="#fef3c7" stroke="#f59e0b" stroke-width="0.9"/>
          <text x="0" y="-22" font-size="7.5" font-weight="700" fill="#92400e" text-anchor="middle">{{ t('chart.exampleBad') }}</text>
          <line x1="0" y1="-14" x2="20" y2="8" stroke="#f59e0b" stroke-width="0.9" marker-end="url(#arrowAmber)"/>
        </g>
        <defs><marker id="arrowAmber" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#f59e0b"/></marker></defs>
        <!-- 右侧说明 -->
        <text x="600" y="56" font-size="6.5" fill="#7c3aed" text-anchor="end">{{ t('chart.exampleProbHigh') }}</text>
        <text x="600" y="64" font-size="6.5" fill="#b45309" text-anchor="end">{{ t('chart.exampleEffLow') }}</text>
      </svg>
      <p class="text-[11px] leading-4 text-amber-900/80 mt-2">{{ t('chart.exampleCaption') }}</p>
    </div>

    <div v-if="selectedDetail" class="flex flex-wrap items-center gap-2 text-sm bg-base-200 rounded px-3 py-2">
      <span class="font-semibold">{{ t('chart.selected') }}:</span>
      <span class="badge badge-sm" :class="selectedDetail.action==='flag'?'badge-error':'badge-info'">{{ selectedDetail.action }}</span>
      <span>{{ t('chart.cell') }} ({{ selectedDetail.row }}, {{ selectedDetail.col }}) #{{ selectedDetail.index }}</span>
      <span class="opacity-60">·</span>
      <span>{{ t('chart.efficiency') }} {{ selectedDetail.score10 }}/10</span>
      <span class="opacity-60">·</span>
      <span>{{ t('chart.mineProb') }} {{ (selectedDetail.prob*100).toFixed(1) }}%</span>
      <span class="opacity-60">·</span>
      <span>{{ formatTimeLabel(selectedDetail.timeSinceStartSec) }}</span>
      <button class="btn btn-xs btn-ghost ml-auto" @click="operationStore.clearSelection()">{{ t('chart.clearSelection') }}</button>
    </div>
    <div v-else class="text-xs opacity-60 text-center">{{ t('chart.clickHint') }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useI18n } from 'vue-i18n';
import { useOperationRecordsStore } from "./store/operationRecords.js";
import { Line } from "vue-chartjs";
const { t } = useI18n()
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
const operationEvents = operationStore.operationRecords.operationEvents;

const isMoreThanOneHundredSec = ref(false);
const secPerInterval = ref(6)
const operationEventsData = ref([]);
const efficiencyPerOp = ref([]);
const mineProbPerOp = ref([]);

function formatTimeLabel(sec) {
  const totalSec = Math.round(sec)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    return `${h}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }
  return `${m}:${String(s).padStart(2,'0')}`
}

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

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest', intersect: true },
  onClick(_evt, elements) {
    if (!elements || elements.length === 0) {
      operationStore.clearSelection()
      return
    }
    const el = elements[0]
    const ds = chartData.value.datasets[el.datasetIndex]
    const point = ds.data[el.index]
    if (point && point.index != null) {
      operationStore.selectOperation(point.index, point.clickTimestamp)
      // 滚动到棋盘
      const stage = document.getElementById('stage')
      if (stage) stage.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (point && point._effIndex != null) {
      const ev = operationStore.efficiencyEvents[point._effIndex]
      if (ev) operationStore.selectOperation(ev.index, ev.clickTimestamp)
    } else {
      operationStore.clearSelection()
    }
  },
  scales: {
    x: {
      type: "linear",
      title: {
        display: true,
        text: t('chart.time'),
      },
      min: 0,
      ticks: {
        stepSize: isMoreThanOneHundredSec.value ? (secPerInterval.value / 60) : secPerInterval.value,
        callback(value) {
          const isMin = isMoreThanOneHundredSec.value
          const totalSec = isMin ? value * 60 : value
          const m = Math.floor(totalSec / 60)
          const s = Math.round(totalSec % 60)
          if (m >= 60) {
            const h = Math.floor(m / 60)
            const mm = m % 60
            return `${h}:${String(mm).padStart(2,'0')}:${String(s).padStart(2,'0')}`
          }
          return `${m}:${String(s).padStart(2,'0')}`
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
      title: { display: true, text: t('chart.efficiencyAxis') },
      ticks: { stepSize: 1 },
    },
  },
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: true,
      text: t('chart.title'),
    },
    tooltip: {
      callbacks: {
        title(items) {
          if (!items.length) return ''
          const x = items[0].parsed.x
          const isMin = isMoreThanOneHundredSec.value
          const sec = isMin ? x * 60 : x
          return formatTimeLabel(sec)
        },
        label: (ctx) => {
          const v = ctx.parsed.y
          const raw = ctx.raw
          if (ctx.dataset.yAxisID === 'y1') {
            if (ctx.dataset.label === t('chart.mineProb')) {
              const pct = raw.prob != null ? (raw.prob * 100).toFixed(1) + '%' : (v*10).toFixed(1)+'%'
              const coord = raw.row != null ? ` (#${raw.index} ${raw.row},${raw.col})` : ''
              return `${ctx.dataset.label}: ${pct}${coord}`
            }
            // efficiency
            const coord = raw.row != null ? ` (#${raw.index} ${raw.row},${raw.col} ${raw.action})` : ''
            const probStr = raw.prob != null ? ` prob ${(raw.prob*100).toFixed(1)}%` : ''
            return `${ctx.dataset.label}: ${v?.toFixed ? v.toFixed(1) : v} /10${probStr}${coord}`
          }
          return `${ctx.dataset.label}: ${v}`
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
      borderColor: "#4bc0c0",
      backgroundColor: "rgba(75,192,192,0.15)",
      yAxisID: 'y',
      data: operationEventsData.value.map((item) => ({ x: item.interval, y: item.openSave })),
      pointRadius: 4,
      tension: 0.1,
      borderWidth: 2,
    },
    {
      label: t('chart.flag'),
      borderColor: "#FF6B6B",
      backgroundColor: "rgba(255,107,107,0.15)",
      yAxisID: 'y',
      data: operationEventsData.value.map((item) => ({ x: item.interval, y: item.flag })),
      pointRadius: 4,
      tension: 0.1,
      borderWidth: 2,
    },
    {
      label: t('chart.efficiency'),
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245,158,11,0.9)",
      yAxisID: 'y1',
      data: efficiencyPerOp.value,
      pointRadius: (ctx) => {
        const raw = ctx.raw
        if (raw && operationStore.selectedIndex === raw.index && operationStore.selectedTimestamp === raw.clickTimestamp) return 8
        return 5
      },
      pointHoverRadius: 7,
      showLine: true,
      tension: 0.2,
      borderWidth: 2,
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
      pointHoverRadius: 6,
      showLine: true,
      tension: 0.2,
      borderWidth: 2,
      borderDash: [6, 3],
      pointStyle: 'triangle',
    },
  ],
}));

onMounted(() => {
  const { buckets, effPoints, probPoints } = transferEventsToData(operationEvents, operationStore.efficiencyEvents);
  operationEventsData.value = buckets
  efficiencyPerOp.value = effPoints
  mineProbPerOp.value = probPoints
});

function transferEventsToData(events, efficiencyEvents = []) {
  const start = operationStore.operationRecords.startTimeStamp
  const allTimestamps = [...events.map(e => e.clickTimestamp), ...efficiencyEvents.map(e => e.clickTimestamp)]
  const maxTimestamp = allTimestamps.length ? Math.max(...allTimestamps) : Date.now()
  const totalSeconds = (maxTimestamp - start) / 1000;
  const _isMoreThanOneHundredSec = totalSeconds > 100;
  isMoreThanOneHundredSec.value = totalSeconds > 100;
  
  // --- RPM 仍按 6s 分桶聚合（背景节奏） ---
  const groupedData = {};
  groupedData[0] = { interval: 0, open: 0, openBlank: 0, openSave:0 ,flag: 0, doubleClick: 0 };

  function getIntervalFor(ts) {
    const timeSinceStart = _isMoreThanOneHundredSec
      ? (ts - start) / 1000 / 60
      : (ts - start) / 1000;
    const IntervalIndex =  _isMoreThanOneHundredSec
      ? Math.ceil(timeSinceStart / (secPerInterval.value / 60))
      : Math.ceil(timeSinceStart / secPerInterval.value)
    return _isMoreThanOneHundredSec
      ? IntervalIndex * (secPerInterval.value / 60)
      : IntervalIndex * secPerInterval.value
  }
  function getXForSec(sec) {
    return _isMoreThanOneHundredSec ? sec / 60 : sec
  }

  events.forEach((event) => {
    const interval = getIntervalFor(event.clickTimestamp)
    if (!groupedData[interval]) {
      groupedData[interval] = { interval, open: 0, openBlank: 0, openSave:0 , flag: 0,doubleClick: 0 };
    }
    groupedData[interval][event.type] = (groupedData[interval][event.type] || 0) + 1;
  });

  const buckets = Object.values(groupedData).sort((a, b) => a.interval - b.interval);

  // --- 逐操作精确点：效率与地雷概率 x 为真实时刻 ---
  const effPoints = efficiencyEvents.map((ev, idx) => {
    const sec = ev.timeSinceStartSec ?? (ev.clickTimestamp - start) / 1000
    return {
      x: getXForSec(sec),
      y: ev.score10,
      index: ev.index,
      row: ev.row,
      col: ev.col,
      prob: ev.prob,
      pBest: ev.pBest,
      action: ev.action,
      clickTimestamp: ev.clickTimestamp,
      _effIndex: idx,
    }
  }).sort((a,b)=>a.x-b.x)

  const probPoints = efficiencyEvents
    .filter(ev => ev.action === 'open' || ev.action === 'chord')
    // chord 的 prob 是平均概率，仍有对比价值，保留；若只想看 open 可去掉 chord
    .map(ev => {
      const sec = ev.timeSinceStartSec ?? (ev.clickTimestamp - start) / 1000
      return {
        x: getXForSec(sec),
        y: Math.round(ev.prob * 100) / 10, // 0-10 同轴，tooltip 显示 %
        index: ev.index,
        row: ev.row,
        col: ev.col,
        prob: ev.prob,
        action: ev.action,
        clickTimestamp: ev.clickTimestamp,
      }
    }).sort((a,b)=>a.x-b.x)

  return { buckets, effPoints, probPoints };
}
</script>

<script>
export default {
  name: "OperationChart",
};
</script>
