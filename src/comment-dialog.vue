<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

// 复用 meathill.com 站点，全站统一 postId（决策见计划）
// 参数与官方 generate_integration_code（awesome-comment@0.12.0）对齐
const SITE_ID = '47de2e17a927b9a5b67f6599c26c45d6';
const API_URL = 'https://awesomecomment.org';
const GOOGLE_ID =
  '553490336811-e0lmqt2vkb0nqfc4fbm83lc6mjo4ahbf.apps.googleusercontent.com';
const AUTH_ROOT = 'https://awesomecomment.org/api/site/auth';
const AUTH_PREFIX = 'acSaas';
const POST_ID = 'https://minesweeper.meathill.com';
const AUTH_JS =
  'https://unpkg.com/@roudanio/awesome-auth@0.1.5/dist/awesome-auth.js';
const COMMENT_JS =
  'https://unpkg.com/@roudanio/awesome-comment@0.12.0/dist/awesome-comment.js';

const dialogRef = ref(null);
const commentsRef = ref(null);
let initialized = false;

async function initComment() {
  if (initialized || !commentsRef.value) return;
  initialized = true;
  try {
    // 样式走本地打包（见 src/vendor/awesome-comment.css），不经过 unpkg：
    // unpkg 在部分网络下会 hang 住导致组件永久裸奔，且样式失败无从重试
    const [, authModule, commentModule] = await Promise.all([
      import('./vendor/awesome-comment.css'),
      import(/* @vite-ignore */ AUTH_JS),
      import(/* @vite-ignore */ COMMENT_JS),
    ]);
    const awesomeAuth = authModule.getInstance({
      googleId: GOOGLE_ID,
      root: AUTH_ROOT,
      prefix: AUTH_PREFIX,
    });
    commentModule.default.init(commentsRef.value, {
      apiUrl: API_URL,
      awesomeAuth,
      locale: navigator.language,
      postId: POST_ID,
      siteId: SITE_ID,
    });
  } catch (error) {
    // CDN 被拦截也不影响游戏主链路，降级为保留骨架
    initialized = false;
    console.error('Failed to load Awesome Comment:', error);
  }
}

function open() {
  const dialog = dialogRef.value;
  if (!dialog) return;
  if (!dialog.open) {
    try {
      dialog.showModal();
    } catch {
      dialog.show();
    }
  }
  void initComment();
}

function handleDialogClose() {
  document.body.focus();
}

function handleDialogKeyDown(event) {
  // 评论框打字不被外层吃掉；只隔离传播，不阻止输入与 ESC 原生关闭
  event.stopImmediatePropagation();
}

onMounted(() => {
  dialogRef.value?.addEventListener('close', handleDialogClose);
  dialogRef.value?.addEventListener('keydown', handleDialogKeyDown, {
    capture: true,
  });
});

onUnmounted(() => {
  dialogRef.value?.removeEventListener('close', handleDialogClose);
  dialogRef.value?.removeEventListener('keydown', handleDialogKeyDown, {
    capture: true,
  });
});

defineExpose({ open });
</script>

<template>
  <dialog ref="dialogRef" id="comment-modal" class="modal">
    <div
      class="modal-box max-w-4xl h-[75dvh] max-h-[75dvh] overflow-auto w-11/12"
    >
      <div ref="commentsRef" id="comments" class="container mx-auto px-4 mt-6">
        <div class="flex justify-between mb-2">
          <div class="w-20 h-7 skeleton"></div>
          <div class="w-12 h-7 skeleton"></div>
        </div>
        <div class="h-36 skeleton mb-6"></div>
        <div class="h-20 skeleton mb-4"></div>
        <div class="h-20 skeleton mb-4"></div>
        <div class="h-20 skeleton mb-4"></div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
