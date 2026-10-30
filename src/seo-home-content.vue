<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, tm } = useI18n();

const seoHowToPlay = computed(() => tm('seo.howToPlay'));
const seoChartBullets = computed(() => tm('seo.chartBullets'));
const seoProgressSteps = computed(() => tm('seo.progressSteps'));
const seoGuideLinks = computed(() => tm('seo.guides'));
const faqItems = computed(() => tm('faq.items'));
</script>

<template>
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
      <div
        v-for="(item, idx) in faqItems"
        :key="idx"
        class="bg-base-100 border border-base-300 rounded-box p-4"
      >
        <h3 class="font-semibold">{{ item.q }}</h3>
        <p class="opacity-80 mt-1" v-html="item.a"></p>
      </div>
    </div>
  </section>
</template>

