import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, Scene, ShaderMaterial, Vector2, Vector4 } from 'three'
import type { SceneRuntime, SceneSignals, SceneTheme } from '../scenes/types'
import { approach, createAmbientRenderer, disposeRenderer, fitRenderer, fullscreen, FULLSCREEN_VERTEX, GLSL_NOISE, trackLevel } from './common'
import type { AmbientThreeModule, AmbientThreeScene } from './types'

/**
 * Window light: the default desk when no sound scene plays. Sun comes in
 * through a four-by-two window and lands across the paper, with the shadows
 * of leaves outside moving in it. The patch swings with the hour (rightward
 * in the morning, leftward in the evening, longer when the sun is low); at
 * night it is faint moonlight and a desk lamp warms one corner. Now and then
 * a cloud crosses the sun, and dust glints only where the light is.
 */

type Rgb = [number, number, number]

type LightKey = {
  h: number
  /** Desk in shade. */
  desk: string
  /** Colour of the light through the window. */
  sun: string
  strength: number
  lamp: number
  /** Where the sun is in its sweep: 0 morning (light travels right) … 1 evening (left). */
  sweep: number
  /** Half-length of the patch, longer when the light is low. */
  reach: number
}

// Night keys repeat at 0 and 24 so the day wraps without a seam.
const NIGHT_LIGHT: Omit<LightKey, 'h'> = { desk: '#d6d0c6', sun: '#c7d2e8', strength: 0.34, lamp: 0.6, sweep: 0.36, reach: 0.64 }
const LIGHT_KEYS: LightKey[] = [
  { h: 0, ...NIGHT_LIGHT },
  { h: 5.5, desk: '#d9d1c6', sun: '#f2cfae', strength: 0.4, lamp: 0.32, sweep: 0, reach: 0.86 },
  { h: 7.5, desk: '#dbd4c9', sun: '#fff0d6', strength: 0.92, lamp: 0, sweep: 0.12, reach: 0.78 },
  { h: 11, desk: '#dcd8d0', sun: '#fffaf0', strength: 1, lamp: 0, sweep: 0.42, reach: 0.56 },
  { h: 15, desk: '#dbd5ca', sun: '#fff1d8', strength: 1, lamp: 0, sweep: 0.72, reach: 0.62 },
  { h: 17.5, desk: '#d8cebf', sun: '#ffd49c', strength: 0.96, lamp: 0.05, sweep: 0.9, reach: 0.8 },
  { h: 19, desk: '#d5cabd', sun: '#f5b787', strength: 0.52, lamp: 0.32, sweep: 1, reach: 0.9 },
  { h: 20.5, ...NIGHT_LIGHT },
  { h: 24, ...NIGHT_LIGHT },
]

const NIGHT_DARK: Omit<LightKey, 'h'> = { desk: '#151412', sun: '#8ea2c6', strength: 0.5, lamp: 0.72, sweep: 0.36, reach: 0.64 }
const DARK_KEYS: LightKey[] = [
  { h: 0, ...NIGHT_DARK },
  { h: 5.5, desk: '#181613', sun: '#c89c78', strength: 0.5, lamp: 0.42, sweep: 0, reach: 0.86 },
  { h: 7.5, desk: '#1a1815', sun: '#e4cda6', strength: 0.82, lamp: 0, sweep: 0.12, reach: 0.78 },
  { h: 11, desk: '#1b1916', sun: '#e6dfce', strength: 0.86, lamp: 0, sweep: 0.42, reach: 0.56 },
  { h: 15, desk: '#1b1815', sun: '#e6d3ae', strength: 0.86, lamp: 0, sweep: 0.72, reach: 0.62 },
  { h: 17.5, desk: '#1a1612', sun: '#e6ae72', strength: 0.86, lamp: 0.1, sweep: 0.9, reach: 0.8 },
  { h: 19, desk: '#171411', sun: '#cf895b', strength: 0.56, lamp: 0.48, sweep: 1, reach: 0.9 },
  { h: 20.5, ...NIGHT_DARK },
  { h: 24, ...NIGHT_DARK },
]

/** The hour used when the time-of-day option is off: a quiet late morning. */
export const FIXED_HOUR = 10.5

const hexRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export type WindowLightState = {
  desk: Rgb
  sun: Rgb
  strength: number
  lamp: number
  sweep: number
  reach: number
}

