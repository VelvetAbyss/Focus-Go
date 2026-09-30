import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'local-parity.smoke.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 45_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5198', locale: 'zh-CN' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5198 --strictPort',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: !process.env.CI,
  },
})
