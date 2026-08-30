<script setup>
import {ref, computed, onMounted, nextTick, defineAsyncComponent } from 'vue';
import JsConfetti from 'js-confetti';
import {version} from '../package.json';
import GridItem from './grid-item.vue';
import BrandFooter from './brand-footer.vue';
import BrandSiteSwitcher from './brand-site-switcher.vue';
import {Levels} from './data';
import { useOperationRecordsStore } from './store/operationRecords';
import { useLearningStore } from './store/learningStore';
import { computeProbabilities, getBestProbs, scoreForAction } from './solver/probability.js';

const OperationChart = defineAsyncComponent(() => import('./operation-chart.vue') )
const operationStore = useOperationRecordsStore()
const learningStore = useLearningStore()


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

// 概率计算（玩家视角，不使用 isBomb）——始终计算用于评分，显隐仅由 showProbability 控制
const probResult = computed(() => {
  if (!isRealStart.value || !grid.value) return { map: new Map(), isApproximate: false }
  const _flagDep = flagged.value
  const _openDep = opened.value
  grid.value.forEach(c => c.isOpen + c.isFlag)
  void _flagDep; void _openDep
  return computeProbabilities(grid.value, row.value, column.value, bombNumber.value)
})
const probabilities = computed(() => probResult.value.map)
const isApproximate = computed(() => probResult.value.isApproximate)
const bestProbs = computed(() => getBestProbs(probabilities.value))

function recordEfficiency(index, action) {
  const prob = probabilities.value.get(index)
  if (prob == null) return
  const { pMin, pMax } = bestProbs.value
  const pBest = action === 'flag' ? pMax : pMin
  if (pBest == null) return
  const score = scoreForAction(prob, pBest, action)
  if (score == null) return
  operationStore.onRecordEfficiency({ index, prob, pBest, score, action })
}
function getProbability(index) {
  return probabilities.value.get(index) ?? null
}

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
  // 刷新记录每分钟操作
  operationStore.onFreshOperateRecords()
}

function doRealStart(clickedIndex) {
  isRealStart.value = true;
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
  // 防止用户错误离开
  addEventListener('beforeunload', onBeforeUnload);
}

function doStop(success = false) {
  clearInterval(interval);
  isFailed.value = !success;
  isSuccess.value = success;
  isStart.value = isRealStart.value = false;
  removeEventListener('beforeunload', onBeforeUnload);
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
  operationStore.onStopOperateRecords()
}

function onFlag(index, flag) {
  // 在状态变更前快照效率（评分始终记录，显隐不影响）
  if (isRealStart.value) {
    const prob = probabilities.value.get(index)
    const { pMax } = bestProbs.value
    if (prob != null && pMax != null) {
      const score = scoreForAction(prob, pMax, 'flag')
      if (score != null) operationStore.onRecordEfficiency({ index, prob, pBest: pMax, score, action: 'flag' })
    } else if (prob == null && pMax == null) {
      // 孤立或首步旗标，无约束时视为最优
      operationStore.onRecordEfficiency({ index, prob: prob ?? 0, pBest: 0, score: 1, action: 'flag' })
    }
  }
  flagged.value += flag ? 1 : -1;
  if (grid.value && grid.value[index]) grid.value[index].isFlag = flag
}

const REVEAL_STEP_MS = 25; // 批量展开时每层涟漪的延迟

