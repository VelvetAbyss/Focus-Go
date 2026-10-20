import { mjsURL, wasmURL, runtimeCacheKey } from './offlineAssets'
import {
  MODEL_CACHE, MODEL_PACKS, RUNTIME_CACHE, TranslationError, modelRoute, modelURL,
  type Language, type ModelPack,
} from './translation'

export type DownloadProgress = { loaded: number; total: number }
const absoluteURL = (url: string) => new URL(url, window.location.href).href

export async function readyPacks(): Promise<string[]> {
  if (!globalThis.caches) return []
  try {
    const [models, runtime] = await Promise.all([caches.open(MODEL_CACHE), caches.open(RUNTIME_CACHE)])
    if (!await runtime.match(runtimeCacheKey(wasmURL)) || !await runtime.match(runtimeCacheKey(mjsURL))) return []
    const ready = await Promise.all(MODEL_PACKS.map(async pack => {
      for (const file of pack.files) {
        const cached = await models.match(modelURL(pack, file.path))
        if (!cached || Number(cached.headers.get('x-focusgo-bytes')) !== file.bytes) return null
      }
      return pack.id
    }))
    return ready.filter((id): id is string => id !== null)
  } catch { return [] }
}

export async function installPacks(
  packs: ModelPack[], signal: AbortSignal, onProgress: (progress: DownloadProgress) => void,
) {
  if (!globalThis.caches || !window.isSecureContext) throw new TranslationError('storage')
  let modelCache: Cache
  let runtimeCache: Cache
  try {
    [modelCache, runtimeCache] = await Promise.all([caches.open(MODEL_CACHE), caches.open(RUNTIME_CACHE)])
  } catch { throw new TranslationError('storage') }
  // The optional language pack download is also the explicit download of its shared runtime.
  const files = [
    { url: absoluteURL(wasmURL), key: runtimeCacheKey(wasmURL), bytes: 0, cache: runtimeCache },
    { url: absoluteURL(mjsURL), key: runtimeCacheKey(mjsURL), bytes: 0, cache: runtimeCache },
    ...packs.flatMap(pack => pack.files.map(file => ({ url: modelURL(pack, file.path), key: modelURL(pack, file.path), bytes: file.bytes, cache: modelCache }))),
  ]
  let total = files.reduce((sum, file) => sum + file.bytes, 0)
  let loaded = 0
  let lastProgress = 0
  for (const file of files) {
    signal.throwIfAborted()
    const existing = await file.cache.match(file.key)
    if (existing && (!file.bytes || Number(existing.headers.get('x-focusgo-bytes')) === file.bytes)) {
      loaded += file.bytes
      onProgress({ loaded, total })
      continue
    }
    let response: Response
    try {
      response = await fetch(file.url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    } catch (error) {
      if (signal.aborted) throw error
      throw new TranslationError('download')
    }
    if (!response.ok || !response.body) throw new TranslationError('download')
    const expected = file.bytes || Number(response.headers.get('content-length')) || 0
    if (!file.bytes) total += expected
    const reader = response.body.getReader()
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let size = 0
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      chunks.push(value)
      if (Date.now() - lastProgress > 100) {
        onProgress({ loaded: loaded + size, total })
        lastProgress = Date.now()
      }
    }
    if (!size || (file.bytes && file.bytes !== size)) throw new TranslationError('download')
    signal.throwIfAborted()
    try {
      await file.cache.put(file.key, new Response(new Blob(chunks), {
        headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream', 'x-focusgo-bytes': String(size) },
      }))
    } catch { throw new TranslationError('storage') }
    loaded += size
    onProgress({ loaded, total: Math.max(total, loaded) })
  }
  // Request persistence after an explicit download. A denial must not be misreported as failure.
  try { await navigator.storage?.persist?.() } catch { /* Cache remains usable, though evictable. */ }
}

export async function removePack(pack: ModelPack) {
  const cache = await caches.open(MODEL_CACHE)
  await Promise.all(pack.files.map(file => cache.delete(modelURL(pack, file.path))))
}

/** Every request gets a fresh worker: Cancel immediately stops CPU work and releases model memory. */
export async function translateOffline(
  text: string, source: Language, target: Language, signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  if (source === target) return text
  const route = modelRoute(source, target)
  const ready = await readyPacks()
  signal.throwIfAborted()
  if (route.some(pack => !ready.includes(pack.id))) throw new TranslationError('missing-pack')
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./translation.worker.ts', import.meta.url), { type: 'module' })
    const finish = () => { worker.terminate(); signal.removeEventListener('abort', abort) }
    const abort = () => { finish(); reject(new DOMException('Aborted', 'AbortError')) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    worker.onerror = () => { finish(); reject(new TranslationError('runtime')) }
    worker.onmessage = ({ data }: MessageEvent<{ kind: string; text?: string; done?: number; total?: number }>) => {
      if (data.kind === 'progress') { onProgress?.(data.done!, data.total!); return }
      finish()
      if (data.kind === 'result' && typeof data.text === 'string') resolve(data.text)
      else reject(new TranslationError('runtime'))
    }
    worker.postMessage({ text, source, target })
  })
}
