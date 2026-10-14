import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  FrontSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  type Object3D,
  OrthographicCamera,
  Points,
  Raycaster,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Shape,
  type Side,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { runSurface } from '../../../../shared/three/runSurface'
import { hex, type Rgb, type SceneFactory, type SurfaceModule } from '../../../../shared/three/surface'
import { DESK_LAYOUT, DESK_LINE_INSET, deskFloor } from '../deskLayout'
import type { DeskColors, DeskParams, LampBeam } from '../deskTypes'
import {
  LAMP_RIG,
  constrainPose,
  handleAngle,
  pointerAngle,
  withHandleAngle,
  type LampBounds,
  type LampHandle,
  type LampPose,
} from '../lampKinematics'

/**
 * The masthead desk, seen exactly side on with the toolbar rule as the desk:
 * an open book (or a laptop), a coffee (or an iced cola) and a balanced-arm
 * lamp, drawn as paper-white solids with ink outlines (DESIGN.md › Desk). The
 * lamp's hinges can be dragged; its light is computed from the shade and
 * handed to the page overlay through `onBeam`. It draws at the display's rate
 * (up to 120 fps); the loop sleeps while the tab is hidden or the desk is
 * scrolled away.
 */

// ── Shaders. Colours stay in display space, like the other hand-written shaders.

const FILL_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

