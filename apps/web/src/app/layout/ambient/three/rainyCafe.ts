import { Scene, ShaderMaterial, Vector2, Vector3 } from 'three'
import type { SceneRuntime, SceneSignals, SceneTheme } from '../scenes/types'
import { approach, createAmbientRenderer, disposeRenderer, fitRenderer, fullscreen, FULLSCREEN_VERTEX, GLSL_NOISE, trackLevel, viewportOf } from './common'
import type { AmbientThreeModule, AmbientThreeScene } from './types'

/**
 * Rainy café: looking out of a café window. The street behind the glass is out
 * of focus — shop and car lights as bokeh, their smears on the wet road — and
 * the glass in front carries beads that grow and evaporate plus the odd drop
 * sliding down, clearing a trail. Every drop refracts the street behind it.
 * The pointer wipes the glass clear around it.
 */

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uDark;
uniform float uRain;
uniform float uGlow;
uniform float uDrops;
uniform float uHaze;
uniform float uPasser;
uniform float uSeed;
uniform vec3 uCursor;
${GLSL_NOISE}

vec3 lightColor(float h) {
  if (h < 0.45) return vec3(1.0, 0.64, 0.30);   // amber: café windows, street lamps
  if (h < 0.70) return vec3(1.0, 0.86, 0.66);   // warm white
  if (h < 0.88) return vec3(0.96, 0.42, 0.33);  // tail lights
  return vec3(0.38, 0.78, 0.74);                // one cool sign across the road
}

vec3 street(vec2 uv) {
  float aspect = uRes.x / uRes.y;
  vec3 top = mix(vec3(0.60, 0.66, 0.72), vec3(0.045, 0.06, 0.11), uDark);
  vec3 bot = mix(vec3(0.80, 0.76, 0.71), vec3(0.17, 0.12, 0.10), uDark);
  vec3 col = mix(bot, top, smoothstep(0.05, 0.95, uv.y));

  // Buildings across the street: darker blurred masses in the middle band.
  float skyline = 0.62 + 0.08 * vnoise(vec2(uv.x * 5.0 + uSeed * 9.0, 1.0));
  col = mix(col, col * mix(0.84, 0.58, uDark), smoothstep(skyline, skyline - 0.1, uv.y) * 0.65);

  float strength = mix(0.3, 0.95, uDark) * uGlow;
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    vec2 h = hash22(vec2(fi * 1.37, uSeed * 17.0 + 3.0));
    vec2 pos = vec2(h.x * 1.1 - 0.05, 0.14 + h.y * 0.48);
    pos.x += sin(uTime * 0.04 * (0.4 + h.y) + fi) * 0.015;
    float r = mix(0.035, 0.1, hash12(vec2(fi, 5.1)));
    float d = length((uv - pos) * vec2(aspect, 1.0));
    float disk = smoothstep(r, r * 0.78, d);
    float rim = smoothstep(r * 0.7, r * 0.96, d) * disk;
    float flicker = 0.8 + 0.2 * sin(uTime * (0.25 + h.x * 0.6) + fi * 3.1);
    col += lightColor(hash12(vec2(fi, 9.3))) * (disk * 0.22 + rim * 0.1) * flicker * strength;
  }

  // The wet road mirrors the lights as long vertical smears.
  float wet = smoothstep(0.24, 0.0, uv.y);
  float smear = vnoise(vec2(uv.x * 28.0 + uSeed * 5.0, uv.y * 1.6 - uTime * 0.04));
  col += vec3(1.0, 0.62, 0.32) * wet * smoothstep(0.35, 0.9, smear) * 0.35 * strength;

  // Now and then someone walks past under an umbrella.
  if (uPasser > 0.5) {
    float cycle = fract(uTime / 46.0 + uSeed);
    float px = -0.25 + cycle * 1.5;
    float bodyX = abs(uv.x - px) * aspect;
    float body = smoothstep(0.045, 0.0, bodyX) * smoothstep(0.52, 0.34, uv.y) * smoothstep(0.02, 0.12, uv.y);
    float umbrella = smoothstep(0.1, 0.0, length((uv - vec2(px, 0.54)) * vec2(aspect * 0.75, 2.8)));
    col *= 1.0 - (body * 0.32 + umbrella * 0.38);
  }

  // Rain beyond the glass: faint, fast streaks.
  vec2 rp = vec2(uv.x * aspect * 90.0, uv.y * 2.4 + uTime * 1.9);
  float rh = hash12(vec2(floor(rp.x), 7.7));
  float ry = fract(rp.y + rh * 10.0);
  float rain = step(0.8, rh) * smoothstep(0.0, 0.03, ry) * smoothstep(0.3, 0.0, ry);
  col += rain * uRain * mix(0.05, 0.09, uDark);
  return col;
}

