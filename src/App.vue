<script setup>
import { ref, computed, onMounted } from 'vue';
import GridItem from './grid-item.vue';

let interval;
const isStart = ref(false); // 是否出于游戏状态
const isFailed = ref(null); // 失败了？
const isSuccess = ref(null); // 成功了？
const row = ref(10);
const column = ref(10);
const flagged = ref(0); // 标记的数量
const opened = ref(0); // 点开的数量
const timeCount = ref(0);
// 格子总数
const total = computed(() => {
  return row.value * column.value;
});
// 炸弹总数
const bombNumber = computed(() => {
  return Math.floor(total.value / 8);
});
const grid = ref(null);
const gridItems = ref();

onMounted(() => {
  doStart();
});

function doStart(event) {
  clearInterval(interval);
  isFailed.value = isSuccess.value = null;
  flagged.value = timeCount.value = opened.value = 0;
  const bombs = [];
  bombs.length = total.value;
  bombs.fill(0, 0, total.value);
  let bomb = bombNumber.value;
  // TODO q1 除了这个算法，还能怎么实现
  while (bomb) {
    const index = Math.random() * total.value >> 0;
    if (bombs[index]) {
      continue;
    }
    bombs[index] = 1;
    bomb--;
  }
  // TODO q2 有没有别的方式计算这些单元格
  grid.value = bombs.map((bomb, index) => {
    const x = index % column.value;
    const y = index / column.value >> 0;
    let count = 0;
    for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
      for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column.value); j++) {
        if (bombs[i * column.value + j] && !(i === y && j === x)) {
          count++;
        }
      }
    }
    return {
      count,
      isBomb: !!bomb,
    };
  });
  isStart.value = true;
  if (event) {
    for (const gridItem of gridItems.value) {
      gridItem.reset();
    }
  }
}

function doStop(success = false) {
  clearInterval(interval);
  isFailed.value = !success;
  isSuccess.value = success;
  isStart.value = false;
}

function onFlag(flag) {
  flagged.value += flag ? 1 : -1;
}

function onOpen(item, index) {
  if (interval === undefined) {
    interval = setInterval(() => {
      timeCount.value += 1;
    }, 1000);
  }
  if (item.isBomb) {
    return doStop();
  }
  opened.value += 1;
  if (opened.value >= total.value - bombNumber.value) {
    return doStop(true);
  }
  // 如果点开的节点为 0，则点开附近的节点
  openGridItem(item, index);
}

function onOpenAll(item, index) {
  if (item.count === 0) {
    return;
  }
  const x = index % column.value;
  const y = index / column.value >> 0;
  let count = 0;
  const items = [];
  for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
    for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column.value); j++) {
      if (i === y && j === x) continue;
      const gridItem = gridItems.value[i * column.value + j];
      if (gridItem.isFlag) {
        count++;
      } else {
        items.push(gridItem);
      }
    }
  }
  if (count === item.count) {
    for (const gridItem of items) {
      gridItem.open();
    }
  }
}

function openGridItem(item, index) {
  if (item.count) {
    return;
  }
  const x = index % column.value;
  const y = index / column.value >> 0;
  for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
    for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column.value); j++) {
      if (i === y && j === x) {
        continue;
      }
      const gridItem = gridItems.value[i * column.value + j];
      gridItem.open();
    }
  }
}
</script>

<template>
  <h1>肉山小课堂：扫雷 Workshop</h1>
  <div class="flex items-center justify-between mb-4">
    <span class="w-20">地雷：{{bombNumber - flagged}}</span>
    <button
      type="button"
      class="start-button"
      @click="doStart">
      <template v-if="isSuccess">😊</template>
      <template v-else-if="isFailed">😭</template>
      <template v-else>🎮</template>
    </button>
    <span class="w-20 text-right">{{timeCount}}</span>
  </div>
  <div v-if="grid" id="stage" :class="{'pointer-events-none': !isStart}">
    <grid-item
      v-for="(item, index) in grid"
      ref="gridItems"
      :key="index"
      :count="item.count"
      :is-bomb="item.isBomb"
      :flagable="flagged < bombNumber"
      @flag="onFlag"
      @open="onOpen(item, index)"
      @open-all="onOpenAll(item, index)"
    />
  </div>
</template>