async function onOpen(item, index, delayMs = 0) {
  if (!isRealStart.value) {
    doRealStart(index);
    // 开始记录每分钟操作
    operationStore.onUpdateOperateRecords('')
    await nextTick();
    onOpen(grid.value[index], index);
    return;
  }

  // 仅玩家主动点开（delayMs===0 且未通过递归展开）时计分；递归展开的空白连开不计分
  const isUserAction = delayMs === 0
  if (isUserAction) {
    // 首步必定安全（规避地雷），或孤立无约束时直接满分
    if (opened.value === 0 && flagged.value === 0) {
      operationStore.onRecordEfficiency({ index, prob: 0, pBest: 0, score: 1, action: 'open' })
    } else {
      const prob = probabilities.value.get(index)
      const { pMin } = bestProbs.value
      if (prob != null && pMin != null) {
        const score = scoreForAction(prob, pMin, 'open')
        if (score != null) operationStore.onRecordEfficiency({ index, prob, pBest: pMin, score, action: 'open' })
      } else {
        // 无约束或概率缺失时视为最优（与当前最低一致）
        operationStore.onRecordEfficiency({ index, prob: prob ?? 0, pBest: pMin ?? 0, score: 1, action: 'open' })
      }
    }
  }

  if (item.isBomb) {
    return doStop();
  }
  // 同步到 grid 供概率计算使用
  if (grid.value[index] && !grid.value[index].isOpen) grid.value[index].isOpen = true
  opened.value += 1;
  if (opened.value >= total.value - bombNumber.value) {
    return doStop(true);
  }
  // 如果点开的节点为 0，则点开附近的节点
  openGridItem(item, index, delayMs);
}

function onOpenAll(item, index) {
  if (item.count === 0) {
    return;
  }
  const x = index % column.value;
  const y = index / column.value >> 0;
  let count = 0;
  const items = [];
  const targetIndices = [];
  for (let i = Math.max(0, y - 1); i < Math.min(y + 2, row.value); i++) {
    for (let j = Math.max(0, x - 1); j < Math.min(x + 2, column.value); j++) {
      if (i === y && j === x) continue;
      const idx = i * column.value + j
      const gridItem = gridItems.value[idx];
      if (gridItem.isFlag) {
        count++;
      } else {
        items.push(gridItem);
        targetIndices.push(idx);
      }
    }
  }
  if (count === item.count) {
    // 双击批量打开视为绝对安全决策，固定满分 10（评分始终记录）
    if (targetIndices.length) {
      const pMin = bestProbs.value.pMin
      const avgProb = targetIndices.reduce((a, ti) => a + (probabilities.value.get(ti) ?? 0), 0) / targetIndices.length
      operationStore.onRecordEfficiency({ index, prob: avgProb, pBest: pMin ?? 0, score: 1, action: 'chord' })
    }
    for (const gridItem of items) {
      gridItem.open();
      if (isFailed.value) return;
    }
  }
}

function onLevelChange(level) {
  localStorage.setItem('level', level);
  row.value = Levels[level].row;
  column.value = Levels[level].column;
  doStart(true);
}

function openGridItem(item, index, delayMs = 0) {
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
      gridItem.open(false, delayMs + REVEAL_STEP_MS);
    }
  }
}

function onBeforeUnload(event) {
  event.preventDefault();
  event.returnValue = '';
}
</script>