// Beads: one per grid cell, each growing and evaporating on its own clock.
vec3 beads(vec2 uv, float scale, float t, float seed) {
  float aspect = uRes.x / uRes.y;
  vec2 p = uv * vec2(aspect, 1.0) * scale;
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  vec2 h = hash22(id + seed);
  float life = fract(t * (0.015 + h.x * 0.04) + h.y);
  float rMax = mix(0.06, 0.22, h.y * h.y);
  float r = rMax * smoothstep(0.0, 0.2, life) * smoothstep(1.0, 0.75, life);
  r *= step(0.25, hash12(id + seed + 4.0));
  // Jitter only as far as the bead still fits its cell: a bead crossing the
  // cell edge would be cut off square.
  vec2 c = (h - 0.5) * max(0.0, 1.0 - 2.0 * rMax * 1.2 - 0.06);
  vec2 d = f - c;
  d.y *= 1.15;
  // An empty or evaporated cell has r = 0, and smoothstep with equal edges
  // divides by zero: the NaN poisons the whole cell into a square block.
  if (r < 0.002) return vec3(0.0);
  float m = smoothstep(r, r * 0.6, length(d));
  return vec3(d / r * m, m);
}

// Runners: a drop sliding down its column, wobbling, leaving a wiped trail
// with a few tiny beads left behind.
vec3 runners(vec2 uv, float t, out float trail) {
  float aspect = uRes.x / uRes.y;
  float w = 0.055;
  float qx = uv.x * aspect / w;
  float col = floor(qx);
  float fx = fract(qx) - 0.5;
  float h = hash12(vec2(col, uSeed * 3.0 + 1.0));
  trail = 0.0;
  if (h < mix(0.78, 0.4, uRain)) return vec3(0.0);
  float speed = (0.05 + 0.1 * hash12(vec2(col, 2.0))) * (0.6 + uRain);
  float stutter = vnoise(vec2(col * 1.7, t * 0.6)) * 0.35;
  float head = 1.15 - fract((t + stutter) * speed + h) * 1.5;
  float cx = (vnoise(vec2(col * 3.1, uv.y * 4.5)) - 0.5) * 0.55;
  float cxHead = (vnoise(vec2(col * 3.1, head * 4.5)) - 0.5) * 0.55;
  float dy = (uv.y - head) / w;
  vec2 d = vec2(fx - cxHead, dy * 0.85);
  float r = 0.2;
  float m = smoothstep(r, r * 0.55, length(d));
  float above = step(0.0, dy) * smoothstep(5.0, 0.0, dy);
  trail = above * smoothstep(0.16, 0.08, abs(fx - cx));
  float fy = fract(dy * 0.7) - 0.5;
  float tiny = above * smoothstep(0.075, 0.035, length(vec2(fx - cx, fy * 0.55))) * step(0.5, hash12(vec2(col, floor(dy * 0.7))));
  vec2 n = d / r * m + vec2(fx - cx, fy) * tiny * 6.0;
  return vec3(n, max(m, tiny));
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  float aspect = uRes.x / uRes.y;

  float trail;
  vec3 run = runners(uv, t, trail);
  vec3 b1 = beads(uv, 13.0, t, 1.0 + uSeed);
  vec3 b2 = beads(uv + 0.37, 25.0, t * 1.3, 7.0 + uSeed);

  float clear = uCursor.z * smoothstep(0.13, 0.03, length((uv - uCursor.xy) * vec2(aspect, 1.0)));
  float keep = (1.0 - trail) * (1.0 - clear);
  vec2 n = (b1.xy + b2.xy * 0.6) * keep + run.xy * (1.0 - clear);
  float m = max(max(b1.z, b2.z) * keep, run.z * (1.0 - clear)) * uDrops;

  vec2 offset = n * uDrops * 0.022;
  vec3 col = street(uv - offset * (1.0 + 2.0 * m));

  // Unwiped glass is faintly misted.
  float mist = (1.0 - m) * (1.0 - trail * 0.8) * (1.0 - clear) * mix(0.1, 0.06, uDark) * uDrops;
  col = mix(col, vec3(dot(col, vec3(0.333))) * 1.04 + 0.03, mist);

  // Light catches each drop at the top left; its lower edge darkens.
  float spec = pow(max(0.0, dot(normalize(vec3(n, 1.2)), normalize(vec3(-0.5, 0.7, 0.8)))), 18.0);
  col += spec * m * mix(0.2, 0.3, uDark);
  col -= m * smoothstep(0.2, 0.9, -n.y) * 0.06;

  if (uHaze > 0.5) {
    float steam = fbm(vec2(uv.x * 3.0 + t * 0.03, uv.y * 5.0 - t * 0.06));
    vec3 warm = mix(vec3(0.96, 0.9, 0.82), vec3(0.46, 0.32, 0.24), uDark);
    col = mix(col, warm, smoothstep(0.35, 0.0, uv.y) * steam * 0.45);
  }

  gl_FragColor = vec4(col, 1.0);
}
`

export const create: AmbientThreeModule['create'] = (canvas, runtime) => {
  const context = createAmbientRenderer(canvas)
  if (!context) return null
  const { renderer } = context

  const uniforms = {
    uRes: { value: new Vector2(canvas.clientWidth || 1, canvas.clientHeight || 1) },
    uTime: { value: 0 },
    uDark: { value: runtime.theme === 'dark' ? 1 : 0 },
    uRain: { value: 0.5 },
    uGlow: { value: 1 },
    uDrops: { value: 1 },
    uHaze: { value: 0 },
    uPasser: { value: 0 },
    uSeed: { value: runtime.prefs.sessionVariation ? runtime.seed : 0.37 },
    uCursor: { value: new Vector3(0, 0, 0) },
  }
  const material = new ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: FRAGMENT, uniforms, depthTest: false, depthWrite: false })
  const { mesh, geometry, camera } = fullscreen(material)
  const scene = new Scene()
  scene.add(mesh)

  let theme: SceneTheme = runtime.theme
  let time = 0
  let cursorPresence = 0
  let view = viewportOf(canvas)

  const result: AmbientThreeScene = {
    frame(dtMs: number, rt: SceneRuntime, signals: SceneSignals) {
      time += dtMs / 1000
      theme = rt.theme
      const effects = rt.prefs.effects.rainyCafe
      const rain = trackLevel(signals, 'rain')
      const cafe = trackLevel(signals, 'cafe')
      const intensity = signals.intensity

      uniforms.uTime.value = time
      uniforms.uDark.value = approach(uniforms.uDark.value, theme === 'dark' ? 1 : 0, dtMs, 2.5)
      uniforms.uRain.value = approach(uniforms.uRain.value, 0.35 + rain * 0.65, dtMs, 1.5)
      uniforms.uGlow.value = approach(uniforms.uGlow.value, (0.75 + cafe * 0.4) * (0.35 + intensity * 0.65), dtMs, 1.5)
      uniforms.uDrops.value = approach(uniforms.uDrops.value, effects.condensationDrops ? intensity : 0, dtMs, 2)
      uniforms.uHaze.value = effects.steamFog ? 1 : 0
      uniforms.uPasser.value = effects.passerbySilhouettes ? 1 : 0

      cursorPresence = approach(cursorPresence, signals.cursor.inside ? 1 : 0, dtMs, 6)
      if (signals.cursor.inside) uniforms.uCursor.value.set(signals.cursor.x / view.width, 1 - signals.cursor.y / view.height, cursorPresence)
      else uniforms.uCursor.value.z = cursorPresence

      renderer.render(scene, camera)
    },
    resize(width, height) {
      view = { width, height }
      const size = fitRenderer(renderer, canvas)
      uniforms.uRes.value.set(size.width, size.height)
    },
    setTheme(next) {
      theme = next
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      disposeRenderer(renderer)
    },
    particleCount: () => 26,
  }
  return result
}
