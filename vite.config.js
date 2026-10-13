import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import {
  applyGoogleAnalytics,
  readGoogleAnalyticsId,
} from './scripts/google-analytics.mjs';

const GAME_LOCALES = ['en', 'es', 'ru', 'vi', 'de'];

function googleAnalyticsPlugin() {
  let measurementId = '';
  let root = process.cwd();
  let outDir = 'dist';

  function patchFile(file) {
    if (!existsSync(file)) return;
    const html = readFileSync(file, 'utf8');
    const next = applyGoogleAnalytics(html, measurementId);
    if (next !== html) writeFileSync(file, next);
  }

  return {
    name: 'inject-google-analytics',
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
      measurementId = readGoogleAnalyticsId();
      console.log(
        measurementId
          ? 'GA 已注入'
          : 'GA 未注入：NEXT_PUBLIC_GOOGLE_ANALYTICS_ID 未设置',
      );
    },
    transformIndexHtml(html) {
      return applyGoogleAnalytics(html, measurementId);
    },
    closeBundle() {
      for (const code of GAME_LOCALES) {
        patchFile(path.join(outDir, code, 'index.html'));
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          next();
          return;
        }
        const url = req.url?.split('?')[0] ?? '';
        const match = url.match(/^\/(en|es|ru|vi|de)(?:\/(?:index\.html)?)?$/);
        if (!match) {
          next();
          return;
        }
        const file = path.join(root, 'public', match[1], 'index.html');
        if (!existsSync(file)) {
          next();
          return;
        }
        const html = applyGoogleAnalytics(
          readFileSync(file, 'utf8'),
          measurementId,
        );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(req.method === 'HEAD' ? undefined : html);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), vue(), googleAnalyticsPlugin()],
  // ensure /en/ serves same SPA in dev and preview
  appType: 'spa',
});
