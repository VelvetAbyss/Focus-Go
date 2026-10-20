import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Parallel preview/test servers must never rewrite a live server's prebundles. */
export const isolatedDevCache = (): Plugin => ({
  name: 'focusgo-isolated-dev-cache',
  config(config, { command, mode }) {
    if (command !== 'serve' || config.cacheDir) return
    const namespace = mode.replace(/[^a-z0-9_-]/gi, '-')
    return {
      cacheDir: resolve(config.root ?? process.cwd(), 'node_modules/.vite', `serve-${namespace}-${config.server?.port ?? 5174}`),
    }
  },
})
