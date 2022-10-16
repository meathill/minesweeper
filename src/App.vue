<script setup>
import {ref, computed, onMounted, nextTick} from 'vue';
import JsConfetti from 'js-confetti';
import {version} from '../package.json';
import GridItem from './grid-item.vue';
import {Levels} from './data';

let interval = null;
const jsConfetti = new JsConfetti();
const isStart = ref(false); // 是否出于游戏状态
const isRealStart = ref(false); // 是否真正开始游戏
const isFailed = ref(null); // 失败了？
const isSuccess = ref(null); // 成功了？
const level = ref(localStorage.getItem('level') || 'Easy');
const row = ref(Levels[level.value].row);
const column = ref(Levels[level.value].column);
const flagged = ref(0); // 标记的数量
const opened = ref(0); // 点开的数量
const timeCount = ref(0);
// 格子总数
const total = computed(() => {
  return row.value * column.value;
});
// 炸弹总数
const bombNumber = computed(() => {
  return level.value === 'Custom' ? (total.value / 8 >> 0) : Levels[level.value].bomb;
});
// 地图阵列
const gridStyle = computed(() => {
  return `--row:${row.value};--column:${column.value}`;
})
const grid = ref(null);
const gridItems = ref();

onMounted(() => {
  doStart();
});

function doStart(event) {
  clearInterval(interval);
  isRealStart.value = false;
  isFailed.value = isSuccess.value = null;
  flagged.value = timeCount.value = opened.value = 0;
  const bombs = [];
  bombs.length = total.value;
  bombs.fill(0, 0, total.value);
  grid.value = bombs.map((_, index) => {
    return {
      index,
      isBomb: false,
      count: 0,
      isOpen: false,
      isFlag: false,
      isUncovered: false,
    };
  });
  isStart.value = true;
  if (event) {
    for (const gridItem of gridItems.value) {
      gridItem.reset();
    }
  }
}

function doRealStart(clickedIndex) {
  let bomb = bombNumber.value;
  while (bomb) {
    const index = Math.random() * total.value >> 0;
    if (grid.value[index].isBomb || index === clickedIndex) {
      continue;
    }
    grid.value[index].isBomb = true;
    bomb--;
  }
  grid.value = grid.value.map((item, index) => {
    const x = index % column.value;
    const y = index / column.value >> 0;
    let count = 0;
    for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
      for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column.value); j++) {
        if (grid.value[i * column.value + j].isBomb && !(i === y && j === x)) {
          count++;
        }
      }
    }
    return {
      ...item,
      count,
    };
  });
  interval = setInterval(() => {
    timeCount.value += 1;
  }, 1000);
  isRealStart.value = true;
}

function doStop(success = false) {
  clearInterval(interval);
  isFailed.value = !success;
  isSuccess.value = success;
  isStart.value = isRealStart.value = false;
  if (success) {
    jsConfetti.addConfetti({
      confettiNumber: 500,
    });
    for (const gridItem of gridItems.value) {
      gridItem.addFlag(true);
    }
  } else {
    for (const gridItem of gridItems.value) {
      gridItem.uncover();
    }
  }
}

function onFlag(flag) {
  flagged.value += flag ? 1 : -1;
}

async function onOpen(item, index) {
  if (!isRealStart.value) {
    doRealStart(index);
    await nextTick();
    onOpen(grid.value[index], index);
    return;
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

function onLevelChange(level) {
  localStorage.setItem('level', level);
  row.value = Levels[level].row;
  column.value = Levels[level].column;
  doStart(true);
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
  <header class="navbar bg-base-200">
    <h1 class="btn btn-ghost normal-case text-xl">肉山小课堂：扫雷 Workshop</h1>
    <div class="text-xs text-gray">v{{version}}</div>
    <div class="ml-auto">
      <div class="dropdown dropdown-end">
        <label tabindex="0" class="btn btn-ghost">
          {{level}}
          <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
            <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
          </svg>
        </label>
        <ul tabindex="0" class="mt-3 p-2 shadow menu menu-compact dropdown-content bg-base-200 rounded-box w-52">
          <li v-for="(item, key) in Levels" :key="key">
            <label class="flex items-center">
              <input
                hidden
                type="radio"
                name="level"
                v-model="level"
                :value="key"
                :disabled="key === 'Custom'"
                @change="onLevelChange(key)"
              />
              <span>
                <i class="bi mr-2" :class="level === key ? 'bi-check-lg' : 'bi-blank'" /> {{key}}
              </span>
            </label>
          </li>
        </ul>
      </div>
    </div>
  </header>
  <div class="flex items-center justify-center my-4">
    <span class="w-32 countdown">地雷：<span :style="{'--value': bombNumber - flagged}"></span></span>
    <button
        type="button"
        class="btn btn-outline btn-primary start-button"
        @click="doStart">
      <template v-if="isSuccess">😊</template>
      <template v-else-if="isFailed">😭</template>
      <template v-else>🎮</template>
    </button>
    <span class="w-32 justify-end countdown"><span :style="{'--value': timeCount}"></span></span>
  </div>
  <div v-if="grid" id="stage" :class="{'pointer-events-none': !isStart}" :style="gridStyle" @contextmenu.stop.prevent>
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
