import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import { runSurface } from '../../../shared/three/runSurface'
import type { Rgb, SceneFactory, SurfaceModule, SurfaceScene } from '../../../shared/three/surface'
import type { SkyParams } from './skyModel'

// ── Sky ──────────────────────────────────────────────────────────────────────
// One full-screen fragment shader paints gradient, sun, moon, stars, two cloud
// layers, drifting fog and paper grain. Everything is in display (sRGB) space.

const SKY_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const SKY_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uTop, uBottom, uHorizon;
uniform float uHorizonAmt;
uniform vec4 uSun;       // xy position, z visible, w unused
uniform vec3 uSunColor;
uniform vec4 uMoon;      // xy position, z visible, w phase
uniform vec3 uMoonColor;
uniform float uStars;
uniform float uCover;
uniform vec3 uCloudLit, uCloudShade;
uniform float uCloudSpeed;
uniform float uFog;
uniform vec3 uFogColor;
uniform float uFlash;
uniform float uWet;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// A cloud layer: domain-warped fbm, thresholded by cover, lit from above.
vec4 cloudLayer(vec2 p, float speed, float scale, float cover, float seed) {
  vec2 q = p * scale + vec2(uTime * speed + seed, seed * 0.37);
  float warp = fbm(q * 0.6 + vec2(uTime * speed * 0.4, 0.0));
  float n = fbm(q + warp * 1.4);
  float lo = 1.0 - cover;
  float density = smoothstep(lo - 0.02, lo + 0.34, n);
  float body = fbm(q * 1.9 + 7.0);
  float light = clamp(0.25 + body * 0.95 + (vUv.y - 0.5) * 0.35, 0.0, 1.0);
  vec3 col = mix(uCloudShade, uCloudLit, light);
  col += uFlash * vec3(0.52, 0.55, 0.68) * (0.35 + body);
  return vec4(col, density);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Gradient, then the warm band low on the horizon at dawn and dusk.
  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, pow(uv.y, 0.85)));
  col = mix(col, uHorizon, uHorizonAmt * smoothstep(0.62, 0.0, uv.y));

  // Stars: sparse hashed grid, twinkling, fading toward the horizon.
  if (uStars > 0.001) {
    vec2 g = p * 40.0;
    vec2 id = floor(g);
    float h = hash(id);
    vec2 jitter = vec2(hash(id + 1.7), hash(id + 3.1)) - 0.5;
    float d = length(fract(g) - 0.5 - jitter * 0.6);
    float bright = step(0.93, h) * (0.45 + 0.55 * hash(id + 9.2));
    float star = bright * smoothstep(0.11, 0.0, d);
    float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + h * 2.6) + h * 50.0);
    col += star * twinkle * uStars * 1.35 * smoothstep(0.12, 0.7, uv.y) * vec3(0.95, 0.96, 1.0);
  }

  // Sun: disc, two-scale halo and slowly turning rays.
  if (uSun.z > 0.001) {
    vec2 sp = vec2(uSun.x * aspect, uSun.y);
    vec2 dv = p - sp;
    float sd = length(dv);
    float disc = smoothstep(0.066, 0.058, sd);
    // A quiet sun: soft light pooling around the disc, and faint, blurred shafts
    // (many low-contrast ones rather than a few hard lens-flare spokes).
    float halo = exp(-sd * 6.5) * 0.3 + exp(-sd * 20.0) * 0.28;
    float ang = atan(dv.y, dv.x);
    float shafts = noise(vec2(ang * 11.0 + uTime * 0.03, uTime * 0.02)) * noise(vec2(ang * 23.0 - uTime * 0.02, 3.0));
    float rays = smoothstep(0.15, 0.7, shafts) * exp(-sd * 4.2);
    col += uSunColor * uSun.z * (halo + rays * 0.12);
    col = mix(col, uSunColor, uSun.z * disc);
  }

  // Moon: lit disc minus an offset shadow disc; faint earthshine in the dark part.
  if (uMoon.z > 0.001) {
    vec2 mp = vec2(uMoon.x * aspect, uMoon.y);
    float r = 0.052;
    float md = length(p - mp);
    float disc = smoothstep(r, r - 0.004, md);
    float lit = 0.5 - 0.5 * cos(uMoon.w * 6.2831853);           // illuminated fraction
    float dir = uMoon.w < 0.5 ? -1.0 : 1.0;                       // waxing: shadow on the left
    vec2 shadowC = mp + vec2(dir * 2.0 * r * lit, 0.0);
    float shadow = smoothstep(r, r - 0.006, length(p - shadowC));
    float face = disc * (1.0 - shadow * (1.0 - step(0.985, lit)));
    float craters = fbm((p - mp) * 38.0) * 0.18;
    vec3 moonCol = uMoonColor * (0.92 - craters);
    col += uMoonColor * uMoon.z * exp(-md * 9.0) * 0.28;          // halo
    col = mix(col, uMoonColor * 0.16 + col * 0.84, uMoon.z * disc * (1.0 - face) * 0.6);
    col = mix(col, moonCol, uMoon.z * face);
  }

  // Two cloud layers: a slow high one and a faster, denser low one.
  vec4 high = cloudLayer(p, uCloudSpeed * 0.55, 1.1, uCover * 0.85, 11.0);
  vec4 low = cloudLayer(p + vec2(0.0, -0.1), uCloudSpeed, 1.9, uCover, 3.0);
  col = mix(col, high.rgb, high.a * 0.75);
  col = mix(col, low.rgb, low.a * 0.95);

  // Rain darkens the lower sky into a wet haze.
  col = mix(col, uCloudShade, uWet * 0.35 * smoothstep(0.7, 0.0, uv.y));

  // Fog: horizontal bands drifting, thickest near the ground.
  if (uFog > 0.001) {
    float bands = fbm(vec2(p.x * 1.3 + uTime * 0.025, p.y * 4.5 - uTime * 0.01));
    float amount = uFog * (0.45 + 0.55 * bands) * smoothstep(1.15, 0.05, uv.y);
    col = mix(col, uFogColor, clamp(amount, 0.0, 0.92));
  }

  col += uFlash * 0.1;
  col += (hash(uv * uRes + fract(uTime * 7.0) * 31.0) - 0.5) * 0.018;   // paper grain
  gl_FragColor = vec4(col, 1.0);
}
`

// ── Rain ─────────────────────────────────────────────────────────────────────
// Instanced streaks in clip space with a depth attribute: far drops are short,
// thin, faint and slow; near ones long and quick. Wind slants them.

const RAIN_VERTEX = /* glsl */ `
attribute vec4 aSeed;            // x, start y, depth, speed jitter
uniform float uTime;
uniform float uWind;
uniform vec2 uRes;
varying float vAlong;
varying float vAlpha;
void main() {
  float depth = aSeed.z;
  float speed = mix(1.0, 2.5, depth) * (0.85 + 0.3 * aSeed.w);
  float len = mix(0.05, 0.17, depth);
  float y = 1.25 - mod(aSeed.y * 2.7 + uTime * speed, 2.7);
  float slant = uWind * 0.45;
  vec2 dir = normalize(vec2(slant, -1.0));
  vec2 head = vec2(aSeed.x * 1.25 + slant * y * 0.5, y);
  vec2 p = head - dir * position.y * len;
  vec2 side = vec2(-dir.y, dir.x);
  p += side * position.x * (mix(0.7, 1.7, depth) * 2.0 / uRes.x);
  vAlong = position.y;
  vAlpha = mix(0.16, 0.55, depth);
  gl_Position = vec4(p, 0.0, 1.0);
}
`

const RAIN_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
varying float vAlong;
varying float vAlpha;
void main() {
  float a = vAlpha * uIntensity * (1.0 - vAlong) * smoothstep(0.0, 0.12, vAlong + 0.02);
  gl_FragColor = vec4(uColor, a);
}
`

