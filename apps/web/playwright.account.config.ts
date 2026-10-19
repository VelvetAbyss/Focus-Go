import { defineConfig, devices } from '@playwright/test'
export default defineConfig({ testDir: './e2e', testMatch: 'account-center.spec.ts', workers: 1, retries: 0, timeout: 120_000, expect: { timeout: 15_000 }, reporter: 'list', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5186', actionTimeout: 15_000, serviceWorkers: 'block', trace: 'retain-on-failure' } })
