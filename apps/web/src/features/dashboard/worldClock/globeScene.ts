import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import landTopology from 'world-atlas/land-110m.json'
import { runSurface } from '../../../shared/three/runSurface'
import type { Rgb, SceneFactory, SurfaceModule, SurfaceScene } from '../../../shared/three/surface'
import { latLonToVector, subsolarPoint } from './solar'

export type GlobeCity = { id: string; latitude: number; longitude: number; home: boolean }

export type GlobeParams = {
  cities: GlobeCity[]
  highlightId: string | null
  colors: {
    /** Sunlit sphere. */
    paper: Rgb
    /** Night wash over the sphere. */
    night: Rgb
    /** Land dots on the day side / night side. */
    land: Rgb
    landNight: Rgb
    /** Graticule and rim. */
    rule: Rgb
    /** Terminator (pencil line). */
    pencil: Rgb
    /** Home city (the pen) and other cities (ink). */
    pen: Rgb
    ink: Rgb
  }
}

// ── Land mask ───────────────────────────────────────────────────────────────
// Natural Earth 110m land (public domain, via world-atlas), rasterised to an
// equirectangular mask once, then sampled by a Fibonacci sphere of dots.

const MASK_W = 720
const MASK_H = 360

const buildLandMask = () => {
  const canvas = document.createElement('canvas')
  canvas.width = MASK_W
  canvas.height = MASK_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const topology = landTopology as unknown as Topology<{ land: GeometryCollection }>
  const land = feature(topology, topology.objects.land)
  const polygons: number[][][][] = []
  for (const f of 'features' in land ? land.features : [land]) {
    const g = f.geometry
    if (g.type === 'Polygon') polygons.push(g.coordinates as number[][][])
    else if (g.type === 'MultiPolygon') polygons.push(...(g.coordinates as number[][][][]))
  }
  ctx.fillStyle = '#fff'
  for (const shift of [-MASK_W, 0, MASK_W]) {
    ctx.beginPath()
    for (const polygon of polygons) {
      for (const ring of polygon) {
        // Unwrap longitudes along the ring so a coast crossing the antimeridian
        // doesn't draw a band across the whole map; the ±360° copies fill in.
        let prev = ring[0][0]
        let offset = 0
        ring.forEach(([lon, lat], i) => {
          if (i > 0 && Math.abs(lon - prev) > 180) offset += lon < prev ? 360 : -360
          prev = lon
          const x = ((lon + offset + 180) / 360) * MASK_W + shift
          const y = ((90 - lat) / 180) * MASK_H
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
      }
    }
    ctx.fill('evenodd')
  }
  const data = ctx.getImageData(0, 0, MASK_W, MASK_H).data
  return (lat: number, lon: number) => {
    const x = Math.min(MASK_W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * MASK_W)))
    const y = Math.min(MASK_H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * MASK_H)))
    return data[(y * MASK_W + x) * 4] > 127
  }
}

const buildLandDots = (count: number) => {
  const isLand = buildLandMask()
  const positions: number[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r
    const lat = (Math.asin(y) * 180) / Math.PI
    const lon = (Math.atan2(x, z) * 180) / Math.PI
    if (!isLand || isLand(lat, lon)) positions.push(x * 1.004, y * 1.004, z * 1.004)
  }
  return positions
}

// ── Shaders ─────────────────────────────────────────────────────────────────

const SPHERE_VERTEX = /* glsl */ `
varying vec3 vObj;
varying vec3 vView;
void main() {
  vObj = normalize(position);
  vView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SPHERE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uSun;
uniform vec3 uPaper, uNight, uRule;
varying vec3 vObj;
varying vec3 vView;
void main() {
  float light = dot(vObj, uSun);
  float day = smoothstep(-0.12, 0.08, light);            // civil twilight is a soft band
  vec3 col = mix(uNight, uPaper, day);
  float rim = 1.0 - max(dot(vView, vec3(0.0, 0.0, 1.0)), 0.0);
  col = mix(col, uRule, smoothstep(0.82, 1.0, rim) * 0.7);
  gl_FragColor = vec4(col, 1.0);
}
`

const DOT_VERTEX = /* glsl */ `
uniform vec3 uSun;
uniform float uSize;
varying float vDay;
void main() {
  vDay = smoothstep(-0.12, 0.08, dot(normalize(position), uSun));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize;
}
`

const DOT_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uLand, uLandNight;
varying float vDay;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(mix(uLandNight, uLand, vDay), smoothstep(0.5, 0.3, d));
}
`

const LINE_VERTEX = /* glsl */ `
attribute float aDist;
varying float vDist;
varying float vFacing;
void main() {
  vDist = aDist;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFacing = normalize(normalMatrix * position).z;
  gl_Position = projectionMatrix * mv;
}
`

const LINE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uDash;
varying float vDist;
varying float vFacing;
void main() {
  if (uDash > 0.0 && fract(vDist * uDash) > 0.5) discard;   // pencil: dashed
  float edge = smoothstep(-0.05, 0.25, vFacing);             // fade toward the limb
  gl_FragColor = vec4(uColor, uAlpha * edge);
}
`

