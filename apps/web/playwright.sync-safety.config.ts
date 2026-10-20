import base from './playwright.auth-sync.config'
import { defineConfig } from '@playwright/test'
export default defineConfig(base, { grep: /data safety/, use: { ...base.use, actionTimeout: 10000 } })
