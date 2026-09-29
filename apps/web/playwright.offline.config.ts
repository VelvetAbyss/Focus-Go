import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

// Run against a built web bundle: Vite's dev server does not install the production worker.
export default defineConfig(baseConfig, {
  testMatch: /offline-recovery\.pwa\.ts/,
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm exec -- vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
})