// Paper takes the lamp's warmth inside its cone and close to the bulb. The
// shade's inside and the bulb glow when it is on.
const FILL_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uBase;
uniform vec3 uBulb;
uniform vec3 uDir;
uniform vec3 uWarmMul;
uniform vec3 uWarmAdd;
uniform vec3 uBulbColor;
uniform float uLight;
uniform float uInner;
uniform float uIsBulb;
varying vec3 vWorld;
void main() {
  vec3 toFrag = vWorld - uBulb;
  float d = max(length(toFrag), 0.0001);
  float cone = smoothstep(0.72, 0.86, dot(toFrag / d, uDir));
  float lit = max(cone * clamp(2.2 / (d + 0.4), 0.0, 1.0), pow(clamp(1.0 - d / 1.6, 0.0, 1.0), 2.0) * 0.6);
  vec3 color = mix(uBase, uBase * uWarmMul + uWarmAdd, clamp(lit * uLight, 0.0, 1.0));
  if (uInner > 0.5 && !gl_FrontFacing) color = mix(color, uBulbColor, uLight * 0.85);
  if (uIsBulb > 0.5) color = mix(color, uBulbColor, uLight);
  gl_FragColor = vec4(color, 1.0);
}
`

// Outlines of round things: the back faces, pushed out along the normals.
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

const BUBBLE_VERTEX = /* glsl */ `
uniform float uSize;
attribute float aSize;
void main() {
  gl_PointSize = uSize * aSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const BUBBLE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5 || d < 0.3) discard;
  gl_FragColor = vec4(uColor, 1.0);
}
`

// ── Constants. Line widths are CSS px; lengths are world units.

const LINE = 1.5
const DETAIL = 1
const BULB_COLOR = hex('#fff4dc')
const HALO_COLOR = '#ffcf8a'
/** The bulb flickers on: [seconds, level]. */
const FLICKER: [number, number][] = [[0, 0], [0.03, 0.75], [0.07, 0.08], [0.13, 0.9], [0.18, 0.3], [0.27, 1]]
const BOOK = { pageWidth: 0.95, segments: 24, spineLift: 0.75, gutter: 0.062, board: 0.04, depth: 1.3 }
const STEAM_POINTS = 24
const SPRING_STEP = 1 / 240

type Kind = 'book' | 'laptop' | 'drink' | 'lamp'
type Hit = { kind: Kind; handle: LampHandle | null }
type Spring = { x: number; v: number }

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
// Small fixed sub-steps: a stiff spring stays stable when frames come late.
const step = (s: Spring, target: number, k: number, c: number, dt: number) => {
  for (let left = dt; left > 0; left -= SPRING_STEP) {
    const h = Math.min(left, SPRING_STEP)
    s.v += (k * (target - s.x) - c * s.v) * h
    s.x += s.v * h
  }
}
const flicker = (t: number) => {
  for (let i = 1; i < FLICKER.length; i += 1) {
    const [t1, v1] = FLICKER[i]
    if (t <= t1) {
      const [t0, v0] = FLICKER[i - 1]
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
    }
  }
  return 1
}
const toColor = (rgb: Rgb) => new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace)
const segmentsOf = (points: [number, number, number][]) => {
  const out: number[] = []
  for (let i = 0; i < points.length - 1; i += 1) out.push(...points[i], ...points[i + 1])
  return out
}
const circle = (radius: number, y: number, n = 48) => {
  const out: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    out.push(Math.cos(a0) * radius, y, Math.sin(a0) * radius, Math.cos(a1) * radius, y, Math.sin(a1) * radius)
  }
  return out
}
const rectangle = (out: number[], x0: number, z0: number, x1: number, z1: number, y: number) => {
  out.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0)
}
const dashedCircle = (radius: number, dashes: number) => {
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
const warmthFor = (dark: boolean) =>
  dark ? { mul: [1.5, 1.34, 1.1] as Rgb, add: [0.07, 0.045, 0.012] as Rgb } : { mul: [1, 0.95, 0.86] as Rgb, add: [0, 0, 0] as Rgb }
const drinkColors = (dark: boolean) =>
  dark
    ? { coffee: hex('#4e4034'), cola: hex('#24191a'), ice: hex('#3a3f3e'), bubble: hex('#8f857a') }
    : { coffee: hex('#8a7563'), cola: hex('#3f2c27'), ice: hex('#eef3f3'), bubble: hex('#c9bdb0') }

const factory: SceneFactory<DeskParams> = (context, initial) => {
  const { renderer, still } = context
  const canvas = renderer.domElement
  let params = initial
  let width = context.width
  let height = context.height

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  let bounds: LampBounds = { left: -2, right: 2, top: 2 }
  let deskY = 1

  // ── Materials, kept in registries so a theme change recolours everything.

  const shared = {
    uBulb: { value: new Vector3(0, 2, 0) },
    uDir: { value: new Vector3(0, -1, 0) },
    uWarmMul: { value: new Vector3() },
    uWarmAdd: { value: new Vector3() },
    uBulbColor: { value: new Vector3(...BULB_COLOR) },
    uLight: { value: 0 },
  }
  type ColorKey = 'paper' | 'coffee' | 'cola' | 'ice'
  const fills: { material: ShaderMaterial; key: ColorKey }[] = []
  const fill = (key: ColorKey, options: { side?: Side; inner?: boolean; bulb?: boolean } = {}) => {
    const material = new ShaderMaterial({
      uniforms: {
        ...shared,
        uBase: { value: new Vector3() },
        uInner: { value: options.inner ? 1 : 0 },
        uIsBulb: { value: options.bulb ? 1 : 0 },
      },
      vertexShader: FILL_VERTEX,
      fragmentShader: FILL_FRAGMENT,
      side: options.side ?? FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    fills.push({ material, key })
    return material
  }

  type LineKey = 'ink' | 'ink3' | 'ink4' | 'pencil'
  const lines: { material: LineMaterial; key: LineKey }[] = []
  const lineMaterial = (px: number, key: LineKey) => {
    const material = new LineMaterial({ linewidth: px })
    material.resolution.set(width, height)
    lines.push({ material, key })
    return material
  }
  const segments = (positions: number[] | Float32Array, px: number, key: LineKey = 'ink') => {
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

  const hullColor = { value: new Vector3() }
  const hulls: { material: ShaderMaterial; px: number }[] = []
  const hull = <T extends Mesh>(mesh: T, px = LINE): T => {
    const material = new ShaderMaterial({
      uniforms: { uThickness: { value: px / params.unit }, uColor: hullColor },
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
  const edges = <T extends Mesh>(mesh: T, px = LINE, threshold = 30): T => {
    const positions = new EdgesGeometry(mesh.geometry, threshold).getAttribute('position').array as Float32Array
    mesh.add(segments(new Float32Array(positions), px))
    return mesh
  }
  const solid = (geometry: BufferGeometry, key: ColorKey = 'paper', options?: Parameters<typeof fill>[1]) =>
    new Mesh(geometry, fill(key, options))
  const lathe = (profile: [number, number][], n = 48) =>
    new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), n)

  // ── The book: two page blocks rising from the gutter, seen end on.

  const book = new Group()
  book.userData.kind = 'book'
  book.position.x = DESK_LAYOUT.itemX
  scene.add(book)
  const restAngle = (u: number) => BOOK.spineLift * (1 - u) * (1 - u) - 0.03
  const pageTop: [number, number][] = [[0, BOOK.gutter]]
  {
    let x = 0
    let y = BOOK.gutter
    for (let k = 0; k < BOOK.segments; k += 1) {
      const a = restAngle((k + 0.5) / BOOK.segments)
      x += (Math.cos(a) * BOOK.pageWidth) / BOOK.segments
      y += (Math.sin(a) * BOOK.pageWidth) / BOOK.segments
      pageTop.push([x, y])
    }
  }
  const [foreX, foreY] = pageTop[BOOK.segments]
  const boards = edges(solid(new BoxGeometry(2 * foreX + 0.12, BOOK.board, BOOK.depth + 0.08)), DETAIL)
  boards.position.y = BOOK.board / 2
  book.add(boards)
  for (const side of [1, -1]) {
    const shape = new Shape()
    shape.moveTo(0, BOOK.board)
    shape.lineTo(0, BOOK.gutter)
    for (let i = 1; i <= BOOK.segments; i += 1) shape.lineTo(side * pageTop[i][0], pageTop[i][1])
    shape.quadraticCurveTo(side * (foreX + 0.035), (foreY + BOOK.board) / 2, side * foreX, BOOK.board)
    const geometry = new ExtrudeGeometry(shape, { depth: BOOK.depth, bevelEnabled: false, curveSegments: 8 })
    geometry.translate(0, 0, -BOOK.depth / 2)
    book.add(edges(solid(geometry)))
    // The page edges, fanning out from the gutter.
    const fan: number[] = []
    for (const t of [0.3, 0.55, 0.78]) {
      for (let k = 1; k < BOOK.segments - 1; k += 1) {
        const [x0, y0] = pageTop[k]
        const [x1, y1] = pageTop[k + 1]
        fan.push(side * x0, y0 - t * (y0 - BOOK.board), BOOK.depth / 2 + 0.003, side * x1, y1 - t * (y1 - BOOK.board), BOOK.depth / 2 + 0.003)
      }
    }
    book.add(segments(fan, DETAIL * 0.85, 'ink4'))
  }
  // The turning page, edge on: one ink curve, its free edge leading.
  const pagePositions = new Float32Array(BOOK.segments * 6)
  const page = segments(pagePositions, LINE)
  page.visible = false
  book.add(page)
  const setPage = (progress: number, peek: number) => {
    let x = 0
    let y = BOOK.gutter + 0.004
    const z = BOOK.depth / 2 + 0.006
    for (let k = 0; k < BOOK.segments; k += 1) {
      const u = (k + 0.5) / BOOK.segments
      const rest = restAngle(u)
      const a = peek ? rest + peek * u * u * 2.2 : rest + (Math.PI - 2 * rest) * easeInOut(clamp01(progress * 1.45 - (1 - u) * 0.45))
      const nx = x + (Math.cos(a) * BOOK.pageWidth) / BOOK.segments
      const ny = y + (Math.sin(a) * BOOK.pageWidth) / BOOK.segments
      pagePositions.set([x, y, z, nx, ny, z], k * 6)
      x = nx
      y = ny
    }
    markDirty(page)
  }

  // ── The laptop, turned a little so its screen shows.

  const laptop = new Group()
  laptop.userData.kind = 'laptop'
  laptop.position.x = DESK_LAYOUT.itemX
  laptop.rotation.y = -0.45
  laptop.visible = false
  scene.add(laptop)
  const base = edges(solid(new BoxGeometry(1.6, 0.05, 1.04)))
  base.position.y = 0.025
  laptop.add(base)
  const lid = new Group()
  lid.position.set(0, 0.05, -0.52)
  laptop.add(lid)
  const lidBoard = edges(solid(new BoxGeometry(1.6, 0.03, 1.02)))
  lidBoard.position.set(0, 0.015, 0.51)
  lid.add(lidBoard)
  const screenY = -0.004
  const screen: number[] = []
  rectangle(screen, -0.72, 0.06, 0.72, 0.96, screenY)
  rectangle(screen, -0.64, 0.52, -0.25, 0.78, screenY)
  rectangle(screen, -0.19, 0.52, 0.2, 0.78, screenY)
  rectangle(screen, 0.26, 0.52, 0.64, 0.78, screenY)
  screen.push(-0.64, screenY, 0.88, -0.18, screenY, 0.88)
  for (const [z, length] of [[0.41, 0.82], [0.33, 0.56], [0.25, 0.68]]) screen.push(-0.64, screenY, z, -0.64 + length, screenY, z)
  lid.add(segments(screen, DETAIL * 0.9, 'ink3'))
  const typingPositions = new Float32Array(12)
  const typing = segments(typingPositions, DETAIL * 1.1, 'ink3')
  lid.add(typing)

  // ── The coffee: saucer, cup, handle, and steam drawn in pencil.

  const drink = new Group()
  drink.userData.kind = 'drink'
  drink.position.set(DESK_LAYOUT.drinkX, 0, 0.2)
  scene.add(drink)
  const coffee = new Group()
  drink.add(coffee)
  coffee.add(hull(edges(solid(lathe([[0, 0], [0.19, 0], [0.21, 0.02], [0.45, 0.04], [0.49, 0.075], [0.465, 0.075], [0.22, 0.05], [0, 0.05]])), DETAIL, 25), DETAIL))
  coffee.add(hull(edges(solid(lathe([[0, 0.05], [0.17, 0.05], [0.19, 0.072], [0.27, 0.46], [0.285, 0.5], [0.262, 0.5], [0.25, 0.46], [0.17, 0.097], [0, 0.097]])), LINE, 35)))
  const handle = hull(solid(new TorusGeometry(0.11, 0.024, 10, 28, Math.PI * 1.15)))
  handle.rotation.z = -Math.PI * 0.575
  handle.position.set(0.285, 0.28, 0)
  coffee.add(handle)
  const steam = [-0.1, 0, 0.1].map((x, j) => {
    const positions = new Float32Array((STEAM_POINTS - 1) * 6)
    const object = segments(positions, 1.25, 'pencil')
    object.visible = false
    coffee.add(object)
    return { positions, object, x, offset: j * 1.07, phase: j * 1.9 }
  })
  // Each stroke draws itself upward, lifts, and is taken back from the bottom.
  const drawSteam = (t: number, amplitude: number) => {
    for (const s of steam) {
      const cycle = ((t + s.offset) / 3.2) % 1
      const head = easeOut(clamp01(cycle / 0.55))
      const tail = easeInOut(clamp01((cycle - 0.38) / 0.6))
      s.object.visible = head - tail > 0.02
      if (!s.object.visible) continue
      let px = 0
      let py = 0
      for (let i = 0; i < STEAM_POINTS; i += 1) {
        const q = tail + ((head - tail) * i) / (STEAM_POINTS - 1)
        const y = 0.56 + q * 0.68 * amplitude + cycle * 0.1
        const x = s.x + Math.sin(q * 2.3 * Math.PI + s.phase + t * 0.7) * 0.034 * (0.35 + q) * amplitude
        if (i) s.positions.set([px, py, 0.3, x, y, 0.3], (i - 1) * 6)
        px = x
        py = y
      }
      markDirty(s.object)
    }
  }

  // ── The iced cola: a glass drawn as lines, ice, bubbles and a straw.

  const cola = new Group()
  cola.visible = false
  drink.add(cola)
  const glass = [...circle(0.26, 0.72), ...circle(0.21, 0), ...circle(0.19, 0.05), 0.21, 0, 0, 0.26, 0.72, 0, -0.21, 0, 0, -0.26, 0.72, 0]
  cola.add(segments(glass, LINE))
  const liquid = edges(solid(new CylinderGeometry(0.24, 0.2, 0.44, 40), 'cola'), DETAIL)
  liquid.position.y = 0.27
  cola.add(liquid)
  const ice = [[-0.07, 0.04, 0.3], [0.08, -0.05, 1.1], [0.01, 0.08, 2.0]].map(([x, z, turn]) => {
    const cube = edges(solid(new BoxGeometry(0.13, 0.11, 0.13), 'ice'), DETAIL)
    cube.position.set(x, 0.5, z)
    cube.rotation.set(0.3, turn, 0.2)
    cola.add(cube)
    return { cube, turn }
  })
  const BUBBLES = 8
  const bubblePositions = new Float32Array(BUBBLES * 3)
  const bubbleSizes = new Float32Array(BUBBLES)
  const bubbles = Array.from({ length: BUBBLES }, (_, i) => {
    bubbleSizes[i] = 0.6 + Math.random() * 0.6
    return { x: (Math.random() - 0.5) * 0.28, y: 0.07 + Math.random() * 0.4, speed: 0.1 + Math.random() * 0.14 }
  })
  const bubbleGeometry = new BufferGeometry()
  bubbleGeometry.setAttribute('position', new BufferAttribute(bubblePositions, 3))
  bubbleGeometry.setAttribute('aSize', new BufferAttribute(bubbleSizes, 1))
  const bubbleMaterial = new ShaderMaterial({
    uniforms: { uColor: { value: new Vector3() }, uSize: { value: 4.2 * context.dpr } },
    vertexShader: BUBBLE_VERTEX,
    fragmentShader: BUBBLE_FRAGMENT,
    depthTest: false,
  })
  const bubblePoints = new Points(bubbleGeometry, bubbleMaterial)
  bubblePoints.frustumCulled = false
  bubblePoints.renderOrder = 5
  bubblePoints.raycast = () => {}
  cola.add(bubblePoints)
  const straw = hull(solid(new CylinderGeometry(0.02, 0.02, 0.9, 10)), LINE * 0.9)
  straw.position.set(0.05, 0.62, -0.05)
  straw.rotation.z = -0.2
  cola.add(straw)

  // ── The lamp: base, two sprung arms, shade and bulb.

  const lamp = new Group()
  lamp.userData.kind = 'lamp'
  lamp.position.set(DESK_LAYOUT.lampX, 0, -0.2)
  scene.add(lamp)
  lamp.add(hull(edges(solid(lathe([[0, 0], [0.36, 0], [0.37, 0.03], [0.3, 0.085], [0.12, 0.11], [0, 0.11]])), LINE, 25)))
  const switchMaterial = fill('paper')
  const lampSwitch = edges(new Mesh(new CylinderGeometry(0.05, 0.05, 0.03, 24), switchMaterial), DETAIL)
  lampSwitch.position.set(-0.22, 0.075, 0)
  lamp.add(lampSwitch)
  const joint = (radius: number) => hull(solid(new SphereGeometry(radius, 20, 14)), LINE * 0.9)
  const rod = (length: number) => {
    const geometry = new CylinderGeometry(0.03, 0.03, length, 12)
    geometry.translate(0, length / 2, 0)
    return hull(solid(geometry), LINE * 0.9)
  }
  const spring = (length: number, side: number) => {
    const points: [number, number, number][] = []
    const y0 = 0.16
    const y1 = length * 0.6
    for (let i = 0; i <= 160; i += 1) {
      const s = i / 160
      const a = s * 16 * Math.PI * 2
      points.push([side * 0.075 + Math.cos(a) * 0.02, y0 + s * (y1 - y0), Math.sin(a) * 0.02])
    }
    const out = segmentsOf(points)
    out.push(side * 0.03, y0, 0, side * 0.075, y0, 0, side * 0.03, y1, 0, side * 0.075, y1, 0)
    return segments(out, DETAIL * 0.8, 'ink3')
  }
  const [shoulderX, shoulderY] = LAMP_RIG.shoulder
  const shoulder = new Group()
  shoulder.position.set(shoulderX - DESK_LAYOUT.lampX, shoulderY, 0)
  lamp.add(shoulder)
  shoulder.add(joint(0.055), rod(LAMP_RIG.lowerArm), spring(LAMP_RIG.lowerArm, -1))
  const elbow = new Group()
  elbow.position.y = LAMP_RIG.lowerArm
  shoulder.add(elbow)
  elbow.add(joint(0.05), rod(LAMP_RIG.upperArm), spring(LAMP_RIG.upperArm, 1))
  const head = new Group()
  head.position.y = LAMP_RIG.upperArm
  head.rotation.order = 'ZYX'
  elbow.add(head)
  head.add(joint(0.045))
  head.add(hull(edges(solid(lathe([[0.06, 0], [0.09, -0.03], [0.14, -0.1], [0.22, -0.23], [0.29, -0.36], [0.305, -LAMP_RIG.mouth]]), 'paper', { side: DoubleSide, inner: true }), LINE, 25)))
  const cap = edges(solid(new CircleGeometry(0.06, 24)), DETAIL)
  cap.rotation.x = -Math.PI / 2
  head.add(cap)
  const bulb = hull(solid(new SphereGeometry(0.09, 20, 14), 'paper', { bulb: true }), DETAIL * 0.9)
  bulb.position.y = -0.27
  head.add(bulb)
  const haloCanvas = document.createElement('canvas')
  haloCanvas.width = haloCanvas.height = 64
  const haloContext = haloCanvas.getContext('2d')
  if (haloContext) {
    const g = haloContext.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    haloContext.fillStyle = g
    haloContext.fillRect(0, 0, 64, 64)
  }
  const haloTexture = new CanvasTexture(haloCanvas)
  haloTexture.colorSpace = SRGBColorSpace
  const haloMaterial = new SpriteMaterial({ map: haloTexture, color: new Color(HALO_COLOR), transparent: true, opacity: 0, depthWrite: false })
  const halo = new Sprite(haloMaterial)
  halo.scale.set(0.85, 0.85, 1)
  halo.position.y = -0.42
  halo.renderOrder = 6
  head.add(halo)

  // Generous invisible targets for the hinges and the shade; the arms are too thin to hit.
  const proxies: Mesh[] = []
  const proxy = (geometry: BufferGeometry, handle: LampHandle, parent: Object3D, priority: number) => {
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ visible: false, side: DoubleSide }))
    mesh.userData.handle = handle
    mesh.userData.priority = priority
    parent.add(mesh)
    proxies.push(mesh)
    return mesh
  }
  const lowerTarget = new CylinderGeometry(0.1, 0.1, LAMP_RIG.lowerArm * 0.7, 8)
  lowerTarget.translate(0, LAMP_RIG.lowerArm * 0.5, 0)
  proxy(lowerTarget, 'elbow', shoulder, 1)
  const upperTarget = new CylinderGeometry(0.1, 0.1, LAMP_RIG.upperArm * 0.8, 8)
  upperTarget.translate(0, LAMP_RIG.upperArm * 0.5, 0)
  proxy(upperTarget, 'head', elbow, 1)
  proxy(new SphereGeometry(0.17, 12, 8), 'elbow', elbow, 3)
  proxy(new SphereGeometry(0.17, 12, 8), 'head', head, 3)
  proxy(new SphereGeometry(0.3, 12, 8), 'shade', head, 2).position.y = -0.24

  // Pencil hints: dashed rings on the hinges, a dashed arc for turning the shade.
  const elbowRing = segments(dashedCircle(0.15, 12), DETAIL, 'pencil')
  const headRing = segments(dashedCircle(0.15, 12), DETAIL, 'pencil')
  const arcPositions = new Float32Array(7 * 3 * 6)
  const shadeArc = segments(arcPositions, DETAIL, 'pencil')
  for (const hint of [elbowRing, headRing, shadeArc]) {
    hint.material.transparent = true
    hint.material.opacity = 0
    hint.material.depthTest = false
    hint.renderOrder = 8
    hint.visible = false
    scene.add(hint)
  }

  // ── Colours and size.

  const applyColors = (colors: DeskColors) => {
    const drinks = drinkColors(colors.dark)
    const fillColor: Record<ColorKey, Rgb> = { paper: colors.paper, coffee: drinks.coffee, cola: drinks.cola, ice: drinks.ice }
    for (const { material, key } of fills) (material.uniforms.uBase.value as Vector3).set(...fillColor[key])
    ;(switchMaterial.uniforms.uBase.value as Vector3).set(...(params.lampOn ? colors.ink : colors.paper))
    const lineColor: Record<LineKey, Rgb> = { ink: colors.ink, ink3: colors.ink3, ink4: colors.ink4, pencil: colors.pencil }
    for (const { material, key } of lines) material.color.copy(toColor(lineColor[key]))
    hullColor.value.set(...colors.ink)
    ;(bubbleMaterial.uniforms.uColor.value as Vector3).set(...drinks.bubble)
    const warmth = warmthFor(colors.dark)
    shared.uWarmMul.value.set(...warmth.mul)
    shared.uWarmAdd.value.set(...warmth.add)
    haloMaterial.blending = colors.dark ? AdditiveBlending : NormalBlending
    haloMaterial.needsUpdate = true
  }

  const fitCamera = () => {
    const unit = params.unit
    const frustumWidth = width / unit
    const frustumHeight = height / unit
    // The desk line sits DESK_LINE_INSET px above the canvas bottom.
    deskY = (height / 2 - DESK_LINE_INSET) / unit
    camera.left = -frustumWidth / 2
    camera.right = frustumWidth / 2
    camera.top = frustumHeight / 2
    camera.bottom = -frustumHeight / 2
    camera.position.set(0, deskY, 20)
    camera.lookAt(0, deskY, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    bounds = { left: -frustumWidth / 2 + 0.3, right: frustumWidth / 2 - 0.1, top: deskY + frustumHeight / 2 - 0.1 }
    for (const { material, px } of hulls) material.uniforms.uThickness.value = px / unit
    for (const { material } of lines) material.resolution.set(width, height)
  }

  applyColors(params.colors)
  fitCamera()

  // ── State.

  const pose: LampPose = { ...params.pose }
  const shown: LampPose = { ...params.pose }
  let lampOn = params.lampOn
  // A lamp already on at load comes up quietly; only a switch flickers.
  let lightFrom = 0
  let dimFrom = 0
  let switchedAt = -10
  let startup = lampOn
  let light = 0
  let dim = 0
  let elapsed = 0
  let flipProgress = -1
  let nextFlip = 9 + Math.random() * 6
  let lidOpen = true
  let item = params.item
  let drinkKind = params.drink
  let turn = params.turn
  let hover: Hit | null = null
  let drag: { hit: Hit; x: number; y: number; moved: boolean; offset: number } | null = null
  let lastBeam = ''
  const elbowBounce: Spring = { x: 0, v: 0 }
  const press: Record<Kind, Spring> = { book: { x: 0, v: 0 }, laptop: { x: 0, v: 0 }, drink: { x: 0, v: 0 }, lamp: { x: 0, v: 0 } }
  const itemScale = { book: { x: item === 'book' ? 1 : 0, v: 0 }, laptop: { x: item === 'laptop' ? 1 : 0, v: 0 } }
  const drinkScale = { coffee: { x: drinkKind === 'coffee' ? 1 : 0, v: 0 }, cola: { x: drinkKind === 'cola' ? 1 : 0, v: 0 } }
  const lid0 = { x: -1.85, v: 0 }
  const peek: Spring = { x: 0, v: 0 }
  const steamAmplitude: Spring = { x: 1, v: 0 }
  const hints = { elbow: 0, head: 0, shade: 0 }

  const floor = () => deskFloor(drinkKind)

  // ── Picking and dragging.

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const pickables: Object3D[] = []
  for (const group of [book, laptop, drink, lamp]) {
    group.traverse((object) => {
      if (object instanceof Mesh && object.material instanceof ShaderMaterial && 'uBase' in object.material.uniforms) pickables.push(object)
    })
  }
  pickables.push(...proxies)
  const kindOf = (object: Object3D | null): Kind | null => {
    for (let o = object; o; o = o.parent) if (o.userData.kind) return o.userData.kind as Kind
    return null
  }
  const isShown = (object: Object3D | null) => {
    for (let o = object; o; o = o.parent) if (!o.visible || o.scale.x < 0.2) return false
    return true
  }
  // Pointer coordinates are on-screen px; the shell may be zoomed, so measure
  // the canvas on screen rather than trusting its layout size.
  const pick = (event: PointerEvent): Hit | null => {
    const rect = canvas.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    let best: Hit | null = null
    let bestPriority = -1
    for (const hit of raycaster.intersectObjects(pickables, false)) {
      if (!isShown(hit.object)) continue
      const kind = kindOf(hit.object)
      if (!kind) continue
      const priority = (hit.object.userData.priority as number | undefined) ?? 0
      if (priority > bestPriority) {
        bestPriority = priority
        best = { kind, handle: (hit.object.userData.handle as LampHandle | undefined) ?? null }
      }
    }
    return best
  }
  const toWorld = (event: PointerEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * (width / params.unit)
    const y = deskY - ((event.clientY - rect.top) / rect.height - 0.5) * (height / params.unit)
    return [x, y]
  }

  const act = (kind: Kind) => {
    if (kind === 'lamp') {
      params.onToggleLamp()
      return
    }
    press[kind].v -= 1.6
    if (kind === 'book') {
      if (flipProgress < 0) flipProgress = 0
    } else if (kind === 'laptop') lidOpen = !lidOpen
    else params.onSwapDrink()
    context.invalidate()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    const hit = pick(event)
    if (!hit) return
    const [x, y] = toWorld(event)
    drag = {
      hit,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      offset: hit.handle ? handleAngle(hit.handle, pose) - pointerAngle(hit.handle, pose, x, y) : 0,
    }
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // the pointer may already be gone
    }
    event.preventDefault()
  }
  const onPointerMove = (event: PointerEvent) => {
    if (drag) {
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 3) drag.moved = true
      if (drag.moved && drag.hit.handle) {
        canvas.style.cursor = 'grabbing'
        const [x, y] = toWorld(event)
        const angle = pointerAngle(drag.hit.handle, pose, x, y) + drag.offset
        Object.assign(pose, constrainPose(pose, withHandleAngle(drag.hit.handle, pose, angle), bounds, floor()))
        context.invalidate()
      }
      return
    }
    hover = pick(event)
    canvas.style.cursor = hover ? (hover.handle ? 'grab' : 'pointer') : ''
    context.invalidate()
  }
  const endDrag = (event: PointerEvent, cancelled: boolean) => {
    if (!drag) return
    const finished = drag
    drag = null
    try {
      canvas.releasePointerCapture(event.pointerId)
    } catch {
      // already released
    }
    canvas.style.cursor = hover ? (hover.handle ? 'grab' : 'pointer') : ''
    if (cancelled) return
    if (!finished.moved) act(finished.hit.kind)
    else if (finished.hit.handle) params.onPose({ ...pose })
    context.invalidate()
  }
  const onPointerUp = (event: PointerEvent) => endDrag(event, false)
  const onPointerCancel = (event: PointerEvent) => endDrag(event, true)
  const onPointerLeave = () => {
    if (drag) return
    hover = null
    canvas.style.cursor = ''
    context.invalidate()
  }
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('pointerleave', onPointerLeave)

  // ── The light handed to the page.

  const projected = new Vector3()
  const toCanvas = (world: Vector3): [number, number] => {
    projected.copy(world).project(camera)
    return [((projected.x + 1) / 2) * width, ((1 - projected.y) / 2) * height]
  }
  const mouthWorld = new Vector3()
  const axisWorld = new Vector3()
  const bulbWorld = new Vector3()
  const elbowWorld = new Vector3()
  const headWorld = new Vector3()
  const publishBeam = () => {
    if (light < 0.002 && dim < 0.002) {
      if (lastBeam !== 'off') {
        lastBeam = 'off'
        params.onBeam(null)
      }
      return
    }
    head.localToWorld(mouthWorld.set(0, -LAMP_RIG.mouth, 0))
    head.localToWorld(axisWorld.set(0, -LAMP_RIG.mouth - 1, 0))
    bulb.getWorldPosition(bulbWorld)
    const mouth = toCanvas(mouthWorld)
    const axis = toCanvas(axisWorld)
    const length = Math.hypot(axis[0] - mouth[0], axis[1] - mouth[1]) || 1
    const beam: LampBeam = {
      mouth,
      dir: [(axis[0] - mouth[0]) / length, (axis[1] - mouth[1]) / length],
      radius: LAMP_RIG.mouthRadius * params.unit,
      bulb: toCanvas(bulbWorld),
      light,
      dim,
    }
    const key = [beam.mouth[0], beam.mouth[1], beam.dir[0], beam.dir[1], light, dim, width, height].map((n) => n.toFixed(3)).join()
    if (key === lastBeam) return
    lastBeam = key
    params.onBeam(beam)
  }

  // ── The frame.

  const settle = (s: Spring, target: number, k: number, c: number, dt: number) => {
    if (still || dt === 0) {
      s.x = target
      s.v = 0
    } else step(s, target, k, c, dt)
  }
  // Out, then in: the leaving prop shrinks away before the other springs up.
  const swapPair = (out: Spring, into: Spring, dt: number) => {
    settle(out, 0, 260, 32, dt)
    if (out.x < 0) {
      out.x = 0
      out.v = 0
    }
    if (out.x < 0.08 || still || dt === 0) settle(into, 1, 220, 15, dt)
  }
  const scaled = (object: Object3D, s: number, squash = 0, factor = 1) => {
    object.visible = s > 0.01
    const k = Math.max(s, 1e-4) * factor
    object.scale.set(k, k * (1 + squash), k)
  }

  const frame = (dt: number, t: number) => {
    elapsed = t

    // The light: a flicker when switched on, an easy fade when switched off.
    const since = elapsed - switchedAt
    if (still) {
      light = lampOn ? 1 : 0
      dim = light
    } else if (lampOn && startup) {
      light = easeOut(clamp01(elapsed / 0.4))
      dim = light
      if (light >= 1) startup = false
    } else if (lampOn) {
      light = since < 0.27 ? Math.max(lightFrom, flicker(since)) : 1
      dim = dimFrom + (1 - dimFrom) * easeOut(clamp01((since - 0.1) / 0.55))
    } else {
      light = lightFrom * (1 - clamp01(since / 0.16))
      dim = dimFrom * (1 - easeInOut(clamp01(since / 0.34)))
    }
    shared.uLight.value = light
    haloMaterial.opacity = light * (params.colors.dark ? 0.55 : 0.45)

    // Props: swaps, presses, the laptop lid, the page.
    if (item === 'book') swapPair(itemScale.laptop, itemScale.book, dt)
    else swapPair(itemScale.book, itemScale.laptop, dt)
    if (drinkKind === 'coffee') swapPair(drinkScale.cola, drinkScale.coffee, dt)
    else swapPair(drinkScale.coffee, drinkScale.cola, dt)
    for (const kind of Object.keys(press) as Kind[]) settle(press[kind], 0, 300, 14, dt)
    scaled(book, itemScale.book.x, press.book.x)
    scaled(laptop, itemScale.laptop.x, press.laptop.x, 0.8)
    scaled(coffee, drinkScale.coffee.x)
    scaled(cola, drinkScale.cola.x)
    drink.scale.set(1, 1 + press.drink.x, 1)
    lampSwitch.position.y = 0.075 + press.lamp.x * 0.2
    settle(lid0, lidOpen ? -1.85 : -0.03, 80, 11, dt)
    lid.rotation.x = lid0.x

    if (flipProgress >= 0) {
      flipProgress += still ? 1 : dt / 1.2
      if (flipProgress >= 1) {
        flipProgress = -1
        page.visible = false
        nextFlip = elapsed + 9 + Math.random() * 6
      } else {
        page.visible = true
        setPage(flipProgress, 0)
      }
    } else {
      settle(peek, hover?.kind === 'book' ? 0.12 : 0, 90, 14, dt)
      page.visible = peek.x > 0.006
      if (page.visible) setPage(0, peek.x)
      if (!still && elapsed > nextFlip && item === 'book' && book.visible) flipProgress = 0
    }

    if (laptop.visible) {
      const typed = Math.floor(((t / 3.2) % 1) * 14) / 14
      const end = -0.64 + 0.9 * typed
      const caret = (t * 2) % 1 < 0.6 && lidOpen
      typingPositions.set([-0.64, screenY, 0.15, end, screenY, 0.15, end + 0.03, screenY, caret ? 0.11 : 0.15, end + 0.03, screenY, caret ? 0.19 : 0.15])
      markDirty(typing)
    }
    settle(steamAmplitude, hover?.kind === 'drink' ? 1.25 : 1, 40, 9, dt)
    if (coffee.visible) drawSteam(t, steamAmplitude.x)
    if (cola.visible) {
      ice.forEach(({ cube, turn: base }, i) => {
        cube.position.y = 0.5 + Math.sin(t * 1.3 + i * 2) * 0.01
        cube.rotation.y = base + Math.sin(t * 0.5 + i) * 0.15
      })
      bubbles.forEach((b, i) => {
        if (!still) {
          b.y += b.speed * dt
          if (b.y > 0.48) {
            b.y = 0.07
            b.x = (Math.random() - 0.5) * 0.28
          }
        }
        bubblePositions.set([b.x + Math.sin(t * 3 + i) * 0.008, b.y, 0.25], i * 3)
      })
      bubbleGeometry.attributes.position.needsUpdate = true
    }

    // The lamp eases toward its pose; switching bounces the elbow.
    const ease = still || dt === 0 ? 1 : 1 - Math.exp(-dt * 28)
    shown.a1 += (pose.a1 - shown.a1) * ease
    shown.a2 += (pose.a2 - shown.a2) * ease
    shown.a3 += (pose.a3 - shown.a3) * ease
    settle(elbowBounce, 0, 120, 7, dt)
    shoulder.rotation.z = shown.a1
    elbow.rotation.z = shown.a2 + elbowBounce.x
    head.rotation.set(LAMP_RIG.tilt, 0, shown.a3)
    scene.updateMatrixWorld()
    bulb.getWorldPosition(shared.uBulb.value)
    const shadeAngle = shown.a1 + shown.a2 + elbowBounce.x + shown.a3
    shared.uDir.value.set(
      Math.sin(shadeAngle) * Math.cos(LAMP_RIG.tilt),
      -Math.cos(shadeAngle) * Math.cos(LAMP_RIG.tilt),
      -Math.sin(LAMP_RIG.tilt),
    )

    // Hints: which parts of the lamp move, while it is pointed at or dragged.
    const active = drag?.hit.handle ?? (hover?.kind === 'lamp' ? hover.handle ?? 'lamp' : null)
    const target = drag?.hit.handle
      ? { elbow: active === 'elbow' ? 1 : 0.15, head: active === 'head' ? 1 : 0.15, shade: active === 'shade' ? 1 : 0 }
      : active
        ? { elbow: active === 'elbow' ? 1 : 0.4, head: active === 'head' ? 1 : 0.4, shade: active === 'shade' ? 1 : 0.3 }
        : { elbow: 0, head: 0, shade: 0 }
    const fade = still || dt === 0 ? 1 : 1 - Math.exp(-dt * 14)
    hints.elbow += (target.elbow - hints.elbow) * fade
    hints.head += (target.head - hints.head) * fade
    hints.shade += (target.shade - hints.shade) * fade
    const elbowAt = elbow.getWorldPosition(elbowWorld)
    const headAt = head.getWorldPosition(headWorld)
    for (const [ring, level, at] of [[elbowRing, hints.elbow, elbowAt], [headRing, hints.head, headAt]] as const) {
      ring.visible = level > 0.01
      ring.material.opacity = level
      ring.position.set(at.x, at.y, 1)
      ring.scale.setScalar(0.8 + 0.2 * level)
    }
    shadeArc.visible = hints.shade > 0.01
    if (shadeArc.visible) {
      shadeArc.material.opacity = hints.shade
      let n = 0
      for (let dash = 0; dash < 7; dash += 1) {
        const a0 = shadeAngle - 0.55 + dash * (1.1 / 7)
        const a1 = a0 + (1.1 / 7) * 0.55
        for (let j = 0; j < 3; j += 1) {
          const u0 = a0 + ((a1 - a0) * j) / 3
          const u1 = a0 + ((a1 - a0) * (j + 1)) / 3
          arcPositions.set([headAt.x + Math.sin(u0) * 0.64, headAt.y - Math.cos(u0) * 0.64, 1, headAt.x + Math.sin(u1) * 0.64, headAt.y - Math.cos(u1) * 0.64, 1], n)
          n += 6
        }
      }
      markDirty(shadeArc)
    }

    renderer.render(scene, camera)
    publishBeam()
  }

  const switchLamp = (on: boolean) => {
    lampOn = on
    startup = false
    switchedAt = elapsed
    lightFrom = light
    dimFrom = dim
    elbowBounce.v += on ? -0.7 : 0.5
    press.lamp.v -= 2.5
    ;(switchMaterial.uniforms.uBase.value as Vector3).set(...(on ? params.colors.ink : params.colors.paper))
  }

  return {
    update(next) {
      const previous = params
      params = next
      if (next.colors !== previous.colors) applyColors(next.colors)
      if (next.unit !== previous.unit) fitCamera()
      if (next.lampOn !== lampOn) switchLamp(next.lampOn)
      item = next.item
      drinkKind = next.drink
      if (next.pose !== previous.pose && !drag) Object.assign(pose, constrainPose(pose, next.pose, bounds, floor()))
      if (next.turn !== turn) {
        turn = next.turn
        act(item === 'book' ? 'book' : 'laptop')
      }
    },
    frame,
    resize(w, h) {
      width = w
      height = h
      fitCamera()
      lastBeam = ''
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.style.cursor = ''
      params.onBeam(null)
      scene.traverse((object) => {
        const mesh = object as Mesh
        mesh.geometry?.dispose()
        const material = mesh.material as { dispose?: () => void } | undefined
        material?.dispose?.()
      })
      haloTexture.dispose()
    },
  }
}

export const mount: SurfaceModule<DeskParams>['mount'] = (canvas, params, options) =>
  runSurface(canvas, factory, params, { fps: 120, maxDpr: 2, ...options })
