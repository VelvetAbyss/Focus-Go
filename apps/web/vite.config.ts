import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'node:url'

const shouldAnalyzeBundle = process.env.FOCUSGO_BUNDLE_ANALYZE === '1'
const releaseSha = process.env.VITE_RELEASE_SHA || process.env.GITHUB_SHA || 'local'
const swVersion = /^[a-f0-9]{7,40}$/i.test(releaseSha) ? releaseSha : 'local'

// The CDN may retain an older /sw.js after a release. Register a URL unique to
// this build so a new page can always fetch and activate its matching worker.
const versionedServiceWorker = {
  name: 'focusgo-versioned-service-worker',
  apply: 'build' as const,
  transformIndexHtml(html: string) {
    return html.replace('</head>', `<script>if('serviceWorker'in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js?v=${swVersion}',{scope:'/',updateViaCache:'none'}).catch(()=>{})},{once:true})}</script></head>`)
  },
}

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
    mode === 'desktop' ? null : versionedServiceWorker,
    mode === 'desktop' ? null : VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'app-icon-1024.png'],
      manifest: {
        name: 'Focus&go',
        short_name: 'Focus&go',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [{ src: '/app-icon-1024.png', sizes: '1024x1024', type: 'image/png' }],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        // Task reminders by Web Push (public/push-sw.js): shown even with every tab closed.
        importScripts: ['/push-sw.js'],
      },
    }),
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
    exclude: ['node_modules/**', 'focus-go-api/**', '.claude/**', 'e2e/**'],
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
