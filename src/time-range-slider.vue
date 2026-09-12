<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatTimeLabel } from './chart-data.js';

const { t } = useI18n();

const props = defineProps({
  min: { type: Number, default: 0 }, // 秒
  max: { type: Number, default: 100 }, // 秒
  step: { type: Number, default: 1 },
});
const model = defineModel({ type: Array, default: () => [0, 100] }); // [startSec, endSec]

function updateStart(event) {
  const value = Math.min(
    Number(event.target.value),
    model.value[1] - props.step,
  );
  model.value = [value, model.value[1]];
}
function updateEnd(event) {
  const value = Math.max(
    Number(event.target.value),
    model.value[0] + props.step,
  );
  model.value = [model.value[0], value];
}
function reset() {
  model.value = [props.min, props.max];
}
const isTruncated = computed(
  () => model.value[0] > props.min || model.value[1] < props.max,
);
const rangeStyle = computed(() => {
  const span = props.max - props.min || 1;
  const left = ((model.value[0] - props.min) / span) * 100;
  const width = ((model.value[1] - model.value[0]) / span) * 100;
  return { left: `${left}%`, width: `${width}%` };
});
// 两柄重叠在一端时，把对应 input 置顶以便再拖回
const startZ = computed(() =>
  model.value[0] >= props.max - props.step ? 3 : 1,
);
const endZ = computed(() => (model.value[1] <= props.min + props.step ? 3 : 1));
</script>

<template>
  <div class="flex items-center gap-2 w-full">
    <span class="text-[11px] font-mono text-slate-500 shrink-0 w-12 text-right">{{ formatTimeLabel(model[0]) }}</span>
    <div class="dual-range relative flex-1 h-6">
      <div class="absolute top-1/2 -translate-y-1/2 h-1.5 w-full bg-base-300 rounded-full pointer-events-none"></div>
      <div
        class="absolute top-1/2 -translate-y-1/2 h-1.5 bg-warning/50 rounded-full pointer-events-none"
        :style="rangeStyle"
      ></div>
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="model[0]"
        :style="{ zIndex: startZ }"
        aria-label="time window start"
        class="dual-range-input absolute inset-0 w-full m-0"
        @input="updateStart"
      />
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="model[1]"
        :style="{ zIndex: endZ }"
        aria-label="time window end"
        class="dual-range-input absolute inset-0 w-full m-0"
        @input="updateEnd"
      />
    </div>
    <span class="text-[11px] font-mono text-slate-500 shrink-0 w-12">{{ formatTimeLabel(model[1]) }}</span>
    <button v-if="isTruncated" class="btn btn-ghost btn-xs shrink-0" @click="reset">{{ t('chart.resetWindow') }}</button>
  </div>
</template>

<script>
export default {
  name: 'TimeRangeSlider',
};
</script>

<style scoped>
/* 双柄滑块：轨道事件穿透，只有手柄可拖 */
.dual-range input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  pointer-events: none;
  height: 1.5rem;
}
.dual-range input[type='range']::-webkit-slider-thumb {
  pointer-events: auto;
  -webkit-appearance: none;
  appearance: none;
  width: 0.9rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  background: #f59e0b;
  border: 1px solid #b45309;
  cursor: ew-resize;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
}
.dual-range input[type='range']::-moz-range-thumb {
  pointer-events: auto;
  width: 0.9rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  background: #f59e0b;
  border: 1px solid #b45309;
  cursor: ew-resize;
}
.dual-range input[type='range']::-moz-range-track {
  background: transparent;
}
</style>