/** The light at a fractional local hour (0–24), interpolated between keys. */
export const windowLightAt = (hour: number, theme: SceneTheme): WindowLightState => {
  const keys = theme === 'dark' ? DARK_KEYS : LIGHT_KEYS
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < keys.length - 2 && keys[i + 1].h <= h) i++
  const a = keys[i]
  const b = keys[i + 1]
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h)
  const lerp = (x: number, y: number) => x + (y - x) * t
  const mix = (x: string, y: string): Rgb => {
    const [r0, g0, b0] = hexRgb(x)
    const [r1, g1, b1] = hexRgb(y)
    return [lerp(r0, r1), lerp(g0, g1), lerp(b0, b1)]
  }
  return {
    desk: mix(a.desk, b.desk),
    sun: mix(a.sun, b.sun),
    strength: lerp(a.strength, b.strength),
    lamp: lerp(a.lamp, b.lamp),
    sweep: lerp(a.sweep, b.sweep),
    reach: lerp(a.reach, b.reach),
  }
}

/**
 * The patch as a parallelogram in aspect space (x 0..aspect, y 0..1): its
 * centre and the inverse of its basis, so the shader can map a point into
 * window coordinates (-1..1 across the patch, +x away from the sill).
 */
export const patchGeometry = (sweep: number, reach: number, aspect: number) => {
  const drift = 1 - 2 * sweep // +1 morning … -1 evening
  const len = Math.hypot(drift * 0.9, 0.75)
  const dir: [number, number] = [(drift * 0.9) / len, -0.75 / len]
  const perp: [number, number] = [-dir[1], dir[0]]
  const halfWidth = 0.36
  const skew = 0.22 * drift
  const u: [number, number] = [dir[0] * reach, dir[1] * reach]
  const v: [number, number] = [perp[0] * halfWidth + dir[0] * skew * halfWidth, perp[1] * halfWidth + dir[1] * skew * halfWidth]
  const center: [number, number] = [aspect * 0.5 + drift * 0.1 * aspect + dir[0] * 0.08, 0.5 + dir[1] * 0.08]
  const det = u[0] * v[1] - v[0] * u[1]
  // Column-major mat2 inverse of [u v].
  const inverse: [number, number, number, number] = [v[1] / det, -u[1] / det, -v[0] / det, u[0] / det]
  return { center, inverse }
}

const GLSL_WINDOW = /* glsl */ `
uniform vec2 uPatchC;
uniform vec4 uPatchInv;
uniform float uSoft;

vec2 windowCoords(vec2 p) {
  return mat2(uPatchInv.xy, uPatchInv.zw) * (p - uPatchC);
}

float bar(float d, float halfWidth, float soft) {
  return 1.0 - smoothstep(halfWidth - soft, halfWidth + soft, abs(d));
}

// Sunlight through the glass (0..1) before the leaves take their share.
float windowLight(vec2 w, float soft) {
  // The penumbra widens with distance from the sill.
  float s = soft * (0.55 + 0.95 * clamp(w.x * 0.5 + 0.5, 0.0, 1.0));
  float box = (1.0 - smoothstep(1.0 - s, 1.0 + s, abs(w.x))) * (1.0 - smoothstep(1.0 - s, 1.0 + s, abs(w.y)));
  float mullion = max(bar(w.y, 0.045, s), bar(w.x, 0.035, s));
  float glazing = max(bar(abs(w.x) - 0.5, 0.016, s), bar(abs(w.y) - 0.5, 0.014, s));
  return box * (1.0 - max(mullion * 0.9, glazing * 0.7));
}
`

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uDesk;
uniform vec3 uSun;
uniform float uStrength;
uniform float uGain;
uniform float uLeaf;
uniform float uReach;
uniform float uSway;
uniform float uCloud;
uniform float uLamp;
uniform vec3 uLampColor;
uniform float uDark;
uniform float uSeed;
${GLSL_NOISE}
${GLSL_WINDOW}

