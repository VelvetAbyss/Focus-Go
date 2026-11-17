import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: 'adaptive-dashboard.spec.ts', workers: 1, retries: 0,
  timeout: 180_000, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5416', serviceWorkers: 'block', locale: 'zh-CN', viewport: { width: 1440, height: 900 }, hasTouch: true },
})
