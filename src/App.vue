<script setup>
import {ref, computed, onMounted, nextTick, defineAsyncComponent, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import JsConfetti from 'js-confetti';
import {version} from '../package.json';
import GridItem from './grid-item.vue';
import BrandFooter from './brand-footer.vue';
import BrandSiteSwitcher from './brand-site-switcher.vue';
import {Levels} from './data';
import { useOperationRecordsStore } from './store/operationRecords';
import { useLearningStore } from './store/learningStore';
import { computeProbabilities, getBestProbs, scoreForAction } from './solver/probability.js';
import { setLocale } from './i18n.js';

const { t, tm, locale } = useI18n()
const OperationChart = defineAsyncComponent(() => import('./operation-chart.vue') )
const operationStore = useOperationRecordsStore()
const learningStore = useLearningStore()

// locale -> URL + SEO sync
function toggleLocale() {
  const next = locale.value === 'en' ? 'zh' : 'en'
  setLocale(next)
  const target = next === 'en' ? '/en/' : '/'
  if (location.pathname !== target) {
    history.pushState(null, '', target)
  }
  updateSeoMeta(next)
}
function updateSeoMeta(loc) {
  const isEn = loc === 'en'
  document.title = isEn ? t('meta.title') : '肉山扫雷 - 边玩边学的扫雷 | 概率热力图·决策效率'
  const desc = t('meta.description')
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc)
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', t('meta.ogTitle'))
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', t('meta.ogDescription'))
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', t('meta.ogTitle'))
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', t('meta.twitterDescription'))
  document.documentElement.lang = isEn ? 'en' : 'zh-CN'
  // hreflang
  let linkEn = document.querySelector('link[hreflang="en"]')
  let linkZh = document.querySelector('link[hreflang="zh"]')
  if (!linkEn) { linkEn = document.createElement('link'); linkEn.rel='alternate'; linkEn.hreflang='en'; document.head.appendChild(linkEn) }
  if (!linkZh) { linkZh = document.createElement('link'); linkZh.rel='alternate'; linkZh.hreflang='zh'; document.head.appendChild(linkZh) }
  linkEn.href = 'https://minesweeper.meathill.com/en/'
  linkZh.href = 'https://minesweeper.meathill.com/'
  let linkX = document.querySelector('link[hreflang="x-default"]')
  if (!linkX) { linkX = document.createElement('link'); linkX.rel='alternate'; linkX.hreflang='x-default'; document.head.appendChild(linkX) }
  linkX.href = 'https://minesweeper.meathill.com/'
}
// init SEO on mount (in case locale is en on /en/)
watch(locale, (v) => updateSeoMeta(v))
const seoHowToPlay = computed(() => tm('seo.howToPlay'))
const seoChartBullets = computed(() => tm('seo.chartBullets'))
const seoProgressSteps = computed(() => tm('seo.progressSteps'))
const faqItems = computed(() => tm('faq.items'))


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

// 提示：最低概率格（优先有推断的前沿格）
const hintIndex = ref(null)
const hintFlashKey = ref(0)
function handleHint() {
  if (!isRealStart.value || !grid.value) return
  const frontierSet = probResult.value.frontierSet || new Set()
  // 先在未确定 0<p<1 中找最优，优先前沿
  let candidates = []
  let minP = Infinity
  for (const [idx, p] of probabilities.value) {
    const cell = grid.value[idx]
    if (!cell || cell.isOpen || cell.isFlag) continue
    if (p <= 0 || p >= 1) continue
    if (p < minP - 1e-9) {
      minP = p
      candidates = [idx]
    } else if (Math.abs(p - minP) < 1e-9) {
      candidates.push(idx)
    }
  }
  // 若没有 0<p<1，则在所有未开格中找最低（包括 0% 安全格）
  if (candidates.length === 0) {
    minP = Infinity
    for (const [idx, p] of probabilities.value) {
      const cell = grid.value[idx]
      if (!cell || cell.isOpen || cell.isFlag) continue
      if (p < minP - 1e-9) {
        minP = p
        candidates = [idx]
      } else if (Math.abs(p - minP) < 1e-9) {
        candidates.push(idx)
      }
    }
  }
  if (candidates.length === 0) return
  // 在并列最低中，优先有推断条件的前沿格
  const frontierCandidates = candidates.filter(idx => frontierSet.has(idx))
  const finalCandidates = frontierCandidates.length ? frontierCandidates : candidates
  const pick = finalCandidates[Math.floor(Math.random() * finalCandidates.length)]
  hintIndex.value = pick
  hintFlashKey.value++
}

function clearHintIfOpened(idx) {
  if (hintIndex.value === idx) {
    hintIndex.value = null
  }
}

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
  updateSeoMeta(locale.value);
});

