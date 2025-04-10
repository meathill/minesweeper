<script setup>
import {ref, toRefs} from 'vue';

const emit = defineEmits(['flag', 'onOpen', 'openAll']);
const props = defineProps({
  count: Number,
  isBomb: Boolean,
  isStart: Boolean,
});
const {count, isBomb} = toRefs(props);
const isOpen = ref(false);
const isFlag = ref(false);
const isUncovered = ref(false);
const mouseCount = ref(0);

function onClick() {
  mouseCount.value = 0;
  onOpen();
}
function onRightClick(event) {
  mouseCount.value = 0;
  event.preventDefault();
  addFlag();
}
function onDoubleClick() {
  mouseCount.value = 0;
  if (isOpen.value) {
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
function open() {
  if (isOpen.value || isFlag.value) {
    return;
  }
  isOpen.value = true;
}
function onOpen(){
  open()
  emit('onOpen')
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
    {'open bg-base-200 dark:bg-base-100': isOpen, 'bg-base-300': !isOpen, 'wrong-mark': !isBomb && isFlag && isUncovered},
    'count-' + count
  ]"
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
</div>
</template>
