import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FrontSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Texture,
} from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { runSurface } from '../../../shared/three/runSurface'
import { hex, type SceneFactory, type SurfaceModule } from '../../../shared/three/surface'
import { beadRadiusFor, packJarWithin, pileTop, settleBead, type SettledBead, type Vec3 } from './beadPacking'
import { JAR_HEADROOM, JAR_NECK, JAR_OUTER, JAR_TILT, layoutJars, type JarSlot } from './jarLayout'
import type { JarSceneParams, JarSceneWeek } from './jarTypes'

/**
 * The completion jar: an open glass jar for the week on show and, on the same
 * plank, the sealed jars of earlier weeks. Beads are ink "jade", glossy under
 * a soft room light; the glass is a thin fresnel shell with a pencil outline;
 * sealed jars wear a paper lid and twine. Drawn on demand: nothing runs while
 * the picture is at rest.
 */

// ── Glass ─────────────────────────────────────────────────────────────────────

const GLASS_VERTEX = /* glsl */ `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Display-space output (no colour-space chunk), like the other hand-written shaders.
const GLASS_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uDark;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float facing = abs(n.z);
  float fresnel = pow(1.0 - facing, 2.4);
  // Two vertical glints where the window light catches the curve.
  float glint = smoothstep(0.55, 0.66, -n.x) * (1.0 - smoothstep(0.74, 0.86, -n.x));
  float glint2 = (smoothstep(0.82, 0.88, n.x) * (1.0 - smoothstep(0.92, 0.97, n.x))) * 0.55;
  float light = clamp(fresnel * 0.9 + glint + glint2, 0.0, 1.0);
  float alpha = (0.04 + fresnel * (0.42 - uDark * 0.12) + (glint + glint2) * (0.5 - uDark * 0.2)) * uOpacity;
  vec3 color = mix(uTint, vec3(1.0), light);
  gl_FragColor = vec4(color, alpha);
}
`

/** The jar's outline, bottom to lip, for a body `body` units tall. */
const jarProfile = (body: number) => {
  const p: [number, number][] = [
    [0.001, -0.08],
    [0.86, -0.08],
    [0.99, -0.06],
    [1.05, -0.02],
    [JAR_OUTER, 0.07],
    [JAR_OUTER, body],
    [1.06, body + 0.12],
    [0.98, body + 0.24],
    [0.87, body + 0.32],
    [0.8, body + 0.36],
    [0.8, body + JAR_NECK - 0.05],
    [0.85, body + JAR_NECK - 0.03],
    [0.85, body + JAR_NECK + 0.01],
    [0.8, body + JAR_NECK + 0.02],
  ]
  return p
}

const outlinePoints = (body: number) => {
  const profile = jarProfile(body).slice(3) // from the bottom edge up
  const points: number[] = []
  for (let i = profile.length - 1; i >= 0; i--) points.push(-profile[i][0], profile[i][1], 0)
  // Front half of the bottom edge, left to right.
  const r = profile[0][0]
  for (let i = 1; i < 24; i++) {
    const a = Math.PI - (i / 24) * Math.PI
    points.push(Math.cos(a) * r, profile[0][1], Math.sin(a) * r)
  }
  for (const [x, y] of profile) points.push(x, y, 0)
  return points
}

const rimPoints = (body: number) => {
  const points: number[] = []
  const y = body + JAR_NECK + 0.015
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2
    points.push(Math.cos(a) * 0.85, y, Math.sin(a) * 0.85)
  }
  return points
}

const shadowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(0,0,0,0.9)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.35)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  return new CanvasTexture(canvas)
}

// ── Packing cache ─────────────────────────────────────────────────────────────

type Packed = { ids: string[]; radius: number; beads: SettledBead[] }

const isPrefix = (a: readonly string[], b: readonly string[]) => a.length <= b.length && a.every((id, i) => id === b[i])

