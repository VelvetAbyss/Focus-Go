import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'optimization.smoke.spec.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 30_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://focusgo-smoke.localhost:5198', locale: 'en-US', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 5198 --strictPort', url: 'http://127.0.0.1:5198', reuseExistingServer: false },
})