// 1 where a leaf or branch outside the window shades this point.
float leaves(vec2 w, float soft, float t) {
  // Back to screen proportions, so leaves stay leaf-shaped; a low sun only
  // draws them out a little along the light.
  float stretch = mix(1.0, 1.45, clamp((uReach - 0.56) / 0.34, 0.0, 1.0));
  vec2 q = vec2(w.x * uReach / stretch, w.y * 0.36) * 4.6 + vec2(uSeed * 13.0, uSeed * 7.0);
  // Boughs sway as a whole in slow gusts; single leaves flutter on top.
  float gust = 0.6 + 0.4 * sin(t * 0.11 + uSeed * 6.0) * sin(t * 0.047 + 1.3);
  q += vec2(sin(t * 0.43 + q.y * 0.9), cos(t * 0.31 + q.x * 0.7)) * 0.05 * uSway * gust;
  float mass = fbm(q * 0.9 + vec2(3.1, 1.7));
  vec2 f = q * 3.4 + vec2(sin(t * 1.3 + q.y * 3.0), cos(t * 1.1 + q.x * 2.0)) * 0.03 * uSway * gust;
  float leaf = vnoise(f) * 0.55 + vnoise(f * 2.1 + 5.0) * 0.3 + vnoise(f * 4.3 + 9.0) * 0.15;
  float canopy = mass * 0.6 + leaf * 0.5;
  // The tree stands off the near, upper side of the window.
  float side = smoothstep(1.3, -0.9, w.x * 0.8 - w.y * 0.5);
  float threshold = 0.7 - uLeaf * 0.22 * (0.35 + side);
  float edge = 0.025 + soft * 0.8 + uCloud * 0.07;
  return smoothstep(threshold - edge, threshold + edge, canopy);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  vec2 w = windowCoords(p);

  // Under a cloud the light goes soft as well as dim.
  float soft = uSoft * (1.0 + uCloud * 1.6);
  float sun = windowLight(w, soft);
  float shade = uLeaf > 0.0 ? leaves(w, soft, uTime) : 0.0;
  float light = sun * (1.0 - shade * 0.8) * uStrength * (1.0 - uCloud * 0.55);
  // Light scatters a little around the patch.
  float reachOut = max(abs(w.x), abs(w.y));
  float halo = (1.0 - smoothstep(0.7, 2.4, reachOut)) * 0.16 * uStrength * (1.0 - uCloud * 0.4);

  // Paper: long soft fibres and a fine tooth.
  vec3 desk = uDesk;
  float fibre = fbm(vec2(p.x * 2.4 + p.y * 0.6, p.y * 22.0) + uSeed * 5.0) - 0.5;
  float tooth = hash12(floor(gl_FragCoord.xy) + uSeed * 91.0) - 0.5;
  desk *= 1.0 + fibre * (0.035 + uDark * 0.03) + tooth * (0.02 + uDark * 0.03);
  vec2 c = vUv - vec2(0.5, 0.55);
  desk *= 1.0 - dot(c, c) * (0.2 + uDark * 0.25);

  vec3 col = desk + uSun * (light + halo) * uGain;

  // A desk lamp off the top-right corner for the evening.
  vec2 lampAt = vec2(aspect * 0.97, 1.06);
  float lamp = exp(-length((p - lampAt) * vec2(0.85, 1.1)) * 2.3) * uLamp;
  col += uLampColor * lamp * uGain * 1.5;

  col += (hash12(gl_FragCoord.xy * 1.7) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const MOTE_VERTEX = /* glsl */ `
attribute vec4 aMote; // phase, speed, size, twinkle
uniform vec2 uRes;
uniform float uTime;
uniform float uStrength;
uniform float uCloud;
uniform float uDpr;
varying float vAlpha;
${GLSL_WINDOW}
void main() {
  float aspect = uRes.x / uRes.y;
  float t = uTime * aMote.y;
  vec2 uv = position.xy + vec2(sin(t * 0.21 + aMote.x) * 0.035 + t * 0.002, t * 0.0045 + sin(t * 0.13 + aMote.x * 2.0) * 0.012);
  uv = fract(uv);
  vec2 w = windowCoords(vec2(uv.x * aspect, uv.y));
  float light = windowLight(w, uSoft);
  float glint = 0.55 + 0.45 * sin(uTime * (0.6 + aMote.w) + aMote.x * 7.0);
  vAlpha = light * glint * uStrength * (1.0 - uCloud * 0.7);
  gl_PointSize = aMote.z * uDpr;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`

const MOTE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uSun;
uniform float uMote;
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float disc = smoothstep(0.5, 0.1, length(d));
  gl_FragColor = vec4(uSun * disc * vAlpha * uMote, 1.0);
}
`

const MOTES = 70
const LAMP: Rgb = [1, 0.74, 0.44]

export const create: AmbientThreeModule['create'] = (canvas, runtime) => {
  const context = createAmbientRenderer(canvas)
  if (!context) return null
  const { renderer, dpr } = context
  renderer.autoClear = false

  let seed = runtime.prefs.sessionVariation ? Math.floor(runtime.seed * 2 ** 31) : 7
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const size = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 }
  let theme: SceneTheme = runtime.theme
  const hourOf = (rt: SceneRuntime, now: Date) =>
    rt.prefs.effects.idle.timeOfDayPalette ? now.getHours() + now.getMinutes() / 60 : FIXED_HOUR
  let state = windowLightAt(hourOf(runtime, new Date()), theme)
  let geometryAt = patchGeometry(state.sweep, state.reach, size.width / size.height)

  const shared = {
    uRes: { value: new Vector2(size.width, size.height) },
    uTime: { value: 0 },
    uPatchC: { value: new Vector2(...geometryAt.center) },
    uPatchInv: { value: new Vector4(...geometryAt.inverse) },
    uSoft: { value: 0.07 },
    uStrength: { value: state.strength },
    uCloud: { value: 0 },
    uSun: { value: [...state.sun] },
  }
  const uniforms = {
    ...shared,
    uDesk: { value: [...state.desk] },
    uGain: { value: theme === 'dark' ? 0.24 : 0.2 },
    uLeaf: { value: 0.8 },
    uReach: { value: state.reach },
    uSway: { value: 1 },
    uLamp: { value: state.lamp },
    uLampColor: { value: LAMP },
    uDark: { value: theme === 'dark' ? 1 : 0 },
    uSeed: { value: runtime.prefs.sessionVariation ? runtime.seed : 0.37 },
  }
  const material = new ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: FRAGMENT, uniforms, depthTest: false, depthWrite: false })
  const { mesh, geometry, camera } = fullscreen(material)
  const scene = new Scene()
  scene.add(mesh)

  const positions: number[] = []
  const motes: number[] = []
  for (let i = 0; i < MOTES; i++) {
    positions.push(rng(), rng(), 0)
    motes.push(rng() * Math.PI * 2, 0.5 + rng() * 1, 1.2 + rng() * 2.2, rng() * 1.4)
  }
  const moteGeometry = new BufferGeometry()
  moteGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  moteGeometry.setAttribute('aMote', new Float32BufferAttribute(motes, 4))
  const moteMaterial = new ShaderMaterial({
    vertexShader: MOTE_VERTEX,
    fragmentShader: MOTE_FRAGMENT,
    uniforms: { ...shared, uDpr: { value: dpr }, uMote: { value: theme === 'dark' ? 0.5 : 0.28 } },
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  })
  const dust = new Points(moteGeometry, moteMaterial)
  dust.frustumCulled = false
  scene.add(dust)

  let time = 0
  // Passing clouds: one every half-minute to minute and a half.
  let cloudStart = -1
  let cloudLength = 0
  let cloudDepth = 0
  let nextCloudAt = 20 + rng() * 40

  const ease = (target: Rgb, into: number[], dtMs: number, rate: number) => {
    for (let i = 0; i < 3; i++) into[i] = approach(into[i], target[i], dtMs, rate)
  }

  const result: AmbientThreeScene = {
    frame(dtMs: number, rt: SceneRuntime, signals: SceneSignals) {
      const dt = dtMs / 1000
      time += dt
      theme = rt.theme
      const effects = rt.prefs.effects.idle
      const settling = dtMs > 1000 // the one-off still for reduced motion

      state = windowLightAt(hourOf(rt, signals.now), theme)
      geometryAt = patchGeometry(state.sweep, state.reach, size.width / size.height)

      let cloud = 0
      if (!settling && effects.slowBreath) {
        if (cloudStart < 0 && time >= nextCloudAt) {
          cloudStart = time
          cloudLength = 12 + rng() * 14
          cloudDepth = 0.55 + rng() * 0.45
        }
        if (cloudStart >= 0) {
          const k = (time - cloudStart) / cloudLength
          if (k >= 1) {
            cloudStart = -1
            nextCloudAt = time + 30 + rng() * 60
          } else {
            cloud = Math.sin(Math.PI * k) ** 2 * cloudDepth
          }
        }
      }

      const wind = trackLevel(signals, 'wind')
      uniforms.uTime.value = time
      ease(state.desk, uniforms.uDesk.value, dtMs, 2.5)
      ease(state.sun, shared.uSun.value, dtMs, 2.5)
      uniforms.uStrength.value = approach(uniforms.uStrength.value, state.strength * signals.intensity, dtMs, 2.5)
      uniforms.uLamp.value = approach(uniforms.uLamp.value, state.lamp, dtMs, 2.5)
      uniforms.uCloud.value = approach(uniforms.uCloud.value, cloud, dtMs, 3)
      uniforms.uSway.value = approach(uniforms.uSway.value, 1 + wind * 1.4, dtMs, 0.8)
      uniforms.uDark.value = approach(uniforms.uDark.value, theme === 'dark' ? 1 : 0, dtMs, 2.5)
      uniforms.uGain.value = approach(uniforms.uGain.value, theme === 'dark' ? 0.24 : 0.2, dtMs, 2.5)
      moteMaterial.uniforms.uMote.value = theme === 'dark' ? 0.5 : 0.28
      uniforms.uReach.value = state.reach
      shared.uPatchC.value.set(...geometryAt.center)
      shared.uPatchInv.value.set(...geometryAt.inverse)

      renderer.clear()
      renderer.render(scene, camera)
    },
    resize() {
      const fitted = fitRenderer(renderer, canvas)
      size.width = fitted.width
      size.height = fitted.height
      shared.uRes.value.set(fitted.width, fitted.height)
    },
    setTheme(next) {
      theme = next
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      moteGeometry.dispose()
      moteMaterial.dispose()
      disposeRenderer(renderer)
    },
    particleCount: () => MOTES,
  }
  return result
}
