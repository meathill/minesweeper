<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { version } from '../package.json';
import CossDropdown from './coss-dropdown.vue';
import BrandSiteSwitcher from './brand-site-switcher.vue';
import { Levels } from './data';
import { useGameStore } from './store/gameStore';
import { LOCALES, updateSeoMeta } from './seo-meta.js';
import { setLocale } from './i18n.js';
import { trackEvent } from './analytics.js';

const props = defineProps({
  isUnblocked: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['open-comments', 'locale-changed']);

const { t, tm, locale } = useI18n();
const game = useGameStore();

const seoGuideLinks = computed(() => tm('seo.guides'));

function switchLocale(code, closeFn) {
  closeFn?.();
  if (code === locale.value) return;
  setLocale(code);
  const basePath = LOCALES.find((item) => item.code === code)?.path ?? '/';
  const target = props.isUnblocked
    ? code === 'zh'
      ? '/unblocked/'
      : `/${code}/unblocked/`
    : basePath;
  if (location.pathname !== target) {
    history.pushState(null, '', target);
  }
  updateSeoMeta(code, t);
  trackEvent('locale_switch', { to_locale: code, level: game.level });
  emit('locale-changed', code);
}

function getLocaleHref(item) {
  if (props.isUnblocked) {
    return item.code === 'zh' ? '/unblocked/' : `/${item.code}/unblocked/`;
  }
  return item.path;
}

function selectLevel(key, closeFn) {
  if (key === 'Custom') return;
  game.level = key;
  game.onLevelChange(key);
  closeFn?.();
}
</script>

<template>
  <header class="navbar bg-base-200">
    <div class="container mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 py-1">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <a class="brand-studio" href="https://meathill.com">Meathill Studio</a>
        <span aria-hidden="true" class="brand-divider"></span>
        <h1 class="text-lg sm:text-xl font-bold truncate">{{ t('header.title') }}</h1>
        <span class="text-xs opacity-60 whitespace-nowrap shrink-0">v{{ version }}</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end shrink-0">
        <CossDropdown :label="t('seo.guidesTitle')" panel-class="coss-dropdown-wide">
          <template #default="{ close }">
            <a
              v-for="(item, idx) in seoGuideLinks"
              :key="idx"
              class="coss-dropdown-item"
              :href="item.href"
              @click="close"
            >
              <span>{{ item.label }}</span>
            </a>
          </template>
        </CossDropdown>
        <CossDropdown :label="LOCALES.find((item) => item.code === locale)?.label">
          <template #default="{ close }">
            <a
              v-for="item in LOCALES"
              :key="item.code"
              class="coss-dropdown-item"
              :href="getLocaleHref(item)"
              :aria-current="item.code === locale ? 'page' : undefined"
              @click.prevent="switchLocale(item.code, close)"
            >
              <span>{{ item.label }}</span>
              <span v-if="item.code === locale" class="coss-dropdown-check" aria-hidden="true">✓</span>
            </a>
          </template>
        </CossDropdown>
        <BrandSiteSwitcher />
        <button
          type="button"
          id="comment-toggle"
          class="coss-header-btn"
          :aria-label="t('header.comment')"
          :title="t('header.comment')"
          @click="emit('open-comments')"
        >
          <i class="bi bi-chat-dots" aria-hidden="true"></i>
          <span class="hidden sm:inline">{{ t('header.comment') }}</span>
        </button>
        <CossDropdown :label="t(`header.levels.${game.level}`)">
          <template #default="{ close }">
            <button
              v-for="(item, key) in Levels"
              :key="key"
              type="button"
              class="coss-dropdown-item"
              :class="{ 'is-active': game.level === key }"
              :disabled="key === 'Custom'"
              @click="selectLevel(key, close)"
            >
              <span>{{ t(`header.levels.${key}`) }}</span>
              <span v-if="game.level === key" class="coss-dropdown-check" aria-hidden="true">✓</span>
            </button>
          </template>
        </CossDropdown>
      </div>
    </div>
  </header>
</template>

