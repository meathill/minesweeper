<script setup>
import {ref, toRefs, computed, watch} from 'vue';
import { useOperationRecordsStore } from './store/operationRecords';

const emit = defineEmits(['flag', 'open', 'openAll']);
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
});
const {count, isBomb} = toRefs(props);
const isOpen = ref(false);
const isFlag = ref(false);
const isUncovered = ref(false);
const mouseCount = ref(0);
const revealDelay = ref(0);
const operationStore = useOperationRecordsStore()
const isHintFlashing = ref(false)
let flashTimer = null

const probOverlayVisible = computed(() => {
  return props.showProbability && !isOpen.value && !isFlag.value && !isUncovered.value && props.probability != null
})
const probPercent = computed(() => props.probability != null ? Math.round(props.probability * 100) : null)
const probFraction = computed(() => {
  if (props.probability == null) return ''
  const p = props.probability
  const denoms = [2,3,4,6,8]
  for (const d of denoms) {
    const n = Math.round(p * d)
    if (Math.abs(n/d - p) < 0.015) return `${n}/${d}`
  }
  return `${probPercent.value}%`
})
function probColor(p) {
  // 0 绿  -> 0.5 黄 -> 1 红，均 75% alpha 叠加
  const alpha = 0.75
  // green #22c55e (34,197,94), yellow #eab308 (234,179,8), red #ef4444 (239,68,68)
  let r,g,b
  if (p <= 0.5) {
    const t = p / 0.5
    r = Math.round(34 + (234-34)*t)
    g = Math.round(197 + (179-197)*t)
    b = Math.round(94 + (8-94)*t)
  } else {
    const t = (p-0.5)/0.5
    r = Math.round(234 + (239-234)*t)
    g = Math.round(179 + (68-179)*t)
    b = Math.round(8 + (68-8)*t)
  }
  return `rgba(${r},${g},${b},${alpha})`
}
const probStyle = computed(() => {
  if (props.probability == null) return {}
  return { background: probColor(props.probability) }
})

const hintVisible = computed(() => {
  return props.isHint && !isOpen.value && !isFlag.value
})

// 监听 hint 触发闪动 3 次
watch(() => [props.isHint, props.hintFlashKey], ([isHint, key]) => {
  if (isHint && key != null) {
    isHintFlashing.value = false
    // 强制重绘以重启动画
    requestAnimationFrame(() => {
      isHintFlashing.value = true
      clearTimeout(flashTimer)
      flashTimer = setTimeout(() => {
        isHintFlashing.value = false
      }, 1800)
    })
  } else if (!isHint) {
    isHintFlashing.value = false
    clearTimeout(flashTimer)
  }
})

function onClick() {
  mouseCount.value = 0;
  open(true);
}
function getCellMeta() {
  if (props.cellIndex == null || props.columns == null) return {}
  return {
    index: props.cellIndex,
    row: Math.floor(props.cellIndex / props.columns),
    col: props.cellIndex % props.columns,
  }
}
function onRightClick(event) {
  mouseCount.value = 0;
  event.preventDefault();
  addFlag();
  operationStore.onUpdateOperateRecords('flag', getCellMeta())
}
function onDoubleClick() {
  mouseCount.value = 0;
  if (isOpen.value) {
    operationStore.onUpdateOperateRecords('doubleClick', getCellMeta())
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
  revealDelay.value = delayMs;
  isOpen.value = true;

  const meta = getCellMeta()
  if (isUserAction && !props.isBomb){
    operationStore.onUpdateOperateRecords(count.value === 0 ? 'openBlank' : 'open', meta);
  }
  operationStore.onUpdateOperateRecords('openSave', meta);

  emit('open', delayMs);
}
function addFlag(skipFlagged = false) {
  if (isOpen.value) {
    return;
  }
  if (skipFlagged && isFlag.value) return;
  isFlag.value = !isFlag.value;
  emit('flag', isFlag.value);
}
function reset() {
  isOpen.value = isFlag.value = isUncovered.value = false;
}
function uncover() {
  isUncovered.value = true;
}

defineExpose({
  open,
  reset,
  addFlag,
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
