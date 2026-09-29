import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, Scene, ShaderMaterial, Vector2 } from 'three'
import type { SceneRuntime, SceneSignals, SceneTheme } from '../scenes/types'
import { approach, createAmbientRenderer, disposeRenderer, fitRenderer, fullscreen, FULLSCREEN_VERTEX, GLSL_NOISE, trackLevel } from './common'
import type { AmbientThreeModule, AmbientThreeScene } from './types'

/**
 * Cozy fireside: a fire low in the frame lighting the room, heat shimmer above
 * it, embers rising and drifting apart as they cool. Options add the logs, a
 * few smoke wisps, and bursts of sparks in step with the fireplace sound.
 */

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uDark;
uniform float uFire;
uniform float uFlicker;
uniform float uLogs;
uniform float uSmoke;
uniform float uSeed;
${GLSL_NOISE}

vec3 fireRamp(float f) {
  vec3 c = mix(vec3(0.0), vec3(0.55, 0.08, 0.02), smoothstep(0.0, 0.22, f));
  c = mix(c, vec3(1.0, 0.44, 0.08), smoothstep(0.2, 0.5, f));
  c = mix(c, vec3(1.0, 0.7, 0.26), smoothstep(0.48, 0.78, f));
  c = mix(c, vec3(1.0, 0.95, 0.82), smoothstep(0.8, 1.0, f));
  return c;
}

float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  float t = uTime;
  vec2 p = (uv - vec2(0.5, 0.0)) * vec2(aspect, 1.0);

  // Heat shimmer above the flames.
  float shimmer = smoothstep(0.75, 0.15, uv.y) * smoothstep(0.55, 0.0, abs(p.x));
  uv.x += (vnoise(vec2(uv.y * 28.0 - t * 3.0, t * 0.7)) - 0.5) * 0.006 * shimmer * uFire;

  // The room, warmed by the fire.
  vec3 top = mix(vec3(0.91, 0.87, 0.81), vec3(0.06, 0.04, 0.035), uDark);
  vec3 bot = mix(vec3(0.83, 0.72, 0.6), vec3(0.16, 0.09, 0.06), uDark);
  vec3 col = mix(bot, top, smoothstep(0.0, 1.0, uv.y));
  float dist = length(p * vec2(0.8, 1.2));
  float glow = exp(-dist * 2.0) * uFlicker * uFire;
  col += vec3(1.0, 0.5, 0.18) * glow * mix(0.35, 0.75, uDark);
  col += vec3(1.0, 0.55, 0.2) * exp(-dist * 6.0) * uFlicker * uFire * 0.25;

  // Hearth: the fireplace opening is dark, which is what lets a fire glow —
  // in a bright room especially.
  float hearth = smoothstep(0.52, 0.18, length((p - vec2(0.0, 0.08)) * vec2(0.8, 1.2)));
  col = mix(col, col * mix(0.42, 0.4, uDark), hearth);

  // Logs first, so the flames burn in front of them.
  if (uLogs > 0.5) {
    float d = min(
      capsule(p, vec2(-0.24, 0.036), vec2(0.2, 0.074), 0.027),
      capsule(p, vec2(-0.18, 0.078), vec2(0.26, 0.03), 0.024)
    );
    vec3 wood = mix(vec3(0.22, 0.14, 0.1), vec3(0.04, 0.025, 0.02), uDark);
    float body = smoothstep(0.003, -0.003, d);
    float ember = smoothstep(0.007, 0.0, abs(d)) * (0.5 + 0.5 * vnoise(vec2(p.x * 40.0, t * 2.0)));
    col = mix(col, wood, body * 0.94);
    col += vec3(1.0, 0.36, 0.08) * ember * uFire * 0.7;
  }

  // Flames: two layers of upward-flowing noise in a tall teardrop envelope.
  // Fire is light: its cool outer edge adds to the room (mixing it in painted
  // a dark halo round the flames); only the hot core covers what's behind.
  vec2 fp = p * vec2(1.7, 1.0);
  float n1 = fbm(vec2(fp.x * 3.0 + uSeed * 7.0, fp.y * 2.3 - t * 1.35));
  float n2 = fbm(vec2(fp.x * 6.0 + 3.0, fp.y * 4.2 - t * 2.2));
  float envelope = 1.0 - smoothstep(0.0, 0.46, length(vec2(fp.x * 1.15, max(fp.y - 0.02, 0.0) * 0.52)));
  float f = clamp(envelope * (n1 * 1.35 + n2 * 0.55) - fp.y * 0.9, 0.0, 1.0) * uFire;
  vec3 fire = fireRamp(f) * (0.85 + 0.3 * uFlicker);
  col += fire * smoothstep(0.02, 0.5, f) * 1.1;
  col = mix(col, fire, smoothstep(0.5, 0.85, f));

  // Smoke: faint wisps rising and spreading above the flames.
  if (uSmoke > 0.5) {
    vec2 sp = vec2(p.x * 2.2 + sin(uv.y * 3.0 + t * 0.3) * 0.25, uv.y * 3.0 - t * 0.22);
    float wisp = smoothstep(0.55, 0.85, fbm(sp)) * smoothstep(0.25, 0.6, uv.y) * smoothstep(1.0, 0.55, uv.y) * smoothstep(0.7, 0.0, abs(p.x));
    col = mix(col, mix(vec3(0.62, 0.58, 0.55), vec3(0.3, 0.27, 0.26), uDark), wisp * 0.35);
  }

  gl_FragColor = vec4(col, 1.0);
}
`

const EMBER_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uDpr;
uniform float uBurst;
uniform float uAspect;
varying float vLife;
varying float vHeat;
void main() {
  float depth = aSeed.z;
  float speed = mix(0.12, 0.32, aSeed.w) * (1.0 + uBurst * 0.8);
  float life = fract(aSeed.y + uTime * speed * 0.4);
  float y = -1.0 + life * 1.9;
  float spread = (aSeed.x - 0.5) * (0.12 + life * 0.7) / uAspect;
  float drift = sin(uTime * (0.8 + aSeed.w * 1.4) + aSeed.x * 20.0) * 0.03 * life;
  gl_Position = vec4(spread + drift, y, 0.0, 1.0);
  gl_PointSize = mix(1.2, 3.4, depth) * uDpr * (1.0 - life * 0.5);
  vLife = life;
  vHeat = 1.0 - life;
}
`