/** Packs a week, reusing the beads already settled when only new ones were added. */
const packWeek = (cache: Map<string, Packed>, week: JarSceneWeek, maxPile: number): Packed => {
  const cached = cache.get(week.key)
  const radius = beadRadiusFor(week.ids.length, maxPile)
  if (cached && cached.radius === radius && isPrefix(cached.ids, week.ids)) {
    if (cached.ids.length === week.ids.length) return cached
    const placed: Vec3[] = cached.beads.map((bead) => bead.position)
    const beads = [...cached.beads]
    for (const id of week.ids.slice(cached.ids.length)) {
      const bead = settleBead(placed, `${week.key}:${id}`, radius)
      placed.push(bead.position)
      beads.push(bead)
    }
    const next = { ids: [...week.ids], radius, beads }
    cache.set(week.key, next)
    return next
  }
  const fresh = packJarWithin(week.key, week.ids, maxPile)
  const next = { ids: [...week.ids], radius: fresh.radius, beads: fresh.beads }
  cache.set(week.key, next)
  return next
}

// ── Scene ─────────────────────────────────────────────────────────────────────

type JarView = {
  week: JarSceneWeek
  slot: JarSlot
  packed: Packed
  /** Target body height (jar units) and the one on screen while it eases. */
  body: number
  shown: number
  group: Group
  glassGeometry: LatheGeometry
  outline: Line2
  rim: Line2
  lid: Group | null
  /** Lid drop animation start (scene seconds), or -1. */
  sealStart: number
}

/** A bead falling in: from `fromY` above its first contact, then rolling along its path. */
type Drop = { view: JarView; index: number; start: number; fromY: number; fall: number; roll: number }

const G = 30 // jar units / s², tuned so a jar-height drop takes about half a second
const SEAL_TIME = 0.55
const BEAD_CAPACITY = 1024

