import type { SceneRuntime } from './types'

// Deterministic stream used when session variation is disabled. Any fixed
// 32-bit constant works — this one is the golden-ratio hash mix.
const FIXED_SEED = 0x9e3779b9

// mulberry32: tiny, fast, well-distributed seeded PRNG returning [0, 1).
// Statistically interchangeable with Math.random() for procedural visuals,
// but reproducible given a seed.
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Seeded PRNG (0..1) for a scene's procedural variation. Call this once in a
 * scene's `init` and use the returned function instead of `Math.random()`.
 *
 * - session variation ON  → seeded from `runtime.seed` (the per-tab session
 *   seed): stable within a browser session, fresh on reload.
 * - session variation OFF → seeded from a fixed constant: every reload and
 *   every scene switch reproduces the exact same variation.
 */
export const makeSceneRng = (runtime: SceneRuntime): (() => number) => {
  const seed = runtime.prefs.sessionVariation
    ? (runtime.seed * 0x1_0000_0000) >>> 0
    : FIXED_SEED
  return mulberry32(seed)
}