const PIN_VERTEX = /* glsl */ `
attribute float aKind;     // 1 = home (pen), 0 = other (ink)
attribute float aHighlight;
uniform float uSize;
uniform float uTime;
varying float vKind;
varying float vPing;
void main() {
  vKind = aKind;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float grow = 1.0 + aHighlight * 0.6;
  gl_PointSize = uSize * grow * (aKind > 0.5 ? 3.2 : 1.0);
  vPing = aKind > 0.5 ? fract(uTime * 0.35) : -1.0;
}
`

const PIN_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uPen, uInk, uPaper;
varying float vKind;
varying float vPing;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (vKind > 0.5) {
    // Home: a pen dot (inner third) with a slow ring spreading out and fading.
    float core = smoothstep(0.17, 0.13, d);
    float ringR = mix(0.16, 0.48, vPing);
    float ring = smoothstep(0.03, 0.0, abs(d - ringR)) * (1.0 - vPing) * 0.8;
    float halo = smoothstep(0.2, 0.16, d) * (1.0 - core);           // paper keyline
    vec3 col = mix(uPen, uPaper, halo);
    float a = max(core, max(ring, halo));
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uPen, col, step(0.001, halo)), a);
  } else {
    float core = smoothstep(0.34, 0.26, d);
    float keyline = smoothstep(0.5, 0.42, d) * (1.0 - core);
    float a = max(core, keyline);
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uPaper, uInk, core), a);
  }
}
`

// ── Geometry helpers ────────────────────────────────────────────────────────

const circlePoints = (normal: Vector3, radius: number, segments: number) => {
  // Great/small circle around `normal` at the given radius on the unit sphere.
  const n = normal.clone().normalize()
  const helper = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
  const u = new Vector3().crossVectors(n, helper).normalize()
  const v = new Vector3().crossVectors(n, u).normalize()
  const offset = Math.sqrt(Math.max(0, 1 - radius * radius))
  const points: Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    points.push(
      n.clone().multiplyScalar(offset).add(u.clone().multiplyScalar(Math.cos(a) * radius)).add(v.clone().multiplyScalar(Math.sin(a) * radius)),
    )
  }
  return points
}

const segmentsGeometry = (loops: Vector3[][], lift: number) => {
  const positions: number[] = []
  const dist: number[] = []
  for (const loop of loops) {
    let travelled = 0
    for (let i = 0; i < loop.length - 1; i++) {
      const a = loop[i].clone().multiplyScalar(lift)
      const b = loop[i + 1].clone().multiplyScalar(lift)
      const step = a.distanceTo(b)
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
      dist.push(travelled, travelled + step)
      travelled += step
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aDist', new Float32BufferAttribute(dist, 1))
  return geometry
}

const graticule = () => {
  const loops: Vector3[][] = []
  for (let lat = -60; lat <= 60; lat += 30) {
    const r = Math.cos((lat * Math.PI) / 180)
    loops.push(circlePoints(new Vector3(0, lat >= 0 ? 1 : -1, 0), r, 96))
  }
  for (let lon = 0; lon < 180; lon += 30) {
    const [x, , z] = latLonToVector(0, lon + 90)
    loops.push(circlePoints(new Vector3(x, 0, z), 1, 96))
  }
  return segmentsGeometry(loops, 1.002)
}

/** Circular mean of city longitudes and the mean latitude, for framing. */
const frame = (cities: GlobeCity[]) => {
  if (!cities.length) return { longitude: 105, latitude: 25 }
  let sx = 0
  let sy = 0
  let lat = 0
  for (const city of cities) {
    sx += Math.cos((city.longitude * Math.PI) / 180)
    sy += Math.sin((city.longitude * Math.PI) / 180)
    lat += city.latitude
  }
  return { longitude: (Math.atan2(sy, sx) * 180) / Math.PI, latitude: lat / cities.length }
}

const createGlobeScene: SceneFactory<GlobeParams> = ({ renderer, width, height, dpr, still }, initial) => {
  let params = initial
  const scene = new Scene()
  const camera = new PerspectiveCamera(30, width / height, 0.1, 20)
  camera.position.set(0, 0, 4.15)

  const globe = new Group()
  scene.add(globe)

  const sun = new Vector3()
  const setSun = () => {
    const { latitude, longitude } = subsolarPoint(new Date())
    sun.set(...latLonToVector(latitude, longitude))
  }
  setSun()

  const sphereUniforms = {
    uSun: { value: sun },
    uPaper: { value: new Vector3() },
    uNight: { value: new Vector3() },
    uRule: { value: new Vector3() },
  }
  const sphereGeometry = new SphereGeometry(1, 72, 48)
  const sphereMaterial = new ShaderMaterial({ vertexShader: SPHERE_VERTEX, fragmentShader: SPHERE_FRAGMENT, uniforms: sphereUniforms })
  globe.add(new Mesh(sphereGeometry, sphereMaterial))

  const dotsGeometry = new BufferGeometry()
  dotsGeometry.setAttribute('position', new Float32BufferAttribute(buildLandDots(13000), 3))
  const dotUniforms = {
    uSun: { value: sun },
    uSize: { value: 1.7 * dpr },
    uLand: { value: new Vector3() },
    uLandNight: { value: new Vector3() },
  }
  const dotsMaterial = new ShaderMaterial({ vertexShader: DOT_VERTEX, fragmentShader: DOT_FRAGMENT, uniforms: dotUniforms, transparent: true })
  globe.add(new Points(dotsGeometry, dotsMaterial))

  const gridGeometry = graticule()
  const gridMaterial = new ShaderMaterial({
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    uniforms: { uColor: { value: new Vector3() }, uAlpha: { value: 0.35 }, uDash: { value: 0 } },
    transparent: true,
    depthWrite: false,
  })
  globe.add(new LineSegments(gridGeometry, gridMaterial))

  let terminatorGeometry = segmentsGeometry([circlePoints(sun, 1, 160)], 1.006)
  const terminatorMaterial = new ShaderMaterial({
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    uniforms: { uColor: { value: new Vector3() }, uAlpha: { value: 1 }, uDash: { value: 22 } },
    transparent: true,
    depthWrite: false,
  })
  const terminator = new LineSegments(terminatorGeometry, terminatorMaterial)
  globe.add(terminator)

  const pinGeometry = new BufferGeometry()
  const pinUniforms = {
    uSize: { value: 8.5 * dpr },
    uTime: { value: 0 },
    uPen: { value: new Vector3() },
    uInk: { value: new Vector3() },
    uPaper: { value: new Vector3() },
  }
  const pinMaterial = new ShaderMaterial({ vertexShader: PIN_VERTEX, fragmentShader: PIN_FRAGMENT, uniforms: pinUniforms, transparent: true, depthWrite: false })
  const pins = new Points(pinGeometry, pinMaterial)
  pins.renderOrder = 2
  globe.add(pins)

  let target = frame(initial.cities)
  let heading = target.longitude
  let tilt = target.latitude

  const applyParams = () => {
    const c = params.colors
    sphereUniforms.uPaper.value.set(...c.paper)
    sphereUniforms.uNight.value.set(...c.night)
    sphereUniforms.uRule.value.set(...c.rule)
    dotUniforms.uLand.value.set(...c.land)
    dotUniforms.uLandNight.value.set(...c.landNight)
    gridMaterial.uniforms.uColor.value.set(...c.rule)
    terminatorMaterial.uniforms.uColor.value.set(...c.pencil)
    pinUniforms.uPen.value.set(...c.pen)
    pinUniforms.uInk.value.set(...c.ink)
    pinUniforms.uPaper.value.set(...c.paper)

    const positions: number[] = []
    const kinds: number[] = []
    const highlight: number[] = []
    // Home last so its ring draws over neighbours.
    const ordered = [...params.cities].sort((a, b) => Number(a.home) - Number(b.home))
    for (const city of ordered) {
      const [x, y, z] = latLonToVector(city.latitude, city.longitude)
      positions.push(x * 1.012, y * 1.012, z * 1.012)
      kinds.push(city.home ? 1 : 0)
      highlight.push(city.id === params.highlightId ? 1 : 0)
    }
    pinGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    pinGeometry.setAttribute('aKind', new Float32BufferAttribute(kinds, 1))
    pinGeometry.setAttribute('aHighlight', new Float32BufferAttribute(highlight, 1))
    target = frame(params.cities)
  }
  applyParams()

  let sunUpdatedAt = 0

  const result: SurfaceScene<GlobeParams> = {
    update(next) {
      params = next
      applyParams()
    },
    frame(dt, t) {
      // Re-aim the sun every half minute; the terminator moves 0.125°/min.
      if (t - sunUpdatedAt > 30 || sunUpdatedAt === 0) {
        sunUpdatedAt = t || 0.001
        setSun()
        terminatorGeometry.dispose()
        terminatorGeometry = segmentsGeometry([circlePoints(sun, 1, 160)], 1.006)
        terminator.geometry = terminatorGeometry
      }
      // Ease toward the framing, plus a slow sway so the globe feels held, not pinned.
      const k = still ? 1 : 1 - Math.exp(-dt * 1.8)
      let delta = target.longitude - heading
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      heading += delta * k
      tilt += (target.latitude - tilt) * k
      const sway = still ? 0 : Math.sin(t * 0.07) * 18
      globe.rotation.set(((tilt * 0.55) * Math.PI) / 180, (-(heading + sway) * Math.PI) / 180, 0, 'XYZ')
      pinUniforms.uTime.value = t
      renderer.render(scene, camera)
    },
    resize(w, h) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    },
    dispose() {
      sphereGeometry.dispose()
      sphereMaterial.dispose()
      dotsGeometry.dispose()
      dotsMaterial.dispose()
      gridGeometry.dispose()
      gridMaterial.dispose()
      terminatorGeometry.dispose()
      terminatorMaterial.dispose()
      pinGeometry.dispose()
      pinMaterial.dispose()
    },
  }
  return result
}

export const mount: SurfaceModule<GlobeParams>['mount'] = (canvas, params, options) =>
  runSurface(canvas, createGlobeScene, params, options)