<template>
  <header class="navbar bg-base-200">
    <div class="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 py-1">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <a class="brand-studio" href="https://meathill.com">Meathill Studio</a>
        <span aria-hidden="true" class="brand-divider"></span>
        <h1 class="text-lg sm:text-xl font-bold truncate">肉山扫雷</h1>
        <span class="text-xs opacity-60 whitespace-nowrap shrink-0">v{{version}}</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end shrink-0">
        <BrandSiteSwitcher />
        <label class="flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer select-none shrink-0">
          <input type="checkbox" class="toggle toggle-xs toggle-primary" v-model="learningStore.showProbability" />
          <span class="whitespace-nowrap">学习模式</span>
        </label>
        <template v-if="learningStore.showProbability">
          <span class="hidden sm:inline-flex items-center gap-1 text-xs whitespace-nowrap">
            <span class="w-12 h-2 rounded" style="background: linear-gradient(90deg, rgba(34,197,94,0.75), rgba(234,179,8,0.75), rgba(239,68,68,0.75))"></span>
            0%→100%
          </span>
          <label class="hidden sm:flex items-center gap-1 text-xs cursor-pointer select-none">
            <input type="checkbox" class="checkbox checkbox-xs" v-model="learningStore.showPercent" />
            <span>%</span>
          </label>
          <label class="hidden sm:flex items-center gap-1 text-xs cursor-pointer select-none">
            <input type="checkbox" class="checkbox checkbox-xs" v-model="learningStore.showFraction" />
            <span>分数</span>
          </label>
          <div class="dropdown dropdown-end sm:hidden">
            <label tabindex="0" class="btn btn-xs btn-ghost px-1">⚙️</label>
            <div tabindex="0" class="dropdown-content mt-2 p-2 shadow bg-base-100 rounded-box w-40">
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" class="checkbox checkbox-xs" v-model="learningStore.showPercent" />
                  显示 %
                </label>
                <label class="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" class="checkbox checkbox-xs" v-model="learningStore.showFraction" />
                  显示分数
                </label>
                <div class="flex items-center gap-1 text-xs">
                  <span class="w-10 h-2 rounded shrink-0" style="background: linear-gradient(90deg, rgba(34,197,94,0.75), rgba(234,179,8,0.75), rgba(239,68,68,0.75))"></span>
                  0%→100%
                </div>
              </div>
            </div>
          </div>
        </template>
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-ghost btn-sm px-2">
            {{level}}
            <svg class="fill-current" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
              <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/>
            </svg>
          </label>
          <ul tabindex="0" class="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-200 rounded-box w-52">
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
    </div>
  </header>
  <div class="flex items-center justify-center my-4">
    <span class="w-32 countdown">地雷：<span :style="{'--value': bombNumber - flagged}"></span></span>
    <button
      type="button"
      class="btn btn-outline btn-primary start-button"
      @click="doStart"
    >
      <template v-if="isSuccess">😊</template>
      <template v-else-if="isFailed">😭</template>
      <template v-else>🎮</template>
    </button>
    <span class="w-32 justify-end countdown">
      <template v-if="timeCount <= 59">
        <span :style="{ '--value': timeCount }"></span>
      </template>
      <template v-else-if="timeCount >= 99 * 60 + 59">
        <span style="--value:99"></span>
        :
        <span :style="{ '--value': timeCount % 60 }"></span>
      </template>
      <template v-else>
        <span :style="{ '--value': Math.floor(timeCount / 60) }"></span>
        :
        <span :style="{ '--value': timeCount % 60 }"></span>
      </template>
    </span>
  </div>
  <div v-if="grid" id="stage" :class="{'pointer-events-none': !isStart}" :style="gridStyle" @contextmenu.stop.prevent>
    <grid-item
      v-for="(item, index) in grid"
      ref="gridItems"
      :key="index"
      :count="item.count"
      :is-bomb="item.isBomb"
      :flagable="flagged < bombNumber"
      :probability="getProbability(index)"
      :show-probability="learningStore.showProbability && isRealStart"
      :show-percent="learningStore.showPercent"
      :show-fraction="learningStore.showFraction"
      @flag="onFlag(index, $event)"
      @open="onOpen(item, index, $event)"
      @open-all="onOpenAll(item, index)"
    />
  </div>
  <div v-if="operationStore.isShowChart" class="flex items-center justify-center my-4">
    <Suspense>
      <template #default>
        <operation-chart />
      </template>
      <template #fallback>
        <div class="loading loading-spinner loading-lg"></div>
      </template>
    </Suspense>
  </div>

  <section class="container mx-auto max-w-3xl px-4 py-10 mt-6 border-t border-base-300">
    <h2 class="text-2xl font-bold mb-3">什么是肉山扫雷？</h2>
    <p class="text-sm leading-7 opacity-80 mb-6">
      肉山扫雷是经典扫雷的现代复刻，<strong>边玩边学</strong>是它的核心：既保留 9×9/16×16/16×30 三档难度与右键插旗的原味规则，又加入<strong>学习模式</strong>——实时计算每个未翻开格子的地雷概率，用 75% 绿-黄-红热力图直接盖在格子上，并用<strong>决策效率 0-10 分</strong>量化你每一步与“当时最优解”的差距。免右键、双击批量打开，触摸板与手机也能流畅游玩。
    </p>

    <h2 class="text-xl font-bold mt-8 mb-3">怎么玩</h2>
    <ul class="list-disc ps-5 text-sm leading-7 opacity-80 mb-6">
      <li><strong>左键翻开</strong>：首次点击必不中雷；数字表示周围 8 格内的雷数。</li>
      <li><strong>右键/长按插旗</strong>：标记你认为有雷的格子；顶部会实时显示剩余地雷数。</li>
      <li><strong>双击数字批量打开（苹果鼠标/触摸板优化）</strong>：传统扫雷需“左右键同时按”来批量打开，本站针对 <strong>Apple Magic Mouse 单键、Mac 触摸板、手机</strong>做了优化——只要数字周围的旗数等于该数字，<strong>双击该数字</strong>即可一键打开剩余邻格，无需右键。桌面端仍兼容左右键同按，双击也会被计为一次“绝对安全决策（10 分）”。</li>
      <li>翻开所有非雷格子即胜利；点中雷则一键揭晓全盘。</li>
    </ul>

    <h2 class="text-xl font-bold mt-8 mb-3">什么是学习模式</h2>
    <h3 class="font-semibold mt-4 mb-2">概率热力图：看见每一格的风险</h3>
    <p class="text-sm leading-7 opacity-80 mb-4">
      开启学习模式后，求解器会在后台基于<strong>已翻开数字 + 已插旗</strong>构建约束（<code>周围雷数 - 已标旗 = 剩余雷数</code>），对“前沿格”（与数字相邻的未开格）做分量拆分与回溯枚举，孤立格按 <code>剩余雷数/孤立格数</code> 均摊。每格得到 <code>P(是雷) 0-1</code>，用 <span class="inline-block w-3 h-3 rounded align-middle" style="background:#22c55e"></span> 绿（0%）→ <span class="inline-block w-3 h-3 rounded align-middle" style="background:#eab308"></span> 黄（50%）→ <span class="inline-block w-3 h-3 rounded align-middle" style="background:#ef4444"></span> 红（100%）75% 透明度叠在未开格上。 header 的复选框可独立开关 <code>%</code> 与 <code>分数</code> 文本，只看颜色也能训练直觉。
    </p>
    <h3 class="font-semibold mt-4 mb-2">决策效率：你的每一步打几分</h3>
    <p class="text-sm leading-7 opacity-80 mb-4">
      没有绝对的 10 分，只有<strong>相对当前盘面的最优</strong>。翻开时以当时 <code>pMin（全场最低雷概率）</code> 为分母：<code>得分 = (1-p_选中)/(1-pMin)×10</code>；插旗时以 <code>pMax</code> 为分母：<code>得分 = p_选中/pMax×10</code>。选中当时最安全/最该标的格子即 <strong>10 分</strong>，选 50% 而场上有 0% 可选则只有约 5 分。双击批量打开视为“已判定安全”，固定 <strong>10 分</strong>。分数与热力图共用同一求解器，关闭学习模式也会在后台计分，不影响复盘。
    </p>

    <h2 class="text-xl font-bold mt-8 mb-3">如何读懂复盘图表</h2>
    <p class="text-sm leading-7 opacity-80 mb-2">
      胜利或失败后自动弹出三线图，X 轴为<strong>时间（分:秒 / 时:分:秒）</strong>，按 6 秒分桶聚合：
    </p>
    <ul class="list-disc ps-5 text-sm leading-7 opacity-80 mb-6">
      <li><strong class="text-[#4bc0c0]">打开安全区（青绿）</strong>：RPM（操作次数/分钟）左轴，反映手速与连开效率。</li>
      <li><strong class="text-[#FF6B6B]">插旗（红）</strong>：同左轴，看你何时密集标雷。</li>
      <li><strong class="text-[#f59e0b]">决策效率（橙，右轴 0-10）</strong>：每 6 秒内所有计分操作的均值，10 为当时最优，持续走低说明开始“盲猜”。</li>
    </ul>
    <p class="text-sm leading-7 opacity-80 mb-6">结合热力图复盘：橙线低谷对应的时间点，回看当时哪一步没选最绿格，就知道下次该怎么选。</p>

    <h2 class="text-xl font-bold mt-8 mb-3">从新手到高手</h2>
    <ol class="list-decimal ps-5 text-sm leading-7 opacity-80 mb-6">
      <li>先开学习模式看颜色，建立“绿=可点、红=须标”的直觉；</li>
      <li>关掉 %/分数，只用颜色做决策，再对照复盘看分数是否仍 10；</li>
      <li>最后关闭学习模式，靠逻辑与记忆挑战 Hard 16×30，目标 RPM 稳定、橙线维持 9 以上。</li>
    </ol>

    <div class="text-xs opacity-60 mt-8">
      关键词：肉山扫雷 · 扫雷边玩边学 · 扫雷概率 · 扫雷技巧 · 扫雷教学 · 学习模式 · 决策效率 · 复盘 · 苹果鼠标扫雷 · 触摸板扫雷
    </div>
  </section>

  <!-- GEO 友好：高密度问答，供生成式引擎直接引用 -->
  <section id="geo-faq" class="container mx-auto max-w-3xl px-4 py-8 mt-2">
    <h2 class="text-xl font-bold mb-4">常见问题（GEO 友好）</h2>
    <div class="space-y-4 text-sm leading-7">
      <div class="bg-base-100 border border-base-300 rounded-box p-4">
        <h3 class="font-semibold">肉山扫雷是什么？</h3>
        <p class="opacity-80 mt-1">肉山扫雷（minesweeper.meathill.com）是边玩边学的现代扫雷，支持 9×9/16×16/16×30 三档难度，免右键、双击批量打开，独有学习模式：实时概率热力图与决策效率评分，局后三线复盘图帮助从盲猜到精通。</p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-box p-4">
        <h3 class="font-semibold">学习模式的概率是怎么算的？</h3>
        <p class="opacity-80 mt-1">基于已翻开数字与已插旗构建约束 <code>need = 数字 - 已标旗</code>，对前沿格分量拆分回溯枚举，孤立格按剩余雷数均摊，得到每格 P(是雷) 0-1，用绿→黄→红 75% 叠加。求解器后台始终运行，即使关闭显隐也会用于决策评分。</p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-box p-4">
        <h3 class="font-semibold">决策效率 0-10 分是什么意思？</h3>
        <p class="opacity-80 mt-1">相对分：翻开以当时全场最低 <code>pMin</code> 为分母，<code>(1-p)/(1-pMin)×10</code>；插旗以最高 <code>pMax</code> 为分母。选中当时最该点/最该标的格子即 10 分；双击批量打开固定 10 分。分数按 6 秒分桶取均值画在复盘图右轴。</p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-box p-4">
        <h3 class="font-semibold">苹果鼠标/触摸板怎么玩？</h3>
        <p class="opacity-80 mt-1">已优化：无需左右键同按，对满足 <code>旗数==数字</code> 的已翻开格<strong>双击</strong>即可批量打开剩余邻格。右键、长按插旗、触摸板点按均兼容，手机亦可直接游玩。</p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-box p-4">
        <h3 class="font-semibold">复盘图怎么看？</h3>
        <p class="opacity-80 mt-1">X 轴为时间（分:秒/时:分:秒），Y 左轴为 RPM（操作/分钟，青绿=打开安全区、红=插旗），Y 右轴为决策效率（橙 0-10）。橙线持续 9+ 说明全程选最优；低谷对应时间点即需回顾的“非最绿”决策。</p>
      </div>
      <div class="bg-base-100 border border-base-300 rounded-box p-4">
        <h3 class="font-semibold">适合谁？</h3>
        <p class="opacity-80 mt-1">零基础新手用热力图建立直觉，进阶玩家关掉 %/分数只看颜色训练盲扫，高手关闭学习模式冲 Hard 榜单。所有局都可局后复盘。<br/>官网：<a class="link" href="https://minesweeper.meathill.com/">https://minesweeper.meathill.com/</a> · 作者：<a class="link" href="https://meathill.com">Meathill Studio</a></p>
      </div>
    </div>
  </section>

  <BrandFooter />
</template>
