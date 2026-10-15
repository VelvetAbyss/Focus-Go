import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: ['typography-system.spec.ts'], workers: 1,
  reporter: [['list'], ['json', { outputFile: '../../artifacts/typography-system-2026-10-15/browser-results.json' }]],
  outputDir: '../../artifacts/typography-system-2026-10-15/traces',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5191', trace: 'retain-on-failure' },
})
