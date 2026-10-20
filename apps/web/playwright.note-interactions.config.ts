import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['note-interactions.spec.ts', 'note-block-editing.spec.ts', 'note-to-project-workflow.spec.ts', 'note-editing-quality.spec.ts', 'note-overlay-audit.spec.ts'],
  workers: 1,
  timeout: 90_000,
  reporter: [['list'], ['json', { outputFile: '../../artifacts/note-release-2026-10-20/browser-results.json' }]],
  outputDir: '../../artifacts/note-release-2026-10-20/playwright',
  use: { baseURL: 'http://127.0.0.1:5196', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5196', url: 'http://127.0.0.1:5196', reuseExistingServer: false },
})
