import { Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3 } from 'three'
import type { SceneRuntime, SceneSignals, SceneTheme } from '../scenes/types'
import { approach, createAmbientRenderer, disposeRenderer, fitRenderer, fullscreen, FULLSCREEN_VERTEX, GLSL_NOISE, trackLevel, viewportOf } from './common'
import type { AmbientThreeModule, AmbientThreeScene } from './types'

/**
 * Ocean breeze: a real swell. A wide plane is displaced by five Gerstner
 * waves; the sky is drawn per view ray, so what the water reflects is exactly
 * the sky above it. Morning haze in the light theme, a moonlit sea in dark.
 * Ocean volume raises the swell, wind makes it choppier.
 */

// Shared by the sky pass and the water's reflection.
const SKY_GLSL = /* glsl */ `
uniform float uDark;
uniform float uTime;
uniform vec3 uSunDir;
uniform float uHalo;
${GLSL_NOISE}

vec3 horizonColor() {
  return mix(vec3(0.94, 0.87, 0.80), vec3(0.14, 0.19, 0.3), uDark);
}

vec3 skyColor(vec3 dir) {
  float y = max(dir.y, 0.0);
  vec3 zenith = mix(vec3(0.53, 0.68, 0.8), vec3(0.025, 0.05, 0.11), uDark);
  vec3 col = mix(horizonColor(), zenith, pow(y, 0.55));

  // Sun (light) or moon (dark): disc, halo, and the band of light it lays on the haze.
  float s = max(dot(dir, uSunDir), 0.0);
  vec3 light = mix(vec3(1.0, 0.93, 0.8), vec3(0.88, 0.92, 1.0), uDark);
  float disc = smoothstep(mix(0.9994, 0.99965, uDark), mix(0.9997, 0.99985, uDark), s);
  col += light * (pow(s, 12.0) * 0.18 + pow(s, 90.0) * 0.35) * uHalo;
  col = mix(col, light, disc * uHalo);

  // Soft clouds on a high plane.
  if (dir.y > 0.01) {
    vec2 cp = dir.xz / dir.y * 0.35 + vec2(uTime * 0.004, uTime * 0.002);
    float c = smoothstep(0.52, 0.85, fbm(cp * 1.4));
    vec3 cloud = mix(vec3(0.99, 0.95, 0.91), vec3(0.18, 0.22, 0.32), uDark);
    col = mix(col, cloud, c * 0.55 * smoothstep(0.0, 0.25, dir.y));
  }

  // Stars at night.
  if (uDark > 0.5 && dir.y > 0.05) {
    vec2 g = dir.xz / (dir.y + 0.3) * 60.0;
    vec2 id = floor(g);
    float h = hash12(id);
    float star = step(0.985, h) * smoothstep(0.12, 0.0, length(fract(g) - 0.5));
    col += star * (0.5 + 0.5 * sin(uTime * (1.0 + h * 3.0) + h * 40.0)) * uDark * smoothstep(0.05, 0.3, dir.y);
  }
  return col;
}
`

const SKY_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform vec2 uTan;
${SKY_GLSL}
void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dir = normalize(uCamForward + ndc.x * uTan.x * uCamRight + ndc.y * uTan.y * uCamUp);
  vec3 col = dir.y < 0.0 ? horizonColor() : skyColor(dir);
  gl_FragColor = vec4(col, 1.0);
}
`

const WATER_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSwell;
uniform float uChop;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;

void wave(vec2 dir, float wavelength, float amplitude, float steep, vec2 xz, float t,
          inout vec3 offset, inout vec3 normal) {
  vec2 d = normalize(dir);
  float k = 6.2831853 / wavelength;
  float w = sqrt(9.8 * k) * (0.55 + uChop * 0.35);
  float f = k * dot(d, xz) - w * t;
  float a = amplitude * uSwell;
  float q = steep * (0.7 + uChop * 0.3);
  offset.x += q * a * d.x * cos(f);
  offset.z += q * a * d.y * cos(f);
  offset.y += a * sin(f);
  normal.x -= d.x * k * a * cos(f);
  normal.z -= d.y * k * a * cos(f);
  normal.y -= q * k * a * sin(f);
}

void main() {
  vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 offset = vec3(0.0);
  vec3 normal = vec3(0.0, 1.0, 0.0);
  float t = uTime;
  wave(vec2(0.25, 1.0), 26.0, 0.42, 0.45, p.xz, t, offset, normal);
  wave(vec2(-0.55, 0.85), 15.0, 0.24, 0.55, p.xz, t, offset, normal);
  wave(vec2(0.8, 0.6), 9.0, 0.13, 0.65, p.xz, t, offset, normal);
  wave(vec2(-0.2, 1.0), 5.5, 0.065, 0.75, p.xz, t, offset, normal);
  wave(vec2(0.9, -0.3), 3.4, 0.035, 0.85, p.xz, t, offset, normal);
  vec3 world = p + offset;
  vWorld = world;
  vNormal = normalize(normal);
  vHeight = offset.y / max(uSwell, 0.001);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`

