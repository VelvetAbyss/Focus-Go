import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Mesh, Scene, ShaderMaterial, Vector2 } from 'three'
import type { SceneRuntime, SceneSignals, SceneTheme } from '../scenes/types'
import { approach, createAmbientRenderer, disposeRenderer, fitRenderer, fullscreen, FULLSCREEN_VERTEX, GLSL_NOISE, trackLevel } from './common'
import type { AmbientThreeModule, AmbientThreeScene } from './types'

/**
 * Stormy night: a rolling deck of storm cloud lit from inside by lightning,
 * sheets of rain slanting with the wind, the odd forked bolt, and — if the
 * wet-ground option is on — the sky smeared back up from the pavement.
 * Thunder volume sets how often it strikes.
 */

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uDark;
uniform float uRain;
uniform float uWind;
uniform float uFlash;
uniform vec2 uFlashPos;
uniform float uFlashRain;
uniform float uReflect;
uniform float uSeed;
${GLSL_NOISE}

vec3 sky(vec2 uv) {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  // A pale band low on the horizon where the storm breaks, darker above.
  vec3 top = mix(vec3(0.42, 0.46, 0.53), vec3(0.018, 0.022, 0.045), uDark);
  vec3 bot = mix(vec3(0.74, 0.75, 0.76), vec3(0.15, 0.12, 0.2), uDark);
  vec3 col = mix(bot, top, smoothstep(0.0, 0.85, uv.y));

  float t = uTime;
  vec2 q = p * vec2(1.15, 1.9) + vec2(t * 0.022 * (1.0 + uWind) + uSeed * 20.0, 0.0);
  float warp = fbm(q * 0.7 + vec2(t * 0.012, 0.0));
  float n = fbm(q + warp * 1.8);
  float density = smoothstep(0.26, 0.7, n);
  // Billows: a slow large-scale light term so the deck has bellies and tops.
  float billow = fbm(q * 0.45 + vec2(-t * 0.006, 3.0));
  float shade = clamp(fbm(q * 1.8 + 4.0) * 0.7 + billow * 0.6 - 0.15, 0.0, 1.0);
  vec3 cloudDark = mix(vec3(0.19, 0.21, 0.26), vec3(0.015, 0.016, 0.035), uDark);
  vec3 cloudLit = mix(vec3(0.6, 0.62, 0.68), vec3(0.23, 0.21, 0.34), uDark);
  vec3 cloud = mix(cloudDark, cloudLit, shade * shade * (3.0 - 2.0 * shade));

  // Lightning lights the cloud from inside, strongest around the strike.
  vec2 fp = vec2(uFlashPos.x * aspect, uFlashPos.y);
  float glow = exp(-length(p - fp) * 2.1) * uFlash;
  cloud += vec3(0.86, 0.87, 1.0) * glow * (0.45 + shade);
  col = mix(col, cloud, density * 0.9 + 0.1);
  col += vec3(0.72, 0.74, 0.92) * uFlash * 0.07;
  return col;
}

float rainLayer(vec2 uv, float scale, float speed, float thick, float seed) {
  float a = uWind * 0.38;
  vec2 r = vec2(uv.x * cos(a) - uv.y * sin(a), uv.x * sin(a) + uv.y * cos(a));
  vec2 p = vec2(r.x * scale * uRes.x / uRes.y, r.y * scale * 0.08 + uTime * speed);
  float h = hash12(vec2(floor(p.x), seed));
  float y = fract(p.y + h * 17.0);
  float streak = step(0.52, h) * smoothstep(0.0, 0.08, y) * smoothstep(0.6, 0.0, y);
  return streak * smoothstep(thick, 0.0, abs(fract(p.x) - 0.5));
}

void main() {
  vec2 uv = vUv;
  vec3 col = sky(uv);

  if (uReflect > 0.5 && uv.y < 0.2) {
    float ripple = (vnoise(vec2(uv.x * 40.0, uv.y * 70.0 - uTime * 2.2)) - 0.5) * 0.012;
    vec3 mirrored = sky(vec2(uv.x + ripple, 0.4 - uv.y)) * 0.6;
    col = mix(col, mirrored, smoothstep(0.2, 0.1, uv.y) * 0.8);
  }

  float rain = rainLayer(uv, 50.0, 1.25, 0.12, 3.0) * 0.7
             + rainLayer(uv, 90.0, 1.8, 0.18, 1.0) * 0.55
             + rainLayer(uv, 150.0, 2.6, 0.22, 2.0) * 0.35;
  vec3 rainColor = mix(vec3(0.86, 0.89, 0.93), vec3(0.56, 0.59, 0.72), uDark);
  col += rainColor * rain * uRain * 0.3 * (1.0 + uFlash * 3.0 * uFlashRain);

  gl_FragColor = vec4(col, 1.0);
}
`

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
  gl_FragColor = vec4(vec3(0.9, 0.92, 1.0) * (0.55 + core * 0.8), uAlpha * core);
}
`

type Rng = () => number

