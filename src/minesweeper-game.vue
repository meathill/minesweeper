<script setup>
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { version } from '../package.json';
import GridItem from './grid-item.vue';
import CossDropdown from './coss-dropdown.vue';
import { matchShortcut } from './utils/shortcuts.js';
import { useOperationRecordsStore } from './store/operationRecords';
import { useLearningStore } from './store/learningStore';
import { useGameStore } from './store/gameStore';
import { useProbabilityStore } from './store/probabilityStore';
import { formatTime } from './utils/format.js';
import { trackEvent } from './analytics.js';

const { t } = useI18n();
const OperationChart = defineAsyncComponent(
  () => import('./operation-chart.vue'),
);
const operationStore = useOperationRecordsStore();
const learningStore = useLearningStore();
const game = useGameStore();
const prob = useProbabilityStore();

// 学习模式开关与显示设置埋点
watch(
  () => learningStore.showProbability,
  (v) => trackEvent('learn_mode_toggle', { enabled: v, level: game.level }),
);
watch(
  () => learningStore.showPercent,
  (v) => trackEvent('learn_show_percent', { enabled: v, level: game.level }),
);
watch(
  () => learningStore.showFraction,
  (v) => trackEvent('learn_show_fraction', { enabled: v, level: game.level }),
);

// 全局快捷键（Windows 对齐：F2 新开；H 提示、L 教学为扩展）
function handleGlobalKeydown(event) {
  const action = matchShortcut(event);
  if (!action) return;
  if (action === 'new') {
    event.preventDefault();
    game.doStart(true);
  } else if (action === 'hint') {
    prob.handleHint();
  } else if (action === 'learn') {
    learningStore.showProbability = !learningStore.showProbability;
  }
  trackEvent('shortcut_use', { action, level: game.level });
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  // 延后生成棋盘：先让 header H1 / SSR 文案完成首屏绘制，避免格子 DOM 抢走 LCP
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      game.doStart(null);
    });
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="bg-slate-800 text-white mt-3">
    <div
      class="mx-auto flex items-center py-2 px-2"
      :style="{ width: `min(calc(100% - 16px), calc(var(--column) * 2rem))` }"
    >
      <div class="flex-1 flex justify-center">
        <div class="flex items-center gap-3 sm:gap-6">
          <span class="w-24 sm:w-32 text-sm">{{ t('toolbar.mines', { count: game.bombNumber - game.flagged }) }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline bg-white text-slate-800 border-slate-300 start-button"
            :title="t('toolbar.newGameTitle')"
            aria-keyshortcuts="F2"
            @click="(e) => game.doStart(e)"
          >
            <template v-if="game.isSuccess">😊</template>
            <template v-else-if="game.isFailed">😭</template>
            <template v-else>🎮</template>
            <kbd class="kbd kbd-xs hidden sm:inline-flex">F2</kbd>
          </button>
          <span class="w-24 sm:w-32 text-right text-sm font-mono">{{ formatTime(game.timeCount) }}</span>
        </div>
      </div>
      <!-- 右侧：提示 + 学习模式（对齐高级难度游戏区右缘） -->
      <div class="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
        <button
          class="btn btn-xs sm:btn-sm btn-warning"
          aria-keyshortcuts="h"
          :title="t('toolbar.hintTitle')"
          :disabled="!game.isRealStart || !prob.probabilities.size"
          @click="prob.handleHint"
        >
          {{ t('toolbar.hint') }} <kbd class="kbd kbd-xs hidden sm:inline-flex">H</kbd>
        </button>
        <CossDropdown
          trigger-class="coss-dropdown-trigger-toolbar"
          panel-class="coss-dropdown-learning"
          aria-keyshortcuts="l"
          :title="t('toolbar.learnTitle')"
        >
          <template #trigger>
            <span>{{ t('toolbar.learningMode') }}</span>
            <kbd class="kbd kbd-xs hidden sm:inline-flex">L</kbd>
          </template>
          <div class="coss-learning-body">
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input
                v-model="learningStore.showProbability"
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
              />
              <span>{{ t('toolbar.learningDropdown.enableHeatmap') }}</span>
            </label>
            <div v-if="learningStore.showProbability" class="mt-3 flex flex-col gap-2">
              <div class="flex items-center gap-1 text-xs">
                <span
                  class="w-12 h-2 rounded"
                  style="background: linear-gradient(90deg, rgba(34,197,94,0.75), rgba(234,179,8,0.75), rgba(239,68,68,0.75))"
                ></span>
                <span>{{ t('toolbar.learningDropdown.gradient') }}</span>
              </div>
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  v-model="learningStore.showPercent"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />
                <span>{{ t('toolbar.learningDropdown.showPercent') }}</span>
              </label>
              <label class="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  v-model="learningStore.showFraction"
                  type="checkbox"
                  class="checkbox checkbox-xs"
                />
                <span>{{ t('toolbar.learningDropdown.showFraction') }}</span>
              </label>
            </div>
            <p v-else class="text-xs opacity-60 mt-2">{{ t('toolbar.learningDropdown.disabledHint') }}</p>
          </div>
        </CossDropdown>
      </div>
    </div>
  </div>

  <div
    v-if="game.grid"
    id="stage"
    :class="{ 'game-over': !game.isStart }"
    :style="game.gridStyle"
    @contextmenu.stop.prevent
  >
    <grid-item
      v-for="(item, index) in game.grid"
      :key="index"
      :ref="(el) => game.setGridItemRef(el, index)"
      :count="item.count"
      :is-bomb="item.isBomb"
      :disabled="!game.isStart"
      :flagable="game.flagged < game.bombNumber"
      :probability="prob.getProbability(index)"
      :show-probability="learningStore.showProbability && game.isRealStart"
      :show-percent="learningStore.showPercent"
      :show-fraction="learningStore.showFraction"
      :is-hint="prob.hintIndex === index"
      :hint-flash-key="prob.hintFlashKey"
      :cell-index="index"
      :columns="game.column"
      :is-selected="operationStore.selectedIndex === index"
      @mark-state="game.onMarkState(index, $event)"
      @open="game.onOpen(item, index, $event)"
      @open-all="game.onOpenAll(item, index)"
    />
  </div>

  <div v-if="operationStore.isShowChart" class="flex items-center justify-center my-4">
    <Suspense>
      <template #default>
        <operation-chart
          @replay="game.restoreToSnapshot"
          @download="() => game.handleDownloadReplay(version)"
        />
      </template>
      <template #fallback>
        <div class="loading loading-spinner loading-lg"></div>
      </template>
    </Suspense>
  </div>
</template>

