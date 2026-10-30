<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppHeader from './app-header.vue';
import MinesweeperGame from './minesweeper-game.vue';
import SeoHomeContent from './seo-home-content.vue';
import SeoUnblockedContent from './seo-unblocked-content.vue';
import BrandFooter from './brand-footer.vue';
import CommentDialog from './comment-dialog.vue';
import { updateSeoMeta } from './seo-meta.js';

const { t, locale } = useI18n();

const commentDialogRef = ref(null);
const isUnblocked = ref(
  typeof window !== 'undefined' &&
    window.location.pathname.includes('/unblocked'),
);

function openComments() {
  commentDialogRef.value?.open();
}

function updateRouteState() {
  if (typeof window !== 'undefined') {
    isUnblocked.value = window.location.pathname.includes('/unblocked');
  }
}

watch(locale, (code) => {
  updateSeoMeta(code, t);
});

onMounted(() => {
  updateRouteState();
  updateSeoMeta(locale.value, t);
  window.addEventListener('popstate', updateRouteState);
});

onUnmounted(() => {
  window.removeEventListener('popstate', updateRouteState);
});
</script>

<template>
  <AppHeader
    :is-unblocked="isUnblocked"
    @open-comments="openComments"
    @locale-changed="updateRouteState"
  />
  <MinesweeperGame />
  <component :is="isUnblocked ? SeoUnblockedContent : SeoHomeContent" />
  <BrandFooter />
  <CommentDialog ref="commentDialogRef" />
</template>
