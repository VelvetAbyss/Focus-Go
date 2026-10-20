import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveConfig } from 'vite'
import { isolatedDevCache } from '../../tooling/devCache'

const config = (port: number, mode = 'development', cacheDir?: string, command: 'serve' | 'build' = 'serve') => resolveConfig({
  configFile: false,
  mode,
  root: process.cwd(),
  cacheDir,
  server: { port },
  plugins: [isolatedDevCache()],
}, command)

describe('development dependency cache isolation', () => {
  it('gives the live preview and browser tests separate cache directories', async () => {
    const live = await config(5174)
    const test = await config(5188)
    expect(live.cacheDir).toBe(resolve('node_modules/.vite/serve-development-5174'))
    expect(test.cacheDir).toBe(resolve('node_modules/.vite/serve-development-5188'))
    expect(live.cacheDir).not.toBe(test.cacheDir)
  })

  it('isolates desktop and test modes even when their port is the same', async () => {
    const web = await config(5174)
    const desktop = await config(5174, 'desktop')
    const test = await config(5174, 'test')
    expect(new Set([web.cacheDir, desktop.cacheDir, test.cacheDir]).size).toBe(3)
  })

  it('honors an explicit cache directory and leaves production builds unchanged', async () => {
    expect((await config(5174, 'development', 'node_modules/.custom-cache')).cacheDir).toBe(resolve('node_modules/.custom-cache'))
    expect((await config(5174, 'production', undefined, 'build')).cacheDir).not.toContain('serve-')
  })
})
