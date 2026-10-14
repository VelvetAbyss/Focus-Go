import {
  BackSide,
  type BufferGeometry,
  Color,
  EdgesGeometry,
  FrontSide,
  LatheGeometry,
  Mesh,
  type Object3D,
  SRGBColorSpace,
  ShaderMaterial,
  type Side,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { hex, type Rgb } from '../../../../shared/three/surface'
import type { DeskColors } from '../deskTypes'

/**
 * The desk's drawing kit: paper fills lit by the lamp (and a candle), ink
 * outlines (back-face hulls for round things, crease edges for the rest) and
 * fat lines. Every material is kept in a registry so a theme change recolours
 * the whole desk and a resize keeps line widths in CSS px.
 */

const FILL_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/** Lit candles that warm the paper around them; more than this burn without it. */
export const CANDLE_LIGHTS = 4

// Paper warms inside the lamp's cone and near the bulb, and near lit candles
// (xyz, strength). The shade's inside, the bulb and a flame glow on their own.
const FILL_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uBase;
uniform vec3 uBulb;
uniform vec3 uDir;
uniform vec3 uWarmMul;
uniform vec3 uWarmAdd;
uniform vec3 uBulbColor;
uniform vec4 uCandles[${CANDLE_LIGHTS}];
uniform float uLight;
uniform float uInner;
uniform float uGlow;
varying vec3 vWorld;
void main() {
  vec3 toFrag = vWorld - uBulb;
  float d = max(length(toFrag), 0.0001);
  float cone = smoothstep(0.72, 0.86, dot(toFrag / d, uDir));
  float lit = max(cone * clamp(2.2 / (d + 0.4), 0.0, 1.0), pow(clamp(1.0 - d / 1.6, 0.0, 1.0), 2.0) * 0.6) * uLight;
  float candle = 0.0;
  for (int i = 0; i < ${CANDLE_LIGHTS}; i++) {
    candle += pow(clamp(1.0 - length(vWorld - uCandles[i].xyz) / 1.1, 0.0, 1.0), 1.5) * uCandles[i].w;
  }
  vec3 color = mix(uBase, uBase * uWarmMul + uWarmAdd, clamp(lit + candle, 0.0, 1.0));
  if (uInner > 0.5 && !gl_FrontFacing) color = mix(color, uBulbColor, uLight * 0.85);
  if (uGlow > 0.5) color = mix(color, uBulbColor, uLight);
  if (uGlow > 1.5) color = uBase;
  gl_FragColor = vec4(color, 1.0);
}
`

const HULL_VERTEX = /* glsl */ `
uniform float uThickness;
void main() {
  vec3 p = position + normalize(normal) * uThickness;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const HULL_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
void main() { gl_FragColor = vec4(uColor, 1.0); }
`

export const LINE = 1.5
export const DETAIL = 1
const BULB_COLOR = hex('#fff4dc')

export type FillKey = 'paper' | 'coffee' | 'cola' | 'ice' | 'vinyl' | 'flame'
export type LineKey = 'ink' | 'ink3' | 'ink4' | 'pencil' | 'pen' | 'groove'
/** 'bulb' glows with the lamp; 'flame' is always its own colour. */
export type FillOptions = { side?: Side; inner?: boolean; glow?: 'bulb' | 'flame' }

const themed = (dark: boolean) =>
  dark
    ? {
        coffee: hex('#4e4034'),
        cola: hex('#24191a'),
        ice: hex('#3a3f3e'),
        vinyl: hex('#1c1b19'),
        flame: hex('#ffd98f'),
        warmMul: [1.5, 1.34, 1.1] as Rgb,
        warmAdd: [0.07, 0.045, 0.012] as Rgb,
      }
    : {
        coffee: hex('#8a7563'),
        cola: hex('#3f2c27'),
        ice: hex('#eef3f3'),
        vinyl: hex('#2b2926'),
        flame: hex('#ffe3a6'),
        warmMul: [1, 0.95, 0.86] as Rgb,
        warmAdd: [0, 0, 0] as Rgb,
      }

export type Kit = ReturnType<typeof createKit>

export const createKit = (initial: { width: number; height: number; unit: number; colors: DeskColors }) => {
  let { width, height, unit, colors } = initial

  const shared = {
    uBulb: { value: new Vector3(0, 2, 0) },
    uDir: { value: new Vector3(0, -1, 0) },
    uWarmMul: { value: new Vector3() },
    uWarmAdd: { value: new Vector3() },
    uBulbColor: { value: new Vector3(...BULB_COLOR) },
    uLight: { value: 0 },
    uCandles: { value: Array.from({ length: CANDLE_LIGHTS }, () => new Vector4(0, -10, 0, 0)) },
  }

  const fills: { material: ShaderMaterial; key: FillKey }[] = []
  const fill = (key: FillKey = 'paper', options: FillOptions = {}) => {
    const material = new ShaderMaterial({
      uniforms: {
        ...shared,
        uBase: { value: new Vector3() },
        uInner: { value: options.inner ? 1 : 0 },
        uGlow: { value: options.glow === 'bulb' ? 1 : options.glow === 'flame' ? 2 : 0 },
      },
      vertexShader: FILL_VERTEX,
      fragmentShader: FILL_FRAGMENT,
      side: options.side ?? FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    fills.push({ material, key })
    paintFill(material, key)
    return material
  }

  const lines: { material: LineMaterial; key: LineKey }[] = []
  const lineMaterial = (px: number, key: LineKey) => {
    const material = new LineMaterial({ linewidth: px })
    material.resolution.set(width, height)
    lines.push({ material, key })
    paintLine(material, key)
    return material
  }
  const segments = (positions: number[] | Float32Array, px = LINE, key: LineKey = 'ink') => {
    const geometry = new LineSegmentsGeometry()
    geometry.setPositions(positions instanceof Float32Array ? positions : new Float32Array(positions))
    const object = new LineSegments2(geometry, lineMaterial(px, key))
    object.frustumCulled = false
    object.raycast = () => {}
    return object
  }
  const markDirty = (object: LineSegments2) => {
    const start = object.geometry.getAttribute('instanceStart') as unknown as { data: { needsUpdate: boolean } }
    start.data.needsUpdate = true
  }
  /** Retints one line (the timer's mark turns to the pen while it runs). */
  const setLineKey = (object: LineSegments2, key: LineKey) => {
    const entry = lines.find((l) => l.material === object.material)
    if (!entry || entry.key === key) return
    entry.key = key
    paintLine(entry.material, key)
  }

  const hullColor = { value: new Vector3() }
  const hulls: { material: ShaderMaterial; px: number }[] = []
  const hull = <T extends Mesh>(mesh: T, px = LINE): T => {
    const material = new ShaderMaterial({
      uniforms: { uThickness: { value: px / unit }, uColor: hullColor },
      vertexShader: HULL_VERTEX,
      fragmentShader: HULL_FRAGMENT,
      side: BackSide,
    })
    hulls.push({ material, px })
    const outline = new Mesh(mesh.geometry, material)
    outline.raycast = () => {}
    mesh.add(outline)
    return mesh
  }
  const edges = <T extends Mesh>(mesh: T, px = LINE, threshold = 30, key: LineKey = 'ink'): T => {
    const positions = new EdgesGeometry(mesh.geometry, threshold).getAttribute('position').array as Float32Array
    mesh.add(segments(new Float32Array(positions), px, key))
    return mesh
  }
  const solid = (geometry: BufferGeometry, key: FillKey = 'paper', options?: FillOptions) => new Mesh(geometry, fill(key, options))
  const lathe = (profile: [number, number][], n = 48) => new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), n)

  function fillColor(key: FillKey): Rgb {
    if (key === 'paper') return colors.paper
    return themed(colors.dark)[key]
  }
  function paintFill(material: ShaderMaterial, key: FillKey) {
    ;(material.uniforms.uBase.value as Vector3).set(...fillColor(key))
  }
  function lineColor(key: LineKey): Rgb {
    if (key === 'ink') return colors.ink
    if (key === 'ink3' || key === 'groove') return colors.ink3
    if (key === 'ink4') return colors.ink4
    if (key === 'pen') return colors.pen
    return colors.pencil
  }
  function paintLine(material: LineMaterial, key: LineKey) {
    const [r, g, b] = lineColor(key)
    material.color.copy(new Color().setRGB(r, g, b, SRGBColorSpace))
  }

  const applyColors = (next: DeskColors) => {
    colors = next
    for (const { material, key } of fills) paintFill(material, key)
    for (const { material, key } of lines) paintLine(material, key)
    hullColor.value.set(...colors.ink)
    const t = themed(colors.dark)
    shared.uWarmMul.value.set(...t.warmMul)
    shared.uWarmAdd.value.set(...t.warmAdd)
  }

  /** Disposes a prop taken off the desk, and stops recolouring its materials. */
  const release = (root: Object3D) => {
    const materials = new Set<unknown>()
    root.traverse((object) => {
      const { geometry, material } = object as Mesh
      geometry?.dispose()
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        materials.add(m)
        m.dispose()
      }
    })
    const keep = <T extends { material: unknown }>(list: T[]) => {
      for (let i = list.length - 1; i >= 0; i -= 1) if (materials.has(list[i].material)) list.splice(i, 1)
    }
    keep(fills)
    keep(lines)
    keep(hulls)
  }

  const resize = (w: number, h: number, u: number) => {
    width = w
    height = h
    unit = u
    for (const { material, px } of hulls) material.uniforms.uThickness.value = px / unit
    for (const { material } of lines) material.resolution.set(width, height)
  }

  applyColors(colors)

  return {
    shared,
    fill,
    solid,
    edges,
    hull,
    segments,
    markDirty,
    setLineKey,
    lathe,
    applyColors,
    release,
    resize,
    colors: () => colors,
    toColor: (rgb: Rgb) => new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace),
  }
}

// ── Small shared helpers for the props.

export type Spring = { x: number; v: number }
const SPRING_STEP = 1 / 240

// Small fixed sub-steps: a stiff spring stays stable when frames come late.
export const step = (s: Spring, target: number, k: number, c: number, dt: number) => {
  for (let left = dt; left > 0; left -= SPRING_STEP) {
    const h = Math.min(left, SPRING_STEP)
    s.v += (k * (target - s.x) - c * s.v) * h
    s.x += s.v * h
  }
}
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)

export const circle = (radius: number, y: number, n = 48) => {
  const out: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    out.push(Math.cos(a0) * radius, y, Math.sin(a0) * radius, Math.cos(a1) * radius, y, Math.sin(a1) * radius)
  }
  return out
}
/** A circle standing in the x-y plane (facing the viewer), at depth z. */
export const ring = (radius: number, cx: number, cy: number, z: number, n = 48) => {
  const out: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    out.push(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius, z, cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, z)
  }
  return out
}
export const rectangle = (out: number[], x0: number, z0: number, x1: number, z1: number, y: number) => {
  out.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0)
}
export const segmentsOf = (points: [number, number, number][]) => {
  const out: number[] = []
  for (let i = 0; i < points.length - 1; i += 1) out.push(...points[i], ...points[i + 1])
  return out
}
export const dashedCircle = (radius: number, dashes: number) => {
  const out: number[] = []
  for (let i = 0; i < dashes; i += 1) {
    const t0 = (i / dashes) * Math.PI * 2
    const t1 = t0 + ((Math.PI * 2) / dashes) * 0.55
    for (let j = 0; j < 3; j += 1) {
      const u0 = t0 + ((t1 - t0) * j) / 3
      const u1 = t0 + ((t1 - t0) * (j + 1)) / 3
      out.push(Math.cos(u0) * radius, Math.sin(u0) * radius, 0, Math.cos(u1) * radius, Math.sin(u1) * radius, 0)
    }
  }
  return out
}

/**
 * Pencil strokes that draw themselves upward and are taken back from the
 * bottom (steam, smoke, the record's notes rising). Each stroke is an S-curve
 * of `points` samples between `from` and `from + rise` above (x, z).
 */
export const createRisers = (
  kit: Kit,
  parent: { add: (o: LineSegments2) => void },
  spots: { x: number; z: number; offset: number; phase: number }[],
  options: { from: number; rise: number; sway: number; period: number; px?: number },
) => {
  const points = 24
  const strokes = spots.map((spot) => {
    const positions = new Float32Array((points - 1) * 6)
    const object = kit.segments(positions, options.px ?? 1.25, 'pencil')
    object.visible = false
    parent.add(object)
    return { ...spot, positions, object }
  })
  return {
    draw(t: number, amplitude = 1, active = true) {
      for (const s of strokes) {
        const cycle = ((t + s.offset) / options.period) % 1
        const head = easeOut(clamp01(cycle / 0.55))
        const tail = easeInOut(clamp01((cycle - 0.38) / 0.6))
        s.object.visible = active && head - tail > 0.02
        if (!s.object.visible) continue
        let px = 0
        let py = 0
        for (let i = 0; i < points; i += 1) {
          const q = tail + ((head - tail) * i) / (points - 1)
          const y = options.from + q * options.rise * amplitude + cycle * 0.1
          const x = s.x + Math.sin(q * 2.3 * Math.PI + s.phase + t * 0.7) * options.sway * (0.35 + q) * amplitude
          if (i) s.positions.set([px, py, s.z, x, y, s.z], (i - 1) * 6)
          px = x
          py = y
        }
        kit.markDirty(s.object)
      }
    },
    hide() {
      for (const s of strokes) s.object.visible = false
    },
  }
}