const WATER_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vHeight;
uniform float uCaustics;
${SKY_GLSL}

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  // Fine ripples as a normal perturbation; too small for the mesh itself.
  vec2 rp = vWorld.xz * 1.4 + vec2(uTime * 0.6, uTime * 0.4);
  float e = 0.05;
  float n0 = vnoise(rp);
  vec3 detail = vec3(vnoise(rp + vec2(e, 0.0)) - n0, 0.0, vnoise(rp + vec2(0.0, e)) - n0) / e;
  vec3 N = normalize(vNormal - detail * 0.06);

  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 reflection = skyColor(R);

  vec3 deep = mix(vec3(0.17, 0.35, 0.43), vec3(0.015, 0.04, 0.075), uDark);
  vec3 shallow = mix(vec3(0.36, 0.58, 0.61), vec3(0.04, 0.1, 0.15), uDark);
  vec3 water = mix(deep, shallow, clamp(vHeight * 0.9 + 0.45, 0.0, 1.0));
  vec3 col = mix(water, reflection, fresnel);

  // The light's path across the water: a sharp specular, broken into glints.
  vec3 light = mix(vec3(1.0, 0.92, 0.78), vec3(0.9, 0.94, 1.0), uDark);
  float spec = pow(max(dot(R, uSunDir), 0.0), mix(160.0, 320.0, uDark));
  float glint = mix(1.0, step(0.62, vnoise(vWorld.xz * 5.0 + uTime * 1.6)) * 2.4, uCaustics);
  col += light * spec * mix(1.8, 1.3, uDark) * glint * uHalo;

  float foam = smoothstep(0.75, 1.25, vHeight) * (0.4 + 0.6 * vnoise(vWorld.xz * 1.3 + uTime * 0.25));
  col = mix(col, mix(vec3(0.97, 0.97, 0.95), vec3(0.55, 0.6, 0.7), uDark), foam * 0.35);

  float dist = length(vWorld - cameraPosition);
  col = mix(col, horizonColor(), 1.0 - exp(-dist * 0.018));
  gl_FragColor = vec4(col, 1.0);
}
`

export const create: AmbientThreeModule['create'] = (canvas, runtime) => {
  const context = createAmbientRenderer(canvas)
  if (!context) return null
  const { renderer } = context
  renderer.autoClear = false

  const width = canvas.clientWidth || 1
  const height = canvas.clientHeight || 1
  const camera = new PerspectiveCamera(50, width / height, 0.1, 600)
  const basePosition = new Vector3(0, 2.2, 8)
  const baseTarget = new Vector3(0, -1.4, -40) // puts the horizon ~58% up the screen
  camera.position.copy(basePosition)
  camera.lookAt(baseTarget)

  const sunDir = new Vector3()
  const setSun = (dark: boolean) => {
    const elevation = ((dark ? 16 : 9) * Math.PI) / 180
    sunDir.set(dark ? 0.22 : -0.18, Math.sin(elevation), -Math.cos(elevation)).normalize()
  }
  setSun(runtime.theme === 'dark')

  const shared = {
    uDark: { value: runtime.theme === 'dark' ? 1 : 0 },
    uTime: { value: 0 },
    uSunDir: { value: sunDir },
    uHalo: { value: 1 },
  }

  const skyUniforms = {
    ...shared,
    uCamRight: { value: new Vector3() },
    uCamUp: { value: new Vector3() },
    uCamForward: { value: new Vector3() },
    uTan: { value: new Vector2() },
  }
  const skyMaterial = new ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms: skyUniforms, depthTest: false, depthWrite: false })
  const sky = fullscreen(skyMaterial)
  const skyScene = new Scene()
  skyScene.add(sky.mesh)

  const waterUniforms = {
    ...shared,
    uSwell: { value: 1 },
    uChop: { value: 0.4 },
    uCaustics: { value: 0 },
  }
  const waterGeometry = new PlaneGeometry(400, 400, 320, 320)
  waterGeometry.rotateX(-Math.PI / 2)
  waterGeometry.translate(0, 0, -150)
  const waterMaterial = new ShaderMaterial({ vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, uniforms: waterUniforms })
  const water = new Mesh(waterGeometry, waterMaterial)
  water.frustumCulled = false
  const waterScene = new Scene()
  waterScene.add(water)

  let theme: SceneTheme = runtime.theme
  let time = 0
  let sway = 0
  let view = viewportOf(canvas)

  const syncCameraBasis = () => {
    camera.updateMatrixWorld()
    const e = camera.matrixWorld.elements
    skyUniforms.uCamRight.value.set(e[0], e[1], e[2]).normalize()
    skyUniforms.uCamUp.value.set(e[4], e[5], e[6]).normalize()
    skyUniforms.uCamForward.value.set(-e[8], -e[9], -e[10]).normalize()
    const tanY = Math.tan((camera.fov * Math.PI) / 360)
    skyUniforms.uTan.value.set(tanY * camera.aspect, tanY)
  }

  const result: AmbientThreeScene = {
    frame(dtMs: number, rt: SceneRuntime, signals: SceneSignals) {
      const dt = dtMs / 1000
      time += dt
      if (rt.theme !== theme) {
        theme = rt.theme
        setSun(theme === 'dark')
      }
      const effects = rt.prefs.effects.oceanBreeze
      const ocean = trackLevel(signals, 'ocean')
      const wind = trackLevel(signals, 'wind')

      shared.uTime.value = time
      shared.uDark.value = approach(shared.uDark.value, theme === 'dark' ? 1 : 0, dtMs, 2)
      shared.uHalo.value = approach(shared.uHalo.value, effects.sunMoonHighlight ? 1 : 0.25, dtMs, 2)
      waterUniforms.uSwell.value = approach(waterUniforms.uSwell.value, (0.75 + ocean * 0.55) * (0.3 + signals.intensity * 0.7), dtMs, 0.8)
      waterUniforms.uChop.value = approach(waterUniforms.uChop.value, 0.3 + wind * 0.7, dtMs, 0.8)
      waterUniforms.uCaustics.value = effects.surfaceCaustics ? 1 : 0

      // A slow bob and sway; the pointer turns the view a couple of degrees.
      const cursorX = signals.cursor.inside ? signals.cursor.x / view.width - 0.5 : 0
      sway = approach(sway, cursorX, dtMs, 1.2)
      const drift = effects.parallaxLayers ? 1 : 0
      camera.position.set(
        basePosition.x + Math.sin(time * 0.11) * 0.6 * drift,
        basePosition.y + Math.sin(time * 0.37) * 0.12 * drift,
        basePosition.z,
      )
      camera.lookAt(baseTarget.x + sway * 6, baseTarget.y + Math.sin(time * 0.29) * 0.25 * drift, baseTarget.z)
      syncCameraBasis()

      renderer.clear()
      renderer.render(skyScene, sky.camera)
      renderer.render(waterScene, camera)
    },
    resize(width, height) {
      view = { width, height }
      const fitted = fitRenderer(renderer, canvas)
      camera.aspect = fitted.width / fitted.height
      camera.updateProjectionMatrix()
    },
    setTheme(next) {
      theme = next
      setSun(next === 'dark')
    },
    dispose() {
      sky.geometry.dispose()
      skyMaterial.dispose()
      waterGeometry.dispose()
      waterMaterial.dispose()
      disposeRenderer(renderer)
    },
    particleCount: () => 0,
  }
  return result
}
