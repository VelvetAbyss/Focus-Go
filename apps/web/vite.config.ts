import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@focus-go/db-contracts': fileURLToPath(new URL('../../packages/db-contracts/src/index.ts', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
  },
})
