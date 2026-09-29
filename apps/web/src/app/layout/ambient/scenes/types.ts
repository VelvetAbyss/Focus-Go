import type {
  AmbientPreferences,
} from '../../../../features/focus/ambientPreferences'
import type { NoiseSettings } from '../../../../data/models/types'

export type SceneTheme = 'light' | 'dark'

export type SceneId =
  | 'idle'
  | 'window-light'
  | 'rainy-cafe'
  | 'stormy-night'
  | 'ocean-breeze'
  | 'cozy-fireside'

export type SceneNoiseLevels = Pick<
  NoiseSettings['tracks'],
  'cafe' | 'fireplace' | 'rain' | 'wind' | 'thunder' | 'ocean'
>

export type SceneSignals = {
  /** Current noise track levels — read each frame. */
  noise: SceneNoiseLevels
  /** Master noise volume 0..1; multiplies into effective track loudness. */
  masterVolume: number
  /** Cursor position over the shell, in CSS pixels. inside=false when offscreen. */
  cursor: { x: number; y: number; inside: boolean }
  /** 0..1 intensity ramp on scene enter (1 = full strength). */
  intensity: number
  /** Real local time when this frame ran. */
  now: Date
}

export type SceneRuntime = {
  theme: SceneTheme
  prefs: AmbientPreferences
  /** Session-stable random seed (0..1) for procedural variation. */
  seed: number
  /** Emit a shell-wide signal (thunder shake, warm flicker pulse). Side-effect channel. */
  emit: (signal: SceneEmittedSignal) => void
}

export type SceneEmittedSignal =
  | { type: 'shell-shake'; magnitude: number; durationMs: number }
  | { type: 'shell-warm-tint'; intensity: number }
  | { type: 'shell-purple-flash'; intensity: number }

export type SceneStrategy = {
  /**
   * '2d' (default): the stage sizes the canvas, sets the DPR transform and
   * rebuilds the strategy on resize, theme change and wake.
   * 'webgl': the strategy owns its GL context; the stage hands it a fresh
   * canvas on init and calls resize()/setTheme() instead of rebuilding.
   */
  kind?: '2d' | 'webgl'
  init(canvas: HTMLCanvasElement, runtime: SceneRuntime): void
  tick(dtMs: number, runtime: SceneRuntime, signals: SceneSignals): void
  cleanup(): void
  particleCount(): number
  resize?(width: number, height: number): void
  setTheme?(theme: SceneTheme): void
}
