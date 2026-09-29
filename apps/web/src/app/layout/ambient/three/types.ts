// Type-only contract for three.js ambient scenes. Nothing here imports three at
// runtime, so the stage (which ships in the entry chunk) can depend on it.
import type { SceneRuntime, SceneSignals, SceneTheme } from '../scenes/types'

export type AmbientThreeScene = {
  frame(dtMs: number, runtime: SceneRuntime, signals: SceneSignals): void
  resize(width: number, height: number): void
  setTheme(theme: SceneTheme): void
  dispose(): void
  particleCount(): number
}

export type AmbientThreeModule = {
  /** Returns null when WebGL is unavailable, so the caller can fall back to 2D. */
  create(canvas: HTMLCanvasElement, runtime: SceneRuntime): AmbientThreeScene | null
}
