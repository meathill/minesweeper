<script setup>
import { computed, onMounted, defineAsyncComponent, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { version } from '../package.json';
import GridItem from './grid-item.vue';
import BrandFooter from './brand-footer.vue';
import BrandSiteSwitcher from './brand-site-switcher.vue';
import { Levels } from './data';
import { useOperationRecordsStore } from './store/operationRecords';
import { useLearningStore } from './store/learningStore';
import { useGameStore } from './store/gameStore';
import { useProbabilityStore } from './store/probabilityStore';
import { LOCALES, updateSeoMeta } from './seo-meta.js';
import { formatTime } from './utils/format.js';
import { trackEvent } from './analytics.js';
import { setLocale } from './i18n.js';

const { t, tm, locale } = useI18n();
const OperationChart = defineAsyncComponent(
  () => import('./operation-chart.vue'),
);
const operationStore = useOperationRecordsStore();
const learningStore = useLearningStore();
const game = useGameStore();
const prob = useProbabilityStore();

function switchLocale(code) {
  if (code === locale.value) return;
  setLocale(code);
  const target = LOCALES.find((item) => item.code === code)?.path ?? '/';
  if (location.pathname !== target) {
    history.pushState(null, '', target);
  }
  updateSeoMeta(code, t);
  trackEvent('locale_switch', { to_locale: code, level: game.level });
}
// 学习模式开关埋点
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
// init SEO on mount (in case locale is en on /en/)
watch(locale, (v) => updateSeoMeta(v, t));
const seoHowToPlay = computed(() => tm('seo.howToPlay'));
const seoChartBullets = computed(() => tm('seo.chartBullets'));
const seoProgressSteps = computed(() => tm('seo.progressSteps'));
const seoGuideLinks = computed(() => tm('seo.guides'));
const faqItems = computed(() => tm('faq.items'));

onMounted(() => {
  game.doStart(null);
  updateSeoMeta(locale.value, t);
});
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
        <details class="brand-switcher">
          <summary>{{ t('seo.guidesTitle') }}</summary>
          <div class="brand-switcher-panel">
            <a v-for="(item, idx) in seoGuideLinks" :key="idx" :href="item.href">{{ item.label }}</a>
          </div>
        </details>
        <details class="brand-switcher">
          <summary>{{ LOCALES.find((item) => item.code === locale)?.label }}</summary>
          <div class="brand-switcher-panel">
            <a
              v-for="item in LOCALES"
              :key="item.code"
              :href="item.path"
              :aria-current="item.code === locale ? 'page' : undefined"
              @click.prevent="switchLocale(item.code)"
            >
              {{ item.label }}
              <small v-if="item.code === locale">✓</small>
            </a>
          </div>
        </details>
        <BrandSiteSwitcher />
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-ghost btn-sm px-2">
            {{ t(`header.levels.${game.level}`) }}
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
                  v-model="game.level"
                  :value="key"
                  :disabled="key === 'Custom'"
                  @change="game.onLevelChange(key)"
                />
                <span>
                <i class="bi mr-2" :class="game.level === key ? 'bi-check-lg' : 'bi-blank'" /> {{ t(`header.levels.${key}`) }}
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
          <span class="w-24 sm:w-32 text-sm">{{ t('toolbar.mines', { count: game.bombNumber - game.flagged }) }}</span>
          <button
            type="button"
            class="btn btn-sm btn-outline bg-white text-slate-800 border-slate-300 start-button"
            @click="(e) => game.doStart(e)"
          >
            <template v-if="game.isSuccess">😊</template>
            <template v-else-if="game.isFailed">😭</template>
            <template v-else>🎮</template>
          </button>
          <span class="w-24 sm:w-32 text-right text-sm font-mono">{{ formatTime(game.timeCount) }}</span>
        </div>
      </div>
      <!-- 右侧：提示 + 学习模式（对齐高级难度游戏区右缘） -->
      <div class="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
        <button class="btn btn-xs sm:btn-sm btn-warning" @click="prob.handleHint" :disabled="!game.isRealStart || !prob.probabilities.size">{{ t('toolbar.hint') }}</button>
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
  <div v-if="game.grid" id="stage" :class="{'pointer-events-none': !game.isStart}" :style="game.gridStyle" @contextmenu.stop.prevent>
    <grid-item
      v-for="(item, index) in game.grid"
      :ref="(el) => game.setGridItemRef(el, index)"
      :key="index"
      :count="item.count"
      :is-bomb="item.isBomb"
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
    <p class="text-sm leading-7 opacity-80 mb-6" v-html="t('seo.chartHint')"></p>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('seo.progressTitle') }}</h2>
    <ol class="list-decimal ps-5 text-sm leading-7 opacity-80 mb-6">
      <li v-for="(item, idx) in seoProgressSteps" :key="idx" v-html="item"></li>
    </ol>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('seo.guidesTitle') }}</h2>
    <ul class="list-disc ps-5 text-sm leading-7 mb-6">
      <li v-for="(item, idx) in seoGuideLinks" :key="idx">
        <a class="link link-hover" :href="item.href">{{ item.label }}</a>
      </li>
    </ul>

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
