// Both are emitted as local build assets. The large WASM is fetched only when a pack is installed.
import wasmURL from '../../../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm?url'
import mjsURL from '../../../../../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs?url'

export { wasmURL, mjsURL }

// Cache.put only accepts HTTP(S) request keys. The fetched asset itself can use any app scheme.
// These are storage keys, never request destinations.
export const runtimeCacheKey = (url: string) => `https://focusgo.invalid/translation-runtime/3.8.1${new URL(url, 'https://focusgo.invalid').pathname}`
