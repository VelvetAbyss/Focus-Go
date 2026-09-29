import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: /auth-sync\.spec\.ts/,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5178',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
})