// ── Snow / hail ──────────────────────────────────────────────────────────────

const FLAKE_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uWind;
uniform float uDpr;
uniform float uSpeed;
uniform float uSize;
varying float vAlpha;
void main() {
  float depth = aSeed.z;
  float speed = mix(0.07, 0.26, depth) * (0.8 + 0.4 * aSeed.w) * uSpeed;
  float y = 1.15 - mod(aSeed.y * 2.3 + uTime * speed, 2.3);
  float sway = sin(uTime * (0.5 + aSeed.w) + aSeed.x * 12.0) * mix(0.008, 0.035, depth) / uSpeed;
  float x = aSeed.x * 1.15 + sway + uWind * 0.12 * (1.15 - y);
  gl_Position = vec4(x, y, 0.0, 1.0);
  gl_PointSize = mix(1.3, 4.4, depth * depth) * (0.8 + 0.4 * aSeed.w) * uSize * uDpr;
  vAlpha = mix(0.35, 0.95, depth);
}
`

const FLAKE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d) * vAlpha * uIntensity;
  gl_FragColor = vec4(uColor, a);
}
`

// ── Lightning ────────────────────────────────────────────────────────────────

const BOLT_VERTEX = /* glsl */ `
attribute float aEdge;
varying float vEdge;
void main() {
  vEdge = aEdge;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const BOLT_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uAlpha;
varying float vEdge;
void main() {
  float core = 1.0 - abs(vEdge);
  gl_FragColor = vec4(vec3(0.93, 0.95, 1.0) * (0.6 + core * 0.8), uAlpha * core);
}
`

