// Contract between a React host (useThreeSurface) and a lazily loaded three.js
// scene module. This file must stay type-only at runtime so importing it never
// pulls three.js into a chunk that didn't ask for it.
import type { WebGLRenderer } from 'three'

export type SurfaceContext = {
  renderer: WebGLRenderer
  /** CSS pixel size of the canvas. */
  width: number
  height: number
  /** Effective device pixel ratio the renderer draws at. */
  dpr: number
  /** True when motion is reduced: the scene should look right as a still. */
  still: boolean
}

export type SurfaceScene<P> = {
  /** New params from the host (React props). Scenes ease toward them in frame(). */
  update(params: P): void
  /**
   * Advance and draw one frame. dt and t are in seconds. In on-demand mode,
   * return true to ask for another frame (an animation is still running).
   */
  frame(dt: number, t: number): void | boolean
  resize(width: number, height: number): void
  dispose(): void
}

export type SceneFactory<P> = (context: SurfaceContext, params: P) => SurfaceScene<P>

export type SurfaceOptions = {
  /** Frame cap. */
  fps?: number
  /** Upper bound on devicePixelRatio. */
  maxDpr?: number
  /** Multiplier on the pixel ratio (backgrounds behind glass can draw at < 1). */
  renderScale?: number
  /** Stable seed for the frame drawn when motion is reduced. */
  stillTime?: number
  /**
   * Draw only when something changed (params, size) or while the scene says
   * it is animating; otherwise the canvas holds its last frame at zero cost.
   */
  onDemand?: boolean
}

export type SurfaceHandle<P> = {
  ok: boolean
  setParams(params: P): void
  setFps(fps: number): void
  dispose(): void
}

/** A scene module exports `mount` so the host can lazy-load it with one import(). */
export type SurfaceModule<P> = {
  mount(canvas: HTMLCanvasElement, params: P, options?: SurfaceOptions): SurfaceHandle<P>
}

export type Rgb = [number, number, number]

/** '#rrggbb' → sRGB floats. Colors stay in display space end to end: our shader
 *  materials write gl_FragColor directly, so no color-management round trip. */
export const hex = (value: string): Rgb => {
  const v = value.replace('#', '')
  return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255]
}

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export const isMotionReduced = () => {
  if (typeof document === 'undefined') return false
  if (document.documentElement.dataset.motion === 'reduce') return true
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