function doStart(event) {
  clearInterval(interval);
  isRealStart.value = false;
  isFailed.value = isSuccess.value = null;
  flagged.value = timeCount.value = opened.value = 0;
  hintIndex.value = null
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
    clearHintIfOpened(index)
    return doStop();
  }
  // 同步到 grid 供概率计算使用
  if (grid.value[index] && !grid.value[index].isOpen) grid.value[index].isOpen = true
  clearHintIfOpened(index)
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
        <h1 class="text-lg sm:text-xl font-bold truncate">{{ t('header.title') }}</h1>
        <span class="text-xs opacity-60 whitespace-nowrap shrink-0">v{{version}}</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end shrink-0">
        <button class="btn btn-ghost btn-xs" @click="toggleLocale" :title="locale === 'en' ? '切换到中文' : 'Switch to English'">{{ locale === 'en' ? '中文' : 'EN' }}</button>
        <BrandSiteSwitcher />
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-ghost btn-sm px-2">
            {{ t(`header.levels.${level}`) }}
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
                <i class="bi mr-2" :class="level === key ? 'bi-check-lg' : 'bi-blank'" /> {{ t(`header.levels.${key}`) }}
                </span>
              </label>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </header>
  <div class="bg-slate-800 text-white mt-3">
    <div class="mx-auto flex items-center py-2 px-2" :style="{ width: `min(calc(100% - 16px), calc(var(--column) * 2rem))` }">
      <div class="flex-1 flex justify-center">
        <div class="flex items-center gap-3 sm:gap-6">
          <span class="w-24 sm:w-32 text-sm">{{ t('toolbar.mines', { count: bombNumber - flagged }) }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline bg-white text-slate-800 border-slate-300 start-button"
            @click="doStart"
          >
            <template v-if="isSuccess">😊</template>
            <template v-else-if="isFailed">😭</template>
            <template v-else>🎮</template>
          </button>
          <span class="w-24 sm:w-32 text-right text-sm flex justify-end items-center gap-1">
            <template v-if="timeCount <= 59">
              <span class="countdown"><span :style="{ '--value': timeCount }"></span></span>
            </template>
            <template v-else-if="timeCount >= 99 * 60 + 59">
              <span class="countdown" style="--value:99"></span>
              :
              <span class="countdown" :style="{ '--value': timeCount % 60 }"></span>
            </template>
            <template v-else>
              <span class="countdown" :style="{ '--value': Math.floor(timeCount / 60) }"></span>
              :
              <span class="countdown" :style="{ '--value': timeCount % 60 }"></span>
            </template>
          </span>
        </div>
      </div>
      <!-- 右侧：提示 + 学习模式（对齐高级难度游戏区右缘） -->
      <div class="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
        <button class="btn btn-xs sm:btn-sm btn-warning" @click="handleHint" :disabled="!isRealStart || !probabilities.size">{{ t('toolbar.hint') }}</button>
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-xs sm:btn-sm btn-primary">{{ t('toolbar.learningMode') }}</label>
          <div tabindex="0" class="dropdown-content mt-3 p-3 shadow menu bg-base-100 text-base-content rounded-box w-56">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" class="toggle toggle-sm toggle-primary" v-model="learningStore.showProbability" />
              <span>{{ t('toolbar.learningDropdown.enableHeatmap') }}</span>
            </label>
            <div v-if="learningStore.showProbability" class="mt-3 flex flex-col gap-2">
              <div class="flex items-center gap-1 text-xs">
                <span class="w-12 h-2 rounded" style="background: linear-gradient(90deg, rgba(34,197,94,0.75), rgba(234,179,8,0.75), rgba(239,68,68,0.75))"></span>
                <span>{{ t('toolbar.learningDropdown.gradient') }}</span>
              </div>
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-xs" v-model="learningStore.showPercent" />
                {{ t('toolbar.learningDropdown.showPercent') }}
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-xs" v-model="learningStore.showFraction" />
                {{ t('toolbar.learningDropdown.showFraction') }}
              </label>
            </div>
            <p v-else class="text-xs opacity-60 mt-2">{{ t('toolbar.learningDropdown.disabledHint') }}</p>
          </div>
        </div>
      </div>
    </div>
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
      :is-hint="hintIndex === index"
      :hint-flash-key="hintFlashKey"
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
    <h2 class="text-2xl font-bold mb-3">{{ t('seo.whatIsTitle') }}</h2>
    <p class="text-sm leading-7 opacity-80 mb-6" v-html="t('seo.whatIsDesc')"></p>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('seo.howToPlayTitle') }}</h2>
    <ul class="list-disc ps-5 text-sm leading-7 opacity-80 mb-6">
      <li v-for="(item, idx) in seoHowToPlay" :key="idx" v-html="item"></li>
    </ul>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('seo.learningTitle') }}</h2>
    <h3 class="font-semibold mt-4 mb-2">{{ t('seo.heatmapTitle') }}</h3>
    <p class="text-sm leading-7 opacity-80 mb-4" v-html="t('seo.heatmapDesc')"></p>
    <h3 class="font-semibold mt-4 mb-2">{{ t('seo.efficiencyTitle') }}</h3>
    <p class="text-sm leading-7 opacity-80 mb-4" v-html="t('seo.efficiencyDesc')"></p>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('seo.chartTitle') }}</h2>
    <p class="text-sm leading-7 opacity-80 mb-2" v-html="t('seo.chartDesc')"></p>
    <ul class="list-disc ps-5 text-sm leading-7 opacity-80 mb-6">
      <li v-for="(item, idx) in seoChartBullets" :key="idx" v-html="item"></li>
    </ul>
    <p class="text-sm leading-7 opacity-80 mb-6">{{ t('seo.chartHint') }}</p>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('seo.progressTitle') }}</h2>
    <ol class="list-decimal ps-5 text-sm leading-7 opacity-80 mb-6">
      <li v-for="(item, idx) in seoProgressSteps" :key="idx" v-html="item"></li>
    </ol>

    <div class="text-xs opacity-60 mt-8">{{ t('seo.keywords') }}</div>
  </section>

  <!-- GEO 友好：高密度问答，供生成式引擎直接引用 -->
  <section id="geo-faq" class="container mx-auto max-w-3xl px-4 py-8 mt-2">
    <h2 class="text-xl font-bold mb-4">{{ t('faq.title') }}</h2>
    <div class="space-y-4 text-sm leading-7">
      <div v-for="(item, idx) in faqItems" :key="idx" class="bg-base-100 border border-base-300 rounded-box p-4">
        <h3 class="font-semibold">{{ item.q }}</h3>
        <p class="opacity-80 mt-1" v-html="item.a"></p>
      </div>
    </div>
  </section>

  <BrandFooter />
</template>
