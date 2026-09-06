import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
  },
  webServer: {
    // 固定 5199：5173 常被本机其他项目占用
    command: 'pnpm exec vite --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