const MAX_DROPS = 700
const MAX_FLAKES = 420

const randomSeeds = (count: number) => {
  const data = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    data[i * 4] = Math.random() * 2 - 1
    data[i * 4 + 1] = Math.random()
    data[i * 4 + 2] = Math.random() ** 1.6 // more far drops than near ones
    data[i * 4 + 3] = Math.random()
  }
  return data
}

/** Numeric params ease toward their target so day switches cross-fade the sky. */
type Animated = {
  top: Rgb; bottom: Rgb; horizon: Rgb; horizonAmount: number
  sun: [number, number, number]; sunColor: Rgb
  moon: [number, number, number, number]; moonColor: Rgb
  stars: number; cloudCover: number; cloudLit: Rgb; cloudShade: Rgb; cloudSpeed: number
  fog: number; fogColor: Rgb; rain: number; snow: number; hail: number; storm: number; wind: number
  precipColor: Rgb
}

const toAnimated = (p: SkyParams): Animated => ({
  top: [...p.top], bottom: [...p.bottom], horizon: [...p.horizon], horizonAmount: p.horizonAmount,
  sun: [p.sun.x, p.sun.y, p.sun.visible], sunColor: [...p.sun.color],
  moon: [p.moon.x, p.moon.y, p.moon.visible, p.moon.phase], moonColor: [...p.moon.color],
  stars: p.stars, cloudCover: p.cloudCover, cloudLit: [...p.cloudLit], cloudShade: [...p.cloudShade], cloudSpeed: p.cloudSpeed,
  fog: p.fog, fogColor: [...p.fogColor], rain: p.rain, snow: p.snow, hail: p.hail, storm: p.storm, wind: p.wind,
  precipColor: [...p.precipColor],
})

const easeInto = (current: Animated, target: Animated, k: number) => {
  for (const key of Object.keys(target) as (keyof Animated)[]) {
    const to = target[key]
    if (Array.isArray(to)) {
      const goal = to as number[]
      const from = current[key] as number[]
      // The moon phase is a date fact, not something to tween.
      for (let i = 0; i < goal.length; i++) from[i] = key === 'moon' && i === 3 ? goal[i] : from[i] + (goal[i] - from[i]) * k
    } else {
      ;(current[key] as number) += (to - (current[key] as number)) * k
    }
  }
}

