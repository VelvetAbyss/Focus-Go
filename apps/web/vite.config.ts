import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'node:url'

const shouldAnalyzeBundle = process.env.FOCUSGO_BUNDLE_ANALYZE === '1'

// Injects the platform implementation behind `virtual:platform`:
//   - desktop build (`--mode desktop`) → the Tauri bridge in apps/desktop
//   - any other build → null (web app falls back to its no-op webPlatform)
// This keeps the web source/bundle free of any desktop/Tauri code.
const platformInjection = (mode: string) => {
  const VIRTUAL = 'virtual:platform'
  const RESOLVED = '\0virtual:platform'
  const desktopImpl = fileURLToPath(new URL('../desktop/src/tauriPlatform.ts', import.meta.url))
  return {
    name: 'focusgo-platform-injection',
    resolveId(id: string) {
      if (id === VIRTUAL) return RESOLVED
    },
    load(id: string) {
      if (id !== RESOLVED) return undefined
      return mode === 'desktop'
        ? `export { default } from ${JSON.stringify(desktopImpl)}`
        : 'export default null'
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    platformInjection(mode),
    shouldAnalyzeBundle
      ? visualizer({
          filename: 'dist/bundle-stats.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
        })
      : null,
  ],
  test: {
    exclude: ['focus-go-api/**', '.claude/**', 'e2e/**'],
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 10000,
  },
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@focus-go/db-contracts': fileURLToPath(new URL('../../packages/db-contracts/src/index.ts', import.meta.url)),
    },
  },
  build: {
    modulePreload: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/dexie')) {
            return 'vendor-dexie'
          }
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-ui'
          }
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-date-fns'
          }
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'vendor-motion'
          }
          if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror') || id.includes('node_modules/@tiptap/pm')) {
            return 'vendor-editor'
          }
        },
      },
    },
  },
}))