const buildBolt = (rng: Rng, startX: number, startY: number, width: number, height: number) => {
  const main: [number, number][] = [[startX, startY]]
  let x = startX
  let y = startY
  while (y > -0.75) {
    y -= 0.06 + rng() * 0.07
    x += (rng() - 0.5) * 0.12
    main.push([x, y])
  }
  const branches: [number, number][][] = []
  for (let b = 0; b < 2; b++) {
    const from = main[Math.floor(main.length * (0.2 + rng() * 0.45))]
    const branch: [number, number][] = [from]
    let bx = from[0]
    let by = from[1]
    const dir = rng() < 0.5 ? -1 : 1
    for (let i = 0; i < 5; i++) {
      by -= 0.05 + rng() * 0.05
      bx += dir * (0.03 + rng() * 0.05)
      branch.push([bx, by])
    }
    branches.push(branch)
  }
  const positions: number[] = []
  const edges: number[] = []
  const strip = (points: [number, number][], px: number) => {
    const w = (px * 2) / width
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i]
      const [x1, y1] = points[i + 1]
      const len = Math.hypot(x1 - x0, y1 - y0) || 1
      const nx = (-(y1 - y0) / len) * w
      const ny = ((x1 - x0) / len) * w * (width / height)
      positions.push(x0 - nx, y0 - ny, 0, x0 + nx, y0 + ny, 0, x1 + nx, y1 + ny, 0)
      positions.push(x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x1 - nx, y1 - ny, 0)
      edges.push(-1, 1, 1, -1, 1, -1)
    }
  }
  strip(main, 2.6)
  branches.forEach((branch) => strip(branch, 1.4))
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aEdge', new Float32BufferAttribute(edges, 1))
  return geometry
}

export const create: AmbientThreeModule['create'] = (canvas, runtime) => {
  const context = createAmbientRenderer(canvas)
  if (!context) return null
  const { renderer } = context
  renderer.autoClear = false

  let seed = runtime.prefs.sessionVariation ? Math.floor(runtime.seed * 2 ** 31) : 42
  const rng: Rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const size = { width: canvas.clientWidth || 1, height: canvas.clientHeight || 1 }
  const uniforms = {
    uRes: { value: new Vector2(size.width, size.height) },
    uTime: { value: 0 },
    uDark: { value: runtime.theme === 'dark' ? 1 : 0 },
    uRain: { value: 0.6 },
    uWind: { value: 0.3 },
    uFlash: { value: 0 },
    uFlashPos: { value: new Vector2(0.5, 0.7) },
    uFlashRain: { value: 1 },
    uReflect: { value: 0 },
    uSeed: { value: runtime.prefs.sessionVariation ? runtime.seed : 0.21 },
  }
  const material = new ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: FRAGMENT, uniforms, depthTest: false, depthWrite: false })
  const { mesh, geometry, camera } = fullscreen(material)
  const scene = new Scene()
  scene.add(mesh)

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
  const boltScene = new Scene()
  boltScene.add(bolt)

  let theme: SceneTheme = runtime.theme
  let time = 0
  let flash = 0
  let boltAlpha = 0
  let nextStrikeAt = 3 + rng() * 4
  let secondFlashAt = -1
  let purplePending = false

  const strike = (rt: SceneRuntime, thunder: number) => {
    const x = 0.2 + rng() * 0.6
    const y = 0.58 + rng() * 0.3
    uniforms.uFlashPos.value.set(x, y)
    flash = 0.85 + rng() * 0.35
    secondFlashAt = time + 0.09 + rng() * 0.1
    if (rng() < 0.65) {
      boltGeometry.dispose()
      boltGeometry = buildBolt(rng, x * 2 - 1, y * 2 - 1 + 0.08, size.width, size.height)
      bolt.geometry = boltGeometry
      boltAlpha = 1
    }
    rt.emit({ type: 'shell-shake', magnitude: 3 + rng() * 2.5, durationMs: 260 + rng() * 180 })
    purplePending = true
    nextStrikeAt = time + (6 + rng() * 9) * (1 - thunder * 0.55)
  }

  const result: AmbientThreeScene = {
    frame(dtMs: number, rt: SceneRuntime, signals: SceneSignals) {
      const dt = dtMs / 1000
      time += dt
      theme = rt.theme
      const effects = rt.prefs.effects.stormyNight
      const rain = trackLevel(signals, 'rain')
      const wind = trackLevel(signals, 'wind')
      const thunder = trackLevel(signals, 'thunder')
      const intensity = signals.intensity

      const settling = dtMs > 1000 // the one-off still for reduced motion
      if (!settling && intensity > 0.3 && time >= nextStrikeAt) strike(rt, thunder)
      if (secondFlashAt > 0 && time >= secondFlashAt) {
        flash = Math.max(flash, 0.5 + rng() * 0.3)
        secondFlashAt = -1
      }
      flash *= Math.exp(-dt * 5.5)
      boltAlpha *= Math.exp(-dt * 9)
      if (purplePending && flash < 0.05) {
        rt.emit({ type: 'shell-purple-flash', intensity: 0.4 })
        purplePending = false
      }

      uniforms.uTime.value = time
      uniforms.uDark.value = approach(uniforms.uDark.value, theme === 'dark' ? 1 : 0, dtMs, 2.5)
      uniforms.uRain.value = approach(uniforms.uRain.value, (0.45 + rain * 0.55) * intensity, dtMs, 1.5)
      uniforms.uWind.value = approach(uniforms.uWind.value, 0.25 + wind * 0.6, dtMs, 0.8)
      uniforms.uFlash.value = flash
      uniforms.uFlashRain.value = effects.lightningFlashOnRain ? 1 : 0
      uniforms.uReflect.value = effects.wetGroundReflection ? 1 : 0
      boltMaterial.uniforms.uAlpha.value = boltAlpha
      bolt.visible = boltAlpha > 0.01

      renderer.clear()
      renderer.render(scene, camera)
      if (bolt.visible) renderer.render(boltScene, camera)
    },
    resize() {
      const fitted = fitRenderer(renderer, canvas)
      size.width = fitted.width
      size.height = fitted.height
      uniforms.uRes.value.set(fitted.width, fitted.height)
    },
    setTheme(next) {
      theme = next
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      boltGeometry.dispose()
      boltMaterial.dispose()
      disposeRenderer(renderer)
    },
    particleCount: () => 0,
  }
  return result
}
