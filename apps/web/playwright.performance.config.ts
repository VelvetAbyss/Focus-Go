import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: /performance-baseline\.spec\.ts/,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5180',
    ...devices['Desktop Chrome'],
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.PERF_PREVIEW === '1'
      ? 'npm run preview -- --host 127.0.0.1 --port 5180 --strictPort'
      : 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