const hashUnit = (value: string) => {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

const bodyHeightFor = (packed: Packed, sealed: boolean) => {
  const top = pileTop(packed.beads.map((bead) => bead.position), packed.radius)
  return sealed ? Math.max(0.55, top + 0.05) : Math.max(1.1, top + JAR_HEADROOM)
}

const createScene: SceneFactory<JarSceneParams> = (context, initial) => {
  const { renderer, still } = context
  let width = context.width
  let height = context.height
  let params = initial

  const scene = new Scene()
  const camera = new OrthographicCamera(0, width, height, 0, -2000, 2000)
  camera.position.set(0, 0, 1000)

  const pmrem = new PMREMGenerator(renderer)
  const environment: Texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  scene.environment = environment

  const key = new DirectionalLight(0xffffff, 1.35)
  key.position.set(-0.55, 1, 0.9)
  scene.add(key)
  const ambient = new AmbientLight(0xffffff, 0.3)
  scene.add(ambient)

  // Shared resources.
  // Ink jade: a dark, softly lit body under a clear coat that catches one glint.
  const beadMaterial = new MeshPhysicalMaterial({ roughness: 0.42, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.18 })
  const beads = new InstancedMesh(new SphereGeometry(1, 28, 20), beadMaterial, BEAD_CAPACITY)
  beads.frustumCulled = false
  beads.count = 0
  scene.add(beads)

  const glassUniforms = { uTint: { value: hex(initial.colors.paper) }, uOpacity: { value: 1 }, uDark: { value: initial.dark ? 1 : 0 } }
  const glassBack = new ShaderMaterial({ vertexShader: GLASS_VERTEX, fragmentShader: GLASS_FRAGMENT, uniforms: { ...glassUniforms, uOpacity: { value: 0.45 } }, transparent: true, depthWrite: false, side: BackSide })
  const glassFront = new ShaderMaterial({ vertexShader: GLASS_VERTEX, fragmentShader: GLASS_FRAGMENT, uniforms: glassUniforms, transparent: true, depthWrite: false, side: FrontSide })
  const lineMaterial = new LineMaterial({ linewidth: 1.15, transparent: true, opacity: 0.85 })
  lineMaterial.resolution.set(width, height)
  const lidMaterial = new MeshStandardMaterial({ roughness: 0.92, metalness: 0 })
  const twineMaterial = new MeshStandardMaterial({ roughness: 1, metalness: 0 })
  const shadowMap = shadowTexture()
  const shadowMaterial = new MeshStandardMaterial({ map: shadowMap, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.2 })
  const lidGeometry = new CylinderGeometry(0.95, 0.95, 0.22, 40)
  const twineGeometry = new TorusGeometry(0.815, 0.028, 8, 48)
  const shadowGeometry = new PlaneGeometry(3, 1.6)

  const plank = new Group()
  const plankMaterial = new MeshStandardMaterial({ roughness: 0.95, metalness: 0 })
  let plankMesh: Mesh | null = null
  let plankEdge: Line2 | null = null
  scene.add(plank)

  const cache = new Map<string, Packed>()
  let views: JarView[] = []
  let drops: Drop[] = []
  let time = 0
  let lastAnimation = -1
  const matrix = new Matrix4()
  const beadMatrix = new Matrix4()
  const beadColor = new Color()
  const baseColor = new Color()

  const applyColors = () => {
    const { colors, dark } = params
    baseColor.set(colors.bead)
    beadMaterial.roughness = dark ? 0.38 : 0.42
    beadMaterial.clearcoat = dark ? 0.7 : 1
    beadMaterial.envMapIntensity = dark ? 0.45 : 0.18
    lineMaterial.color.set(colors.pencil)
    lidMaterial.color.set(colors.lid)
    twineMaterial.color.set(colors.twine)
    plankMaterial.color.set(colors.plank)
    shadowMaterial.opacity = dark ? 0.4 : 0.2
    const tint = hex(colors.paper)
    glassUniforms.uTint.value = tint
    glassBack.uniforms.uTint.value = tint
    glassUniforms.uDark.value = dark ? 1 : 0
    glassBack.uniforms.uDark.value = dark ? 1 : 0
  }

  const disposeView = (view: JarView) => {
    scene.remove(view.group)
    view.glassGeometry.dispose()
    view.outline.geometry.dispose()
    view.rim.geometry.dispose()
    view.lid?.traverse((child) => {
      if (child instanceof Line2) child.geometry.dispose()
    })
  }

  const setBody = (view: JarView, body: number) => {
    view.shown = body
    view.glassGeometry.dispose()
    view.glassGeometry = new LatheGeometry(jarProfile(body).map(([r, y]) => new Vector2(r, y)), 56)
    for (const child of view.group.children) {
      if (child instanceof Mesh && child.userData.glass) child.geometry = view.glassGeometry
    }
    view.outline.geometry.dispose()
    const outline = new LineGeometry()
    outline.setPositions(outlinePoints(body))
    view.outline.geometry = outline
    view.outline.computeLineDistances()
    view.rim.geometry.dispose()
    const rim = new LineGeometry()
    rim.setPositions(rimPoints(body))
    view.rim.geometry = rim
    if (view.lid) view.lid.position.y = body + JAR_NECK - 0.02
  }

  const buildView = (week: JarSceneWeek, slot: JarSlot): JarView => {
    const packed = packWeek(cache, week, slot.maxPile)
    const body = bodyHeightFor(packed, week.sealed)
    const group = new Group()
    group.position.set(slot.x, slot.baseY, 0)
    group.rotation.x = JAR_TILT
    group.scale.setScalar(slot.scale)

    const shadow = new Mesh(shadowGeometry, shadowMaterial)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.005
    shadow.renderOrder = 1
    group.add(shadow)

    const glassGeometry = new LatheGeometry(jarProfile(body).map(([r, y]) => new Vector2(r, y)), 56)
    const back = new Mesh(glassGeometry, glassBack)
    back.userData.glass = true
    back.renderOrder = 2
    const front = new Mesh(glassGeometry, glassFront)
    front.userData.glass = true
    front.renderOrder = 4
    group.add(back, front)

    const outlineGeometry = new LineGeometry()
    outlineGeometry.setPositions(outlinePoints(body))
    const outline = new Line2(outlineGeometry, lineMaterial)
    outline.renderOrder = 5
    const rimGeometry = new LineGeometry()
    rimGeometry.setPositions(rimPoints(body))
    const rim = new Line2(rimGeometry, lineMaterial)
    rim.renderOrder = 5
    group.add(outline, rim)

    let lid: Group | null = null
    if (week.sealed) {
      lid = new Group()
      const cap = new Mesh(lidGeometry, lidMaterial)
      cap.position.y = 0.11
      const twine = new Mesh(twineGeometry, twineMaterial)
      twine.rotation.x = Math.PI / 2
      twine.position.y = -0.1
      // A pencil edge on the paper, so the lid reads on a white card.
      const edge = new LineGeometry()
      const ring: number[] = []
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2
        ring.push(Math.cos(a) * 0.95, 0.22, Math.sin(a) * 0.95)
      }
      edge.setPositions(ring)
      const lidEdge = new Line2(edge, lineMaterial)
      lidEdge.renderOrder = 5
      lid.add(cap, twine, lidEdge)
      lid.position.y = body + JAR_NECK - 0.02
      lid.renderOrder = 3
      group.add(lid)
    }
    scene.add(group)
    return { week, slot, packed, body, shown: body, group, glassGeometry, outline, rim, lid, sealStart: -1 }
  }

  const rebuildPlank = () => {
    if (plankMesh) {
      plank.remove(plankMesh)
      plankMesh.geometry.dispose()
    }
    if (plankEdge) {
      plank.remove(plankEdge)
      plankEdge.geometry.dispose()
    }
    const layout = layoutJars(width, height, params.main.key, params.main.sealed, params.shelf.map((week) => week.key))
    const length = layout.plank.right - layout.plank.left
    const depth = 34
    const box = new BoxGeometry(length, 3, depth)
    box.translate(0, -1.5, 0)
    plankMesh = new Mesh(box, plankMaterial)
    plankMesh.renderOrder = 0
    plank.add(plankMesh)
    const edge = new LineGeometry()
    edge.setPositions([-length / 2, 0, depth / 2, length / 2, 0, depth / 2])
    plankEdge = new Line2(edge, lineMaterial)
    plank.add(plankEdge)
    plank.position.set((layout.plank.left + layout.plank.right) / 2, layout.plank.y, 0)
    plank.rotation.x = JAR_TILT
  }

  /** Lays out the jars and syncs views with the weeks in `params`. */
  const sync = () => {
    const layout = layoutJars(width, height, params.main.key, params.main.sealed, params.shelf.map((week) => week.key))
    const wanted: { week: JarSceneWeek; slot: JarSlot }[] = [{ week: params.main, slot: layout.main }]
    layout.shelf.forEach((slot, index) => wanted.push({ week: params.shelf[index], slot }))

    const next: JarView[] = []
    for (const { week, slot } of wanted) {
      const existing = views.find((view) => view.week.key === week.key && view.week.sealed === week.sealed && view.slot.scale === slot.scale)
      if (existing) {
        existing.week = week
        existing.slot = slot
        existing.group.position.set(slot.x, slot.baseY, 0)
        existing.packed = packWeek(cache, week, slot.maxPile)
        existing.body = bodyHeightFor(existing.packed, week.sealed)
        next.push(existing)
      } else {
        next.push(buildView(week, slot))
      }
    }
    for (const view of views) if (!next.includes(view)) disposeView(view)
    views = next
    rebuildPlank()
  }

  const placeBeads = () => {
    let count = 0
    for (const view of views) {
      view.group.updateMatrixWorld(true)
      matrix.copy(view.group.matrixWorld)
      const { beads: settled, radius } = view.packed
      for (let i = 0; i < settled.length && count < BEAD_CAPACITY; i++) {
        let position: Vec3 | null = settled[i].position
        const drop = drops.find((d) => d.view === view && d.index === i)
        if (drop) position = dropPosition(drop, settled[i])
        if (!position) continue
        beadMatrix.makeScale(radius, radius, radius).setPosition(position[0], position[1], position[2])
        beadMatrix.premultiply(matrix)
        beads.setMatrixAt(count, beadMatrix)
        const shade = 0.9 + hashUnit(`${view.week.key}:${view.packed.ids[i]}`) * 0.18
        beadColor.copy(baseColor).multiplyScalar(shade)
        beads.setColorAt(count, beadColor)
        count++
      }
    }
    beads.count = count
    beads.instanceMatrix.needsUpdate = true
    if (beads.instanceColor) beads.instanceColor.needsUpdate = true
  }

  /** Where a falling bead is now, or null before it appears. */
  const dropPosition = (drop: Drop, bead: SettledBead): Vec3 | null => {
    const elapsed = time - drop.start
    if (elapsed < 0) return null
    const { path } = bead
    const contactIndex = Math.max(0, bead.contactIndex)
    const at = (index: number): Vec3 => {
      const i = Math.min(path.length - 1, Math.max(0, index))
      const lo = Math.floor(i)
      const hi = Math.min(path.length - 1, lo + 1)
      const f = i - lo
      return [path[lo][0] + (path[hi][0] - path[lo][0]) * f, path[lo][1] + (path[hi][1] - path[lo][1]) * f, path[lo][2] + (path[hi][2] - path[lo][2]) * f]
    }
    if (elapsed < drop.fall) {
      // Straight down (the path above the first contact is vertical), speeding up.
      const u = elapsed / drop.fall
      const contact = path[contactIndex]
      return [contact[0], drop.fromY + (contact[1] - drop.fromY) * u * u, contact[2]]
    }
    const u = Math.min(1, (elapsed - drop.fall) / drop.roll)
    const eased = 1 - (1 - u) ** 3
    return at(contactIndex + eased * (path.length - 1 - contactIndex))
  }

  const startAnimations = () => {
    drops = []
    if (still) return
    const main = views[0]
    if (main && params.dropFrom !== null) {
      const from = Math.max(0, params.dropFrom)
      main.packed.beads.slice(from).forEach((bead, offset) => {
        // Fall from above the jar's mouth, not just above the pile.
        const fromY = Math.max(bead.path[0][1], main.body + JAR_NECK + 0.4)
        const contactY = bead.path[Math.max(0, bead.contactIndex)][1]
        const fall = Math.sqrt((2 * Math.max(0.2, fromY - contactY)) / G)
        const roll = Math.min(0.6, 0.16 + (bead.path.length - bead.contactIndex) * 0.002)
        drops.push({ view: main, index: from + offset, start: time + offset * 0.22, fromY, fall, roll })
      })
    }
    if (params.sealKey) {
      const sealed = views.find((view) => view.week.key === params.sealKey && view.lid)
      if (sealed) sealed.sealStart = time
    }
  }

  const tick = (dt: number) => {
    let moving = false
    for (const view of views) {
      if (Math.abs(view.shown - view.body) > 0.002) {
        const next = still ? view.body : view.shown + (view.body - view.shown) * (1 - Math.exp(-dt * 9))
        setBody(view, Math.abs(next - view.body) < 0.002 ? view.body : next)
        moving = moving || view.shown !== view.body
      }
      if (view.lid && view.sealStart >= 0) {
        const u = Math.min(1, (time - view.sealStart) / SEAL_TIME)
        const eased = 1 - (1 - u) ** 3
        view.lid.position.y = view.shown + JAR_NECK - 0.02 + (1 - eased) * 1.6
        if (u >= 1) view.sealStart = -1
        else moving = true
      }
    }
    drops = drops.filter((drop) => time - drop.start < drop.fall + drop.roll)
    return moving || drops.length > 0
  }

  applyColors()
  sync()
  placeBeads()

  return {
    update(next) {
      params = next
      applyColors()
      sync()
      if (next.animationId !== lastAnimation) {
        lastAnimation = next.animationId
        startAnimations()
      }
      placeBeads()
    },
    frame(dt) {
      time += dt
      const moving = tick(dt)
      placeBeads()
      renderer.render(scene, camera)
      return moving
    },
    resize(nextWidth, nextHeight) {
      width = nextWidth
      height = nextHeight
      camera.right = width
      camera.top = height
      camera.updateProjectionMatrix()
      lineMaterial.resolution.set(width, height)
      sync()
      placeBeads()
    },
    dispose() {
      for (const view of views) disposeView(view)
      views = []
      beads.geometry.dispose()
      beadMaterial.dispose()
      glassBack.dispose()
      glassFront.dispose()
      lineMaterial.dispose()
      lidMaterial.dispose()
      twineMaterial.dispose()
      shadowMaterial.dispose()
      shadowMap.dispose()
      lidGeometry.dispose()
      twineGeometry.dispose()
      shadowGeometry.dispose()
      plankMaterial.dispose()
      plankMesh?.geometry.dispose()
      plankEdge?.geometry.dispose()
      environment.dispose()
    },
  }
}

export const mount: SurfaceModule<JarSceneParams>['mount'] = (canvas, params, options) =>
  runSurface(canvas, createScene, params, { ...options, onDemand: true })
