<script setup>
import {ref, toRefs} from 'vue';

const emit = defineEmits(['flag', 'open', 'openAll']);
const props = defineProps({
  count: Number,
  isBomb: Boolean,
  isStart: Boolean,
});
const {count, isBomb} = toRefs(props);
const isOpen = ref(false);
const isFlag = ref(false);

// TODO q3 这里有优化空间么？
function onClick() {
  open();
}
function onRightClick(event) {
  event.preventDefault();
  if (isOpen.value) {
    return;
  }
  isFlag.value = !isFlag.value;
  emit('flag', isFlag.value);
}
function onDoubleClick() {
  if (isOpen.value) {
    emit('openAll');
  }
}
function open() {
  if (isOpen.value || isFlag.value) {
    return;
  }
  isOpen.value = true;
  emit('open');
}
function reset() {
  isOpen.value = isFlag.value = false;
}

defineExpose({
  open,
  reset,

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
  :class="[{open: isOpen}, 'count-' + count]"
  @click="onClick"
  @contextmenu="onRightClick"
  @dblclick="onDoubleClick"
>
  <template v-if="isFlag">🚩</template>
  <template v-else-if="isOpen">
    <template v-if="isBomb">💥</template>
    <template v-else>{{count ? count : ''}}</template>
  </template>
</div>
</template>
