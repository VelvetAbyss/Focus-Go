import { mjsURL, wasmURL, runtimeCacheKey } from './offlineAssets'
import { MAX_TEXT_LENGTH, MODEL_CACHE, RUNTIME_CACHE, modelRoute, sentenceChunks, translateParagraphs, type Language } from './translation'

const scope = globalThis as unknown as {
  postMessage: (message: unknown) => void
  onmessage: (event: MessageEvent<{ text: string; source: Language; target: Language }>) => void
}

globalThis.addEventListener('unhandledrejection', event => {
  event.preventDefault()
  scope.postMessage({ kind: 'error' })
})

scope.onmessage = async ({ data }) => {
  try {
    const { env, pipeline } = await import('@huggingface/transformers')
    const [modelCache, runtimeCache] = await Promise.all([caches.open(MODEL_CACHE), caches.open(RUNTIME_CACHE)])
    const wasm = await runtimeCache.match(runtimeCacheKey(wasmURL))
    const factory = await runtimeCache.match(runtimeCacheKey(mjsURL))
    if (!wasm || !factory) throw new Error('Missing runtime')
    const factoryURL = URL.createObjectURL(new Blob([await factory.text()], { type: 'text/javascript' }))
    const binaryURL = URL.createObjectURL(new Blob([await wasm.arrayBuffer()], { type: 'application/wasm' }))
    env.allowLocalModels = false
    env.allowRemoteModels = true // Cached remote URL keys; fetch below is strictly cache-only.
    env.useBrowserCache = false
    env.useFSCache = false
    env.useCustomCache = true
    env.customCache = modelCache
    env.backends.onnx.wasm!.numThreads = 1
    env.backends.onnx.wasm!.proxy = false
    // Supplying both local object URLs also gives Emscripten a locateFile override.
    // wasmBinary alone would still resolve a relative WASM path against a blob: module URL.
    env.backends.onnx.wasm!.wasmPaths = { mjs: factoryURL, wasm: binaryURL }

    // A missing optional model file must never trigger an outbound request during inference.
    // Model downloads live in installPacks; they cannot happen implicitly here.
    const localFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('blob:')) return localFetch(input, options)
      return (await modelCache.match(url)) ?? (await runtimeCache.match(url)) ?? new Response(null, { status: 404 })
    }

    let text = data.text
    const route = modelRoute(data.source, data.target)
    for (let step = 0; step < route.length; step++) {
      const pack = route[step]
      const translator = await pipeline('translation', pack.model, {
        revision: pack.revision, device: 'wasm', dtype: 'q8',
      })
      const sentences = new Map<string, string>()
      try {
        text = await translateParagraphs(text, pack.id.split('-')[1] as Language, async chunk => {
          if (sentences.has(chunk)) return sentences.get(chunk)!
          // v3 accepts partial generation options at runtime but declares a complete GenerationConfig.
          const result = await translator(chunk, { max_new_tokens: 384, num_beams: 1 } as Parameters<typeof translator>[1])
          const first = Array.isArray(result) ? result[0] : result
          if (!first || !('translation_text' in first)) throw new Error('Invalid translation')
          const translated = first.translation_text as string
          sentences.set(chunk, translated)
          return translated
        }, new AbortController().signal, (done, total) => {
          scope.postMessage({ kind: 'progress', done: step * total + done, total: route.length * total })
        }, step === 0 ? MAX_TEXT_LENGTH : Math.max(MAX_TEXT_LENGTH, text.length), sentenceChunks)
      } finally { await translator.dispose() }
    }
    scope.postMessage({ kind: 'result', text })
  } catch {
    scope.postMessage({ kind: 'error' })
  }
}
