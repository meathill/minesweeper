// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// 内容子站：中文在根路径（/guide/...），英文在 /en/ 前缀（/en/guide/...），与游戏 SPA 一致。
// 构建产物输出到本目录 dist/，由根目录 scripts/merge-dist.mjs 并入游戏 SPA 的 dist/。
export default defineConfig({
  site: 'https://minesweeper.meathill.com',
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    plugins: [tailwindcss()],
    // dev 下引用仓库根的 src/solver（游戏与子站共用同一求解器）
    server: {
      fs: {
        allow: ['..'],
      },
    },
  },
});
