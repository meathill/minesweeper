<template>
  <div class="chart-legend-wrap rounded-lg border border-base-300 bg-base-100 p-3">
    <svg viewBox="0 0 640 56" class="w-full h-auto" role="img" :aria-label="t('chart.legendAria')">
      <!-- 标题 -->
      <text x="0" y="12" font-size="10" font-weight="600" fill="#64748b" letter-spacing="0.6">{{ t('chart.legendTitle') }}</text>
      <!-- 打开安全区：区域 -->
      <g transform="translate(0,22)">
        <rect x="0" y="3" width="36" height="14" fill="#4bc0c0" opacity="0.18"/>
        <line x1="0" y1="3" x2="36" y2="3" stroke="#4bc0c0" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="8" cy="3" r="2.2" fill="#4bc0c0"/>
        <circle cx="16" cy="3" r="2.2" fill="#4bc0c0"/>
        <circle cx="24" cy="3" r="2.2" fill="#4bc0c0"/>
        <circle cx="32" cy="3" r="2.2" fill="#4bc0c0"/>
        <text x="0" y="30" font-size="10.5" fill="#334155">{{ t('chart.openSafe') }}</text>
        <text x="0" y="42" font-size="8.2" fill="#94a3b8">6s {{ t('chart.bucket') }} {{ t('chart.legendArea') }} + {{ t('chart.legendExact') }}·</text>
      </g>
      <!-- 插旗：区域 -->
      <g transform="translate(160,22)">
        <rect x="0" y="3" width="36" height="14" fill="#FF6B6B" opacity="0.15"/>
        <line x1="0" y1="3" x2="36" y2="3" stroke="#FF6B6B" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="6" y="0" width="5" height="5" rx="0.8" fill="#FF6B6B" transform="rotate(45 8.5 2.5)"/>
        <rect x="14" y="0" width="5" height="5" rx="0.8" fill="#FF6B6B" transform="rotate(45 16.5 2.5)"/>
        <rect x="22" y="0" width="5" height="5" rx="0.8" fill="#FF6B6B" transform="rotate(45 24.5 2.5)"/>
        <rect x="30" y="0" width="5" height="5" rx="0.8" fill="#FF6B6B" transform="rotate(45 32.5 2.5)"/>
        <text x="0" y="30" font-size="10.5" fill="#334155">{{ t('chart.flag') }}</text>
        <text x="0" y="42" font-size="8.2" fill="#94a3b8">6s {{ t('chart.bucket') }} {{ t('chart.legendArea') }} + {{ t('chart.legendExact') }}◆</text>
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
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<script>
export default {
  name: 'ChartLegend',
};
</script>
