<script setup>
import { ref, toRefs, computed, watch } from 'vue';
import { useOperationRecordsStore } from './store/operationRecords';

const emit = defineEmits(['markState', 'open', 'openAll']);
const props = defineProps({
  count: Number,
  isBomb: Boolean,
  isStart: Boolean,
  probability: Number,
  showProbability: Boolean,
  showPercent: Boolean,
  showFraction: Boolean,
  isHint: Boolean,
  hintFlashKey: Number,
  cellIndex: Number,
  columns: Number,
  isSelected: Boolean,
  flagable: Boolean, // 剩余旗数是否充足；不足时右键只能在 无↔❓ 间循环
});
const { count, isBomb } = toRefs(props);
const isOpen = ref(false);
const isUncovered = ref(false);
const markState = ref('none'); // 'none' | 'flag' | 'question'，经典扫雷右键三态
const isFlag = computed(() => markState.value === 'flag');
const isQuestion = computed(() => markState.value === 'question');
const mouseCount = ref(0);
const revealDelay = ref(0);
const operationStore = useOperationRecordsStore();
const isHintFlashing = ref(false);
let flashTimer = null;

const probOverlayVisible = computed(() => {
  return (
    props.showProbability &&
    !isOpen.value &&
    !isFlag.value &&
    !isUncovered.value &&
    props.probability != null
  );
});
const probPercent = computed(() =>
  props.probability != null ? Math.round(props.probability * 100) : null,
);
const probFraction = computed(() => {
  if (props.probability == null) return '';
  const p = props.probability;
  const denoms = [2, 3, 4, 6, 8];
  for (const d of denoms) {
    const n = Math.round(p * d);
    if (Math.abs(n / d - p) < 0.015) return `${n}/${d}`;
  }
  return `${probPercent.value}%`;
});
function probColor(p) {
  // 0 绿  -> 0.5 黄 -> 1 红，均 75% alpha 叠加
  const alpha = 0.75;
  // green #22c55e (34,197,94), yellow #eab308 (234,179,8), red #ef4444 (239,68,68)
  let r, g, b;
  if (p <= 0.5) {
    const t = p / 0.5;
    r = Math.round(34 + (234 - 34) * t);
    g = Math.round(197 + (179 - 197) * t);
    b = Math.round(94 + (8 - 94) * t);
  } else {
    const t = (p - 0.5) / 0.5;
    r = Math.round(234 + (239 - 234) * t);
    g = Math.round(179 + (68 - 179) * t);
    b = Math.round(8 + (68 - 8) * t);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}
const probStyle = computed(() => {
  if (props.probability == null) return {};
  return { background: probColor(props.probability) };
});

const hintVisible = computed(() => {
  return props.isHint && !isOpen.value && !isFlag.value;
});

// 监听 hint 触发闪动 3 次
watch(
  () => [props.isHint, props.hintFlashKey],
  ([isHint, key]) => {
    if (isHint && key != null) {
      isHintFlashing.value = false;
      // 强制重绘以重启动画
      requestAnimationFrame(() => {
        isHintFlashing.value = true;
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          isHintFlashing.value = false;
        }, 1800);
      });
    } else if (!isHint) {
      isHintFlashing.value = false;
      clearTimeout(flashTimer);
    }
  },
);

function onClick() {
  mouseCount.value = 0;
  open(true);
}
function getCellMeta() {
  if (props.cellIndex == null || props.columns == null) return {};
  return {
    index: props.cellIndex,
    row: Math.floor(props.cellIndex / props.columns),
    col: props.cellIndex % props.columns,
  };
}
function onRightClick(event) {
  mouseCount.value = 0;
  event.preventDefault();
  cycleMarkState();
  operationStore.onUpdateOperateRecords('flag', {
    ...getCellMeta(),
    flagState: markState.value,
  });
}
// 右键三态循环：无 → 🚩 → ❓ → 无；旗数不足时跳过插旗（经典行为：问号不占旗数）
function cycleMarkState() {
  if (isOpen.value) {
    return;
  }
  if (markState.value === 'none') {
    markState.value = props.flagable ? 'flag' : 'question';
  } else if (markState.value === 'flag') {
    markState.value = 'question';
  } else {
    markState.value = 'none';
  }
  emit('markState', markState.value);
}
function onDoubleClick() {
  mouseCount.value = 0;
  if (isOpen.value) {
    operationStore.onUpdateOperateRecords('doubleClick', getCellMeta());
    emit('openAll');
  }
}
function onMouseDown(event) {
  mouseCount.value += event.button;
  if (mouseCount.value === 2) {
    onDoubleClick();
  }
}
function onMouseUp() {
  mouseCount.value = 0;
}
function open(isUserAction = false, delayMs = 0) {
  if (isOpen.value || isFlag.value) {
    return;
  }
  markState.value = 'none'; // 问号格允许直接左键打开（经典行为）
  revealDelay.value = delayMs;
  isOpen.value = true;

  const meta = getCellMeta();
  if (isUserAction && !props.isBomb) {
    operationStore.onUpdateOperateRecords(
      count.value === 0 ? 'openBlank' : 'open',
      meta,
    );
  }
  operationStore.onUpdateOperateRecords('openSave', meta);

  emit('open', delayMs);
}
// 胜利结算时把未开格统一标为旗（不影响已开格）
function markAsFlag() {
  if (isOpen.value) {
    return;
  }
  markState.value = 'flag';
}
function reset() {
  isOpen.value = isUncovered.value = false;
  markState.value = 'none';
  revealDelay.value = 0;
}
// 回放恢复：棋盘完整回到快照时刻的状态
function restore({
  isOpen: openVal,
  isFlag: flagVal,
  isQuestion: questionVal,
}) {
  isOpen.value = openVal;
  markState.value = flagVal ? 'flag' : questionVal ? 'question' : 'none';
  isUncovered.value = false;
  revealDelay.value = 0;
}
function uncover() {
  isUncovered.value = true;
}

defineExpose({
  open,
  reset,
  markAsFlag,
  restore,
  uncover,

  isFlag,
});
</script>

<script>
export default {
  name: 'GridItem',
}
</script>

<template>
<div
  class="grid-item"
  :class="[
    {'open bg-base-200 dark:bg-base-100': isOpen, 'bg-base-300': !isOpen, 'wrong-mark': !isBomb && isFlag && isUncovered, 'ring-2 ring-warning ring-offset-1 z-10': isSelected},
    'count-' + count
  ]"
  :style="{ animationDelay: revealDelay + 'ms' }"
  @click="onClick"
  @contextmenu="onRightClick"
  @dblclick="onDoubleClick"
  @mousedown="onMouseDown"
  @mouseup="onMouseUp"
>
  <template v-if="isFlag">🚩</template>
  <template v-else-if="isQuestion"><span class="question-mark">?</span></template>
  <template v-else-if="isOpen">
    <template v-if="isBomb">💥</template>
    <template v-else>{{count ? count : ''}}</template>
  </template>
  <template v-else-if="isUncovered && isBomb">💣</template>
  <div v-if="probOverlayVisible" class="prob-overlay" :style="probStyle">
    <template v-if="showPercent || showFraction">
      <span v-if="showPercent" class="prob-text">{{probPercent}}%</span>
      <span v-if="showPercent && showFraction" class="prob-sep"> </span>
      <span v-if="showFraction" class="prob-text">{{probFraction}}</span>
    </template>
  </div>
  <div v-if="hintVisible" class="hint-overlay" :class="{'hint-flash': isHintFlashing}">🎯</div>
</div>
</template>