const EMBER_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uIntensity;
varying float vLife;
varying float vHeat;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * smoothstep(0.0, 0.08, vLife) * smoothstep(1.0, 0.55, vLife) * uIntensity;
  vec3 hot = vec3(1.0, 0.78, 0.4);
  vec3 cool = vec3(0.95, 0.3, 0.08);
  gl_FragColor = vec4(mix(cool, hot, vHeat) * a, a);
}
`

const MAX_EMBERS = 520

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

  const width = canvas.clientWidth || 1
  const height = canvas.clientHeight || 1
  const uniforms = {
    uRes: { value: new Vector2(width, height) },
    uTime: { value: 0 },
    uDark: { value: runtime.theme === 'dark' ? 1 : 0 },
    uFire: { value: 0.3 },
    uFlicker: { value: 1 },
    uLogs: { value: 1 },
    uSmoke: { value: 0 },
    uSeed: { value: runtime.prefs.sessionVariation ? runtime.seed : 0.5 },
  }
  const material = new ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: FRAGMENT, uniforms, depthTest: false, depthWrite: false })
  const { mesh, geometry, camera } = fullscreen(material)
  const scene = new Scene()
  scene.add(mesh)

  const seeds = new Float32Array(MAX_EMBERS * 4)
  for (let i = 0; i < MAX_EMBERS; i++) {
    seeds[i * 4] = rng()
    seeds[i * 4 + 1] = rng()
    seeds[i * 4 + 2] = rng() ** 1.5
    seeds[i * 4 + 3] = rng()
  }
  const emberGeometry = new BufferGeometry()
  emberGeometry.setAttribute('position', new BufferAttribute(new Float32Array(MAX_EMBERS * 3), 3))
  emberGeometry.setAttribute('aSeed', new BufferAttribute(seeds, 4))
  const emberUniforms = {
    uTime: { value: 0 },
    uDpr: { value: dpr / 0.7 }, // sizes are authored in CSS pixels at full resolution
    uBurst: { value: 0 },
    uAspect: { value: width / height },
    uIntensity: { value: 1 },
  }
  const emberMaterial = new ShaderMaterial({
    vertexShader: EMBER_VERTEX,
    fragmentShader: EMBER_FRAGMENT,
    uniforms: emberUniforms,
    transparent: true,
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  })
  const embers = new Points(emberGeometry, emberMaterial)
  embers.frustumCulled = false
  const emberScene = new Scene()
  emberScene.add(embers)

  let theme: SceneTheme = runtime.theme
  let time = 0
  let burst = 0
  let nextBurstAt = 1.5
  let nextWarmAt = 0.3
  let visibleEmbers = 0

  const result: AmbientThreeScene = {
    frame(dtMs: number, rt: SceneRuntime, signals: SceneSignals) {
      const dt = dtMs / 1000
      time += dt
      theme = rt.theme
      const effects = rt.prefs.effects.cozyFireside
      const fire = trackLevel(signals, 'fireplace')
      const intensity = signals.intensity

      // Flicker: layered slow and quick wobble, never a strobe.
      const flicker = 0.82 + Math.sin(time * 1.7) * 0.06 + Math.sin(time * 4.3 + 1.3) * 0.05 + Math.sin(time * 11.1) * 0.03
      const settling = dtMs > 1000 // the one-off still for reduced motion
      if (!settling && effects.globalWarmFlicker && time >= nextWarmAt) {
        const strength = 0.4 + rng() * 0.6
        rt.emit({ type: 'shell-warm-tint', intensity: strength * (0.5 + fire * 0.5) })
        nextWarmAt = time + (280 + rng() * (rng() > 0.7 ? 1400 : 480)) / 1000
      }
      if (!settling && effects.crackleSparkSync && time >= nextBurstAt) {
        burst = 0.6 + rng() * 0.4 * (0.4 + fire)
        nextBurstAt = time + (0.8 + rng() * 2.4) / (0.5 + fire)
      }
      burst *= Math.exp(-dt * 2.2)

      uniforms.uTime.value = time
      uniforms.uDark.value = approach(uniforms.uDark.value, theme === 'dark' ? 1 : 0, dtMs, 2.5)
      uniforms.uFire.value = approach(uniforms.uFire.value, (0.8 + fire * 0.25) * intensity, dtMs, 1.5)
      uniforms.uFlicker.value = flicker
      uniforms.uLogs.value = effects.logSilhouette ? 1 : 0
      uniforms.uSmoke.value = effects.smokeWisps ? 1 : 0

      visibleEmbers = Math.round(Math.min(MAX_EMBERS, (110 + fire * 180 + burst * 220) * intensity))
      emberGeometry.setDrawRange(0, visibleEmbers)
      emberUniforms.uTime.value = time
      emberUniforms.uBurst.value = burst
      emberUniforms.uIntensity.value = mix01(0.55, 1, uniforms.uDark.value)

      renderer.clear()
      renderer.render(scene, camera)
      renderer.render(emberScene, camera)
    },
    resize() {
      const fitted = fitRenderer(renderer, canvas)
      uniforms.uRes.value.set(fitted.width, fitted.height)
      emberUniforms.uAspect.value = fitted.width / fitted.height
    },
    setTheme(next) {
      theme = next
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      emberGeometry.dispose()
      emberMaterial.dispose()
      disposeRenderer(renderer)
    },
    particleCount: () => visibleEmbers,
  }
  return result
}

const mix01 = (a: number, b: number, t: number) => a + (b - a) * t
