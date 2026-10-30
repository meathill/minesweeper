<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t, tm } = useI18n();

const features = computed(() => tm('unblockedContent.features') || []);
const faqItems = computed(() => tm('unblockedContent.faqItems') || []);
const guideLinks = computed(() => {
  const all = tm('seo.guides') || [];
  return all.filter((item) => !item.href?.includes('/unblocked'));
});
</script>

<template>
  <section class="container mx-auto max-w-3xl px-4 py-10 mt-6 border-t border-base-300">
    <h2 class="text-2xl font-bold mb-3">{{ t('unblockedContent.title') }}</h2>
    <p class="text-sm leading-7 opacity-80 mb-6">{{ t('unblockedContent.lede') }}</p>

    <h3 class="text-xl font-bold mt-8 mb-3">{{ t('unblockedContent.featuresTitle') }}</h3>
    <ul class="list-disc ps-5 text-sm leading-7 opacity-80 mb-6">
      <li v-for="(item, idx) in features" :key="idx">
        <strong>{{ item.title }}</strong>：{{ item.desc }}
      </li>
    </ul>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('unblockedContent.networkTitle') }}</h2>
    <p class="text-sm leading-7 opacity-80 mb-6">{{ t('unblockedContent.networkDesc') }}</p>

    <h2 class="text-xl font-bold mt-8 mb-3">{{ t('unblockedContent.guidesTitle') }}</h2>
    <ul class="list-disc ps-5 text-sm leading-7 mb-6">
      <li v-for="(item, idx) in guideLinks" :key="idx">
        <a class="link link-hover" :href="item.href">{{ item.label }}</a>
      </li>
    </ul>

    <div class="text-xs opacity-60 mt-8">{{ t('seo.keywords') }}</div>
  </section>

  <!-- Unblocked 专属 FAQ：解决免安装、网络环境与免右键插旗痛点 -->
  <section id="unblocked-faq" class="container mx-auto max-w-3xl px-4 py-8 mt-2">
    <h2 class="text-xl font-bold mb-4">{{ t('unblockedContent.faqTitle') }}</h2>
    <div class="space-y-4 text-sm leading-7">
      <div
        v-for="(item, idx) in faqItems"
        :key="idx"
        class="bg-base-100 border border-base-300 rounded-box p-4"
      >
        <h3 class="font-semibold">{{ item.q }}</h3>
        <p class="opacity-80 mt-1">{{ item.a }}</p>
      </div>
    </div>
  </section>
</template>

