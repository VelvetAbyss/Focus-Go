import type { SceneRuntime, SceneSignals, SceneStrategy, SceneTheme } from '../scenes/types'
import type { AmbientThreeModule, AmbientThreeScene } from './types'

/** A frame step long enough for eased values to settle; scenes skip random events on it. */
export const SETTLE_MS = 8000

/**
 * Adapts a lazily imported three.js scene to the stage's synchronous
 * SceneStrategy contract. three.js loads on first use of a scene, never in
 * the entry chunk; until it arrives the backdrop's CSS gradient shows. If the
 * import fails or WebGL can't start, the scene's 2D canvas version takes over
 * on the same canvas.
 */
export const createThreeStrategy = (
  load: () => Promise<AmbientThreeModule>,
  fallback: () => SceneStrategy,
): SceneStrategy => {
  let canvas: HTMLCanvasElement | null = null
  let scene: AmbientThreeScene | null = null
  let fallbackStrategy: SceneStrategy | null = null
  let disposed = false
  let lastRuntime: SceneRuntime | null = null
  let lastSignals: SceneSignals | null = null

  const sizeFor2d = (target: HTMLCanvasElement) => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const width = Math.max(1, target.clientWidth)
    const height = Math.max(1, target.clientHeight)
    target.width = Math.floor(width * dpr)
    target.height = Math.floor(height * dpr)
    target.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const startFallback = (runtime: SceneRuntime) => {
    if (!canvas || disposed || fallbackStrategy) return
    fallbackStrategy = fallback()
    sizeFor2d(canvas)
    fallbackStrategy.init(canvas, runtime)
  }

  return {
    kind: 'webgl',
    init(target, runtime) {
      canvas = target
      lastRuntime = runtime
      load()
        .then((mod) => {
          if (disposed) return
          scene = mod.create(target, runtime)
          if (!scene) {
            startFallback(runtime)
            return
          }
          // Draw straight away: with motion reduced the stage ticks only once,
          // and that tick may have happened before three.js arrived. A long
          // step lets every eased value settle, so the still is the full scene.
          if (lastRuntime && lastSignals) scene.frame(SETTLE_MS, lastRuntime, lastSignals)
        })
        .catch((error) => {
          console.error('[ambient] three.js scene failed to load', error)
          startFallback(runtime)
        })
    },
    tick(dtMs, runtime, signals) {
      lastRuntime = runtime
      lastSignals = signals
      if (scene) scene.frame(dtMs, runtime, signals)
      else fallbackStrategy?.tick(dtMs, runtime, signals)
    },
    resize(width, height) {
      if (scene) scene.resize(width, height)
      else if (fallbackStrategy && canvas && lastRuntime) {
        fallbackStrategy.cleanup()
        fallbackStrategy = null
        startFallback(lastRuntime)
      }
    },
    setTheme(theme: SceneTheme) {
      if (scene) scene.setTheme(theme)
      else if (fallbackStrategy && lastRuntime) {
        fallbackStrategy.cleanup()
        fallbackStrategy = null
        startFallback({ ...lastRuntime, theme })
      }
    },
    cleanup() {
      disposed = true
      scene?.dispose()
      scene = null
      fallbackStrategy?.cleanup()
      fallbackStrategy = null
    },
    particleCount() {
      return scene?.particleCount() ?? fallbackStrategy?.particleCount() ?? 0
    },
  }
}
