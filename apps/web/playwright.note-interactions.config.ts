import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['note-interactions.spec.ts', 'note-block-editing.spec.ts', 'note-to-project-workflow.spec.ts'],
  workers: 1,
  reporter: [['list'], ['json', { outputFile: '../../artifacts/note-release-2026-10-14/browser-results.json' }]],
  outputDir: '../../artifacts/note-release-2026-10-14/playwright',
  use: { baseURL: 'http://127.0.0.1:5190', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5190', url: 'http://127.0.0.1:5190', reuseExistingServer: true },
})
