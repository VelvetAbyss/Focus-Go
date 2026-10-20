// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installPacks, readyPacks, removePack } from './offline'
import { MODEL_CACHE, MODEL_PACKS, RUNTIME_CACHE, modelURL } from './translation'

const stores = new Map<string, Map<string, Response>>()
beforeEach(() => {
  stores.clear()
  vi.stubGlobal('caches', {
    open: async (name: string) => {
      const data = stores.get(name) ?? new Map<string, Response>()
      stores.set(name, data)
      return { match: async (url: string) => data.get(url)?.clone(), put: async (url: string, response: Response) => data.set(url, response), delete: async (url: string) => data.delete(url) }
    },
  })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
})
afterEach(() => vi.unstubAllGlobals())

describe('offline language pack lifecycle', () => {
  it('uses HTTP storage keys even when the actual asset uses a custom app scheme', async () => {
    const { runtimeCacheKey } = await import('./offlineAssets')
    expect(runtimeCacheKey('tauri://localhost/assets/runtime.wasm')).toBe('https://focusgo.invalid/translation-runtime/3.8.1/assets/runtime.wasm')
    expect(runtimeCacheKey('/assets/runtime.wasm')).toBe(runtimeCacheKey('tauri://localhost/assets/runtime.wasm'))
  })

  it('only reports a pack ready when the shared runtime and every exact-size model file are cached', async () => {
    expect(await readyPacks()).toEqual([])
    const runtime = await caches.open(RUNTIME_CACHE)
    const { mjsURL, wasmURL, runtimeCacheKey } = await import('./offlineAssets')
    await runtime.put(runtimeCacheKey(mjsURL), new Response('runtime'))
    await runtime.put(runtimeCacheKey(wasmURL), new Response('wasm'))
    const cache = await caches.open(MODEL_CACHE)
    const pack = MODEL_PACKS[0]
    for (const file of pack.files) {
      await cache.put(modelURL(pack, file.path), new Response('test', { headers: { 'x-focusgo-bytes': String(file.bytes) } }))
    }
    expect(await readyPacks()).toEqual([pack.id])
    await cache.put(modelURL(pack, pack.files[0].path), new Response('truncated', { headers: { 'x-focusgo-bytes': '1' } }))
    expect(await readyPacks()).toEqual([])
  })

  it('does not mark incomplete downloads ready and can remove a selected language pack', async () => {
    const pack = MODEL_PACKS[0]
    const cache = await caches.open(MODEL_CACHE)
    await cache.put(modelURL(pack, pack.files[0].path), new Response('partial'))
    expect(await readyPacks()).toEqual([])
    await removePack(pack)
    expect(await cache.match(modelURL(pack, pack.files[0].path))).toBeUndefined()
  })

  it('honors cancellation before downloading anything', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(installPacks([MODEL_PACKS[0]], controller.signal, () => {})).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