const createWeatherSkyScene: SceneFactory<SkyParams> = ({ renderer, width, height, dpr, still }, initial) => {
  let target = toAnimated(initial)
  const state = toAnimated(initial)
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  // Sky
  const skyScene = new Scene()
  const skyUniforms = {
    uRes: { value: new Vector2(width, height) },
    uTime: { value: 0 },
    uTop: { value: new Vector3() },
    uBottom: { value: new Vector3() },
    uHorizon: { value: new Vector3() },
    uHorizonAmt: { value: 0 },
    uSun: { value: [0, 0, 0, 0] },
    uSunColor: { value: new Vector3() },
    uMoon: { value: [0, 0, 0, 0] },
    uMoonColor: { value: new Vector3() },
    uStars: { value: 0 },
    uCover: { value: 0 },
    uCloudLit: { value: new Vector3() },
    uCloudShade: { value: new Vector3() },
    uCloudSpeed: { value: 0 },
    uFog: { value: 0 },
    uFogColor: { value: new Vector3() },
    uFlash: { value: 0 },
    uWet: { value: 0 },
  }
  const skyMaterial = new ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    uniforms: skyUniforms,
    depthTest: false,
    depthWrite: false,
  })
  const skyGeometry = new PlaneGeometry(2, 2)
  skyScene.add(new Mesh(skyGeometry, skyMaterial))

  const fxScene = new Scene()

  // Rain
  const quad = new InstancedBufferGeometry()
  quad.setAttribute('position', new Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3))
  quad.setIndex([0, 1, 2, 0, 2, 3])
  quad.setAttribute('aSeed', new InstancedBufferAttribute(randomSeeds(MAX_DROPS), 4))
  quad.instanceCount = 0
  const rainUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0 },
    uRes: { value: new Vector2(width, height) },
    uColor: { value: new Vector3() },
    uIntensity: { value: 0 },
  }
  const rainMaterial = new ShaderMaterial({
    vertexShader: RAIN_VERTEX,
    fragmentShader: RAIN_FRAGMENT,
    uniforms: rainUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const rain = new Mesh(quad, rainMaterial)
  rain.frustumCulled = false
  fxScene.add(rain)

  // Snow, and hail through the same system at speed
  const flakeGeometry = new BufferGeometry()
  flakeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(MAX_FLAKES * 3), 3))
  flakeGeometry.setAttribute('aSeed', new BufferAttribute(randomSeeds(MAX_FLAKES), 4))
  flakeGeometry.setDrawRange(0, 0)
  const flakeUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0 },
    uDpr: { value: dpr },
    uSpeed: { value: 1 },
    uSize: { value: 1 },
    uColor: { value: new Vector3() },
    uIntensity: { value: 0 },
  }
  const flakeMaterial = new ShaderMaterial({
    vertexShader: FLAKE_VERTEX,
    fragmentShader: FLAKE_FRAGMENT,
    uniforms: flakeUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const flakes = new Points(flakeGeometry, flakeMaterial)
  flakes.frustumCulled = false
  fxScene.add(flakes)

  // Lightning bolt (geometry rebuilt per strike)
  const boltMaterial = new ShaderMaterial({
    vertexShader: BOLT_VERTEX,
    fragmentShader: BOLT_FRAGMENT,
    uniforms: { uAlpha: { value: 0 } },
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  })
  let boltGeometry = new BufferGeometry()
  const bolt = new Mesh(boltGeometry, boltMaterial)
  bolt.frustumCulled = false
  bolt.visible = false
  fxScene.add(bolt)

  let size = { width, height }
  let flash = 0
  let boltAlpha = 0
  let nextStrikeAt = 2 + Math.random() * 3
  const pendingFlashes: { at: number; strength: number }[] = []

  const buildBolt = () => {
    const segments: [number, number][] = []
    let x = 0.15 + Math.random() * 0.6
    let y = 1.05
    segments.push([x, y])
    while (y > -0.35) {
      y -= 0.07 + Math.random() * 0.08
      x += (Math.random() - 0.5) * 0.16
      segments.push([x, y])
    }
    const branchFrom = Math.floor(segments.length * (0.3 + Math.random() * 0.3))
    const branch: [number, number][] = [segments[branchFrom]]
    let bx = segments[branchFrom][0]
    let by = segments[branchFrom][1]
    for (let i = 0; i < 4; i++) {
      by -= 0.06 + Math.random() * 0.05
      bx += 0.04 + Math.random() * 0.07
      branch.push([bx, by])
    }
    const positions: number[] = []
    const edges: number[] = []
    const strip = (points: [number, number][], widthPx: number) => {
      const w = (widthPx * 2) / size.width
      for (let i = 0; i < points.length - 1; i++) {
        const [x0, y0] = points[i]
        const [x1, y1] = points[i + 1]
        const dx = x1 - x0
        const dy = y1 - y0
        const len = Math.hypot(dx, dy) || 1
        const nx = (-dy / len) * w
        const ny = (dx / len) * w * (size.width / size.height)
        positions.push(x0 - nx, y0 - ny, 0, x0 + nx, y0 + ny, 0, x1 + nx, y1 + ny, 0)
        positions.push(x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0)
        edges.push(-1, 1, 1, -1, 1, -1)
      }
    }
    strip(segments, 2.2)
    strip(branch, 1.3)
    boltGeometry.dispose()
    boltGeometry = new BufferGeometry()
    boltGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    boltGeometry.setAttribute('aEdge', new Float32BufferAttribute(edges, 1))
    bolt.geometry = boltGeometry
  }

  const applyUniforms = (t: number) => {
    skyUniforms.uTime.value = t
    skyUniforms.uTop.value.set(...state.top)
    skyUniforms.uBottom.value.set(...state.bottom)
    skyUniforms.uHorizon.value.set(...state.horizon)
    skyUniforms.uHorizonAmt.value = state.horizonAmount
    skyUniforms.uSun.value = [state.sun[0], state.sun[1], state.sun[2], 0]
    skyUniforms.uSunColor.value.set(...state.sunColor)
    skyUniforms.uMoon.value = [...state.moon]
    skyUniforms.uMoonColor.value.set(...state.moonColor)
    skyUniforms.uStars.value = state.stars
    skyUniforms.uCover.value = state.cloudCover
    skyUniforms.uCloudLit.value.set(...state.cloudLit)
    skyUniforms.uCloudShade.value.set(...state.cloudShade)
    skyUniforms.uCloudSpeed.value = state.cloudSpeed
    skyUniforms.uFog.value = state.fog
    skyUniforms.uFogColor.value.set(...state.fogColor)
    skyUniforms.uFlash.value = flash
    skyUniforms.uWet.value = state.rain

    rainUniforms.uTime.value = t
    rainUniforms.uWind.value = state.wind
    rainUniforms.uColor.value.set(...state.precipColor)
    rainUniforms.uIntensity.value = Math.min(1, 0.55 + state.rain * 0.45)
    quad.instanceCount = Math.round(MAX_DROPS * state.rain)

    const flakeAmount = Math.max(state.snow, state.hail)
    flakeUniforms.uTime.value = t
    flakeUniforms.uWind.value = state.wind
    flakeUniforms.uColor.value.set(...state.precipColor)
    flakeUniforms.uIntensity.value = 1
    flakeUniforms.uSpeed.value = state.hail > state.snow ? 5 : 1
    flakeUniforms.uSize.value = state.hail > state.snow ? 0.7 : 1
    flakeGeometry.setDrawRange(0, Math.round(MAX_FLAKES * flakeAmount))

    boltMaterial.uniforms.uAlpha.value = boltAlpha
    bolt.visible = boltAlpha > 0.01
  }

  const strike = (t: number) => {
    const strong = 0.9 + Math.random() * 0.4
    pendingFlashes.push({ at: t, strength: strong }, { at: t + 0.09 + Math.random() * 0.08, strength: strong * 0.55 })
    if (Math.random() < 0.6) {
      buildBolt()
      boltAlpha = 1
    }
    nextStrikeAt = t + (7 - state.storm * 4) * (0.6 + Math.random() * 0.9)
  }

  const scene: SurfaceScene<SkyParams> = {
    update(next) {
      target = toAnimated(next)
    },
    frame(dt, t) {
      easeInto(state, target, still ? 1 : 1 - Math.exp(-dt * 2.6))

      if (!still && state.storm > 0.05) {
        if (t >= nextStrikeAt) strike(t)
        for (let i = pendingFlashes.length - 1; i >= 0; i--) {
          if (t >= pendingFlashes[i].at) {
            flash = Math.max(flash, pendingFlashes[i].strength)
            pendingFlashes.splice(i, 1)
          }
        }
      }
      flash *= Math.exp(-dt * 9)
      boltAlpha *= Math.exp(-dt * 11)

      applyUniforms(t)
      renderer.autoClear = false
      renderer.clear()
      renderer.render(skyScene, camera)
      renderer.render(fxScene, camera)
    },
    resize(w, h) {
      size = { width: w, height: h }
      skyUniforms.uRes.value.set(w, h)
      rainUniforms.uRes.value.set(w, h)
    },
    dispose() {
      skyGeometry.dispose()
      skyMaterial.dispose()
      quad.dispose()
      rainMaterial.dispose()
      flakeGeometry.dispose()
      flakeMaterial.dispose()
      boltGeometry.dispose()
      boltMaterial.dispose()
    },
  }
  return scene
}

export const mount: SurfaceModule<SkyParams>['mount'] = (canvas, params, options) =>
  runSurface(canvas, createWeatherSkyScene, params, options)
