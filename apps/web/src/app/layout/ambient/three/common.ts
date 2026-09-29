import { Mesh, OrthographicCamera, PlaneGeometry, ShaderMaterial, WebGLRenderer } from 'three'
import type { SceneSignals } from '../scenes/types'

/**
 * Backgrounds are seen through frosted glass (22px blur) and in narrow
 * gutters, so they render below device resolution and are upscaled by CSS.
 */
export const RENDER_SCALE = 0.7

export const createAmbientRenderer = (canvas: HTMLCanvasElement) => {
  try {
    const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'default' })
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * RENDER_SCALE
    renderer.setPixelRatio(dpr)
    renderer.setSize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight), false)
    return { renderer, dpr }
  } catch {
    return null
  }
}

export const disposeRenderer = (renderer: WebGLRenderer) => {
  renderer.dispose()
  renderer.forceContextLoss()
}

/** A full-screen quad for a fragment-shader painting. */
export const fullscreen = (material: ShaderMaterial) => {
  const geometry = new PlaneGeometry(2, 2)
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  return { mesh, geometry, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) }
}

export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/** Hash, value noise and fbm shared by every scene (all original code). */
export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
`

/** Effective loudness (0..1) of a noise track, 0 when it's off. */
export const trackLevel = (signals: SceneSignals, id: keyof SceneSignals['noise']) =>
  signals.noise[id].enabled ? signals.noise[id].volume : 0

/** Eases a value toward a target at a frame-rate independent rate. */
export const approach = (current: number, target: number, dtMs: number, perSecond: number) =>
  current + (target - current) * (1 - Math.exp((-dtMs / 1000) * perSecond))

/**
 * On-screen size of the canvas. The shell is drawn through CSS zoom, so this
 * (the space pointer coordinates live in) differs from clientWidth/Height (the
 * space the GL buffer is sized in). Aspect ratios agree; positions don't.
 */
export const viewportOf = (canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect()
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }
}

/** Resizes the GL buffer to the canvas's layout size. */
export const fitRenderer = (renderer: WebGLRenderer, canvas: HTMLCanvasElement) => {
  const width = Math.max(1, canvas.clientWidth)
  const height = Math.max(1, canvas.clientHeight)
  renderer.setSize(width, height, false)
  return { width, height }
}
