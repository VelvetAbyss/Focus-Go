import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: 'desk-models.spec.ts', workers: 1,
  timeout: 45_000, reporter: 'list',
  outputDir: '.artifacts/desk-playwright',
  use: { baseURL: 'http://127.0.0.1:4615', viewport: { width: 1600, height: 1000 },
    channel: 'chromium', launchOptions: { args: [process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm exec -- vite --host 127.0.0.1 --port 4615 --strictPort', url: 'http://127.0.0.1:4615', reuseExistingServer: !process.env.CI },
})
