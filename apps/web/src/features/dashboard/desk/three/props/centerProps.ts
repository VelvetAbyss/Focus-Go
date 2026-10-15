import { staticSource } from '../sourceModels'
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  type Mesh,
  PlaneGeometry,
  Shape,
} from 'three'
import { DETAIL, easeInOut, rectangle, ring, step, type Spring } from '../kit'
import type { DeskProp, PropEnv, PropOptions } from './common'
import { roundedBox, rodBetween } from './modeling'

// The wide props (book, laptop, typewriter, record player). Each is seen
// exactly side on, or turned a little where its face matters (laptop, typewriter).

const BOOK = { width: 0.89, depth: 1.12, segments: 32, gutter: 0.1 }

/** A sewn spine, two independent boards, page blocks and a deforming 3D leaf. */
export const buildBook = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  const profile = (u: number) => BOOK.gutter + 0.11 * Math.sin(u * Math.PI) - 0.035 * u
  for (const side of [-1, 1]) {
    const cover = kit.hull(kit.solid(roundedBox(0.94, 0.035, 1.2, 0.012)), DETAIL)
    cover.position.set(side * 0.47, 0.0175, 0)
    root.add(cover)
    const shape = new Shape()
    shape.moveTo(0, 0.048)
    shape.lineTo(0, profile(0))
    for (let i = 1; i <= BOOK.segments; i++) shape.lineTo((side * BOOK.width * i) / BOOK.segments, profile(i / BOOK.segments))
    shape.lineTo(side * BOOK.width, 0.048)
    shape.closePath()
    const geometry = new ExtrudeGeometry(shape, { depth: BOOK.depth, bevelEnabled: false })
    geometry.translate(0, 0, -BOOK.depth / 2)
    root.add(kit.edges(kit.solid(geometry)))
    const fan: number[] = []
    for (const fraction of [0.24, 0.48, 0.72])
      for (let i = 0; i < BOOK.segments; i++) {
        const u = i / BOOK.segments,
          v = (i + 1) / BOOK.segments
        for (const z of [-BOOK.depth / 2 - 0.002, BOOK.depth / 2 + 0.002])
          fan.push(
            side * u * BOOK.width,
            0.048 + (profile(u) - 0.048) * fraction,
            z,
            side * v * BOOK.width,
            0.048 + (profile(v) - 0.048) * fraction,
            z,
          )
      }
    root.add(kit.segments(fan, 0.8, 'ink4'))
  }
  root.add(kit.segments([0, 0.048, 0.602, 0, 0.096, 0.562], DETAIL, 'ink3'))
  // A real two-sided sheet, with shared front/back edge samples. No per-frame allocation.
  const vertices = new Float32Array((BOOK.segments + 1) * 2 * 3)
  const indices: number[] = []
  for (let i = 0; i < BOOK.segments; i++) {
    const j = i * 2
    indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  const sheet = kit.solid(geometry, 'paper', { side: DoubleSide })
  sheet.name = 'turning-page'
  sheet.frustumCulled = false
  const outline = new Float32Array((BOOK.segments * 2 + 2) * 6)
  const edge = kit.segments(outline, DETAIL)
  const page = new Group()
  page.add(sheet, edge)
  page.visible = false
  root.add(page)
  const setPage = (progress: number, peek: number) => {
    const angle = Math.PI * easeInOut(progress)
    for (let i = 0; i <= BOOK.segments; i++) {
      const u = i / BOOK.segments,
        r = u * BOOK.width
      const curl = Math.sin(Math.PI * progress) * Math.sin(Math.PI * u) * 0.12
      const x = Math.cos(angle) * r
      const y = profile(u) + 0.004 + Math.sin(angle) * r + curl + peek * u * u
      vertices.set([x, y, -BOOK.depth / 2, x, y, BOOK.depth / 2], i * 6)
    }
    let n = 0
    for (let i = 0; i < BOOK.segments; i++)
      for (let side = 0; side < 2; side++) {
        outline.set(vertices.subarray(i * 6 + side * 3, i * 6 + side * 3 + 3), n)
        n += 3
        outline.set(vertices.subarray((i + 1) * 6 + side * 3, (i + 1) * 6 + side * 3 + 3), n)
        n += 3
      }
    for (const i of [0, BOOK.segments]) {
      outline.set(vertices.subarray(i * 6, i * 6 + 6), n)
      n += 6
    }
    geometry.attributes.position.needsUpdate = true
    geometry.computeBoundingSphere()
    kit.markDirty(edge)
  }
  let flip = -1,
    nextFlip = 12,
    requested = false
  const peek: Spring = { x: 0, v: 0 }
  return {
    root,
    click() {
      requested = true
    },
    frame(env: PropEnv) {
      if (requested) {
        requested = false
        if (!env.still && flip < 0) flip = 0
      }
      if (flip >= 0) {
        flip += env.still ? 1 : env.dt / 1.15
        if (flip >= 1) {
          flip = -1
          nextFlip = env.t + 12
          page.visible = false
        } else {
          page.visible = true
          setPage(flip, 0)
        }
        return
      }
      const target = env.hovered && !env.still ? 0.055 : 0
      if (env.still) {
        peek.x = target
        peek.v = 0
      } else step(peek, target, 90, 16, env.dt)
      page.visible = peek.x > 0.001
      if (page.visible) setPage(0, peek.x)
      if (!env.still && env.t >= nextFlip) flip = 0
    },
  }
}

/** A milled base, key deck and a lid whose underside meets the base when shut. */
export const buildLaptop = ({ kit }: PropOptions): DeskProp => {
  const root = new Group(), body = new Group()
  root.add(body)
  body.rotation.y = -0.28
  const model = staticSource('laptop', 1.45, kit)
  const lid = new Group()
  lid.name = 'laptop-hinge'
  lid.position.set(0, 0.077, -0.485)
  body.add(lid)
  for (const mesh of [...model.children] as Mesh[]) {
    if (mesh.name.startsWith('mesh256948792')) {
      // The source is open at 90 degrees. Bake the panel into a closed local
      // pose first; the animated hinge then uses the same hard stops as before.
      mesh.geometry.translate(0, -0.0272, 0.500)
      mesh.geometry.rotateX(Math.PI / 2)
      // Crease geometry was constructed before the bake; rebuild its lines.
      const lines = mesh.children.filter(c => !c.userData.outline)
      for (const line of lines) { mesh.remove(line); kit.release(line) }
      kit.edges(mesh, 0.55, 42, 'ink3')
      lid.add(mesh)
    } else body.add(mesh)
  }
  const screen: number[] = []
  rectangle(screen, -0.68, 0.065, 0.68, 0.91, -0.019)
  screen.push(-0.58, -0.021, 0.69, 0.02, -0.021, 0.69)
  for (let i = 0; i < 3; i++) {
    rectangle(screen, -0.58 + i * 0.4, 0.37, -0.25 + i * 0.4, 0.59, -0.021)
  }
  for (const [z, length] of [
    [0.29, 0.95],
    [0.22, 0.65],
  ])
    screen.push(-0.58, -0.021, z, -0.58 + length, -0.021, z)
  lid.add(kit.segments(screen, 0.85, 'ink3'))
  const camera = kit.solid(new CircleGeometry(0.012, 12), 'vinyl')
  camera.rotation.x = Math.PI / 2
  camera.position.set(0, -0.020, 0.955)
  lid.add(camera)
  const ports: number[] = []
  for (const z of [-0.21, -0.08]) ports.push(-0.751, 0.025, z, -0.751, 0.025, z + 0.07)
  body.add(kit.segments(ports, DETAIL, 'ink3'))
  const typingPositions = new Float32Array(12),
    typing = kit.segments(typingPositions, DETAIL, 'pen')
  lid.add(typing)
  let open = true
  const angle: Spring = { x: -1.87, v: 0 }
  return {
    root,
    click() {
      open = !open
    },
    frame(env) {
      const target = open ? -1.87 : 0
      if (env.still) {
        angle.x = target
        angle.v = 0
      } else step(angle, target, 90, 19, env.dt)
      // The physical hinge has a hard stop; the lid never passes through the base.
      angle.x = Math.min(0, Math.max(-1.95, angle.x))
      lid.rotation.x = angle.x
      typing.visible = open
      const t = env.still ? 1.6 : env.t,
        end = -0.58 + (0.85 * Math.floor(((t / 3.2) % 1) * 14)) / 14
      const caret = env.still || (t * 2) % 1 < 0.6
      typingPositions.set([
        -0.58,
        -0.021,
        0.14,
        end,
        -0.021,
        0.14,
        end + 0.025,
        -0.021,
        caret ? 0.11 : 0.14,
        end + 0.025,
        -0.021,
        caret ? 0.17 : 0.14,
      ])
      kit.markDirty(typing)
    },
  }
}

const TYPE_COLUMNS = 38
const TYPE_LINES = 5

/**
 * A typewriter, turned to show its keys. It types along whenever a key is
 * pressed anywhere in the app (only the fact, never which key); the carriage
 * creeps left, rings at the end of a line and returns. A click types a word.
 */
export const buildTypewriter = ({ kit }: PropOptions): DeskProp => {
  const root = new Group(), body = new Group()
  body.rotation.y = -0.28
  root.add(body)
  const model = staticSource('typewriter', 1.24, kit)
  const carriage = new Group()
  carriage.name = 'typewriter-carriage'
  body.add(carriage)
  const keys: { mesh: Mesh; spring: Spring }[] = []
  for (const mesh of [...model.children] as Mesh[]) {
    if (/Key/.test(mesh.name) && !/KeyTHingy/.test(mesh.name)) {
      keys.push({ mesh, spring: { x: 0, v: 0 } })
      body.add(mesh)
    } else if (/group2_Typewriter_(pCylinder[567]|pCube[45])$/.test(mesh.name)) {
      carriage.add(mesh)
    } else body.add(mesh)
  }
  const paper = new Group()
  paper.position.set(0.043, 0.44, -0.35)
  paper.rotation.x = -0.12
  carriage.add(paper)
  const sheet = kit.solid(new PlaneGeometry(0.8, 0.48), 'paper', { side: DoubleSide })
  paper.add(kit.edges(sheet, DETAIL))
  const glyph = 0.019
  const textPositions = new Float32Array(TYPE_LINES * TYPE_COLUMNS * 6)
  const text = kit.segments(textPositions, DETAIL * 1.4, 'ink3')
  paper.add(text)
  const bellPositions = new Float32Array(3 * 6)
  const bell = kit.segments(bellPositions, DETAIL, 'pencil')
  bell.visible = false
  carriage.add(bell)

  // Lines on the page: the oldest scroll off the top. Spaces are skipped.
  const lines: boolean[][] = [[]]
  let pending = 0
  let pendingAt = 0
  let returning = 0
  let bellUntil = 0
  const carriageX: Spring = { x: 0.18, v: 0 }

  // Each run of letters is drawn as one word; spaces leave gaps.
  const drawText = () => {
    textPositions.fill(0)
    let n = 0
    lines.forEach((line, k) => {
      const y = -0.17 + (lines.length - 1 - k) * 0.07
      if (y > 0.2) return
      let start = -1
      for (let i = 0; i <= line.length; i += 1) {
        const filled = i < line.length && line[i]
        if (filled && start < 0) start = i
        if (!filled && start >= 0) {
          textPositions.set([-0.36 + start * glyph, y, 0.004, -0.36 + i * glyph - glyph * 0.3, y, 0.004], n)
          n += 6
          start = -1
        }
      }
    })
    kit.markDirty(text)
  }
  const typeOne = (t: number) => {
    const line = lines[lines.length - 1]
    line.push(Math.random() > 0.18)
    const key = keys[Math.floor(Math.random() * keys.length)]
    key.spring.v -= 1.4
    if (line.length >= TYPE_COLUMNS) {
      lines.push([])
      if (lines.length > TYPE_LINES) lines.shift()
      returning = t
      bellUntil = t + 0.6
    }
    drawText()
  }

  return {
    root,
    click() {
      pending = Math.min(60, pending + 6)
    },
    frame(env) {
      // Typed keys plus a click's word, a few per frame at most.
      let budget = Math.min(3, env.keys)
      while (budget > 0) {
        typeOne(env.t)
        budget -= 1
      }
      if (env.still) {
        while (pending > 0) {
          pending -= 1
          typeOne(env.t)
        }
      }
      if (pending > 0 && env.t - pendingAt > 0.07) {
        pending -= 1
        pendingAt = env.t
        typeOne(env.t)
      }
      for (const key of keys) {
        if (env.still) key.spring.x = 0
        else step(key.spring, 0, 400, 22, env.dt)
        key.mesh.position.y = Math.max(-0.006, key.spring.x * 0.02)
      }
      const column = lines[lines.length - 1].length
      const target = 0.18 - column * (0.36 / TYPE_COLUMNS)
      if (env.still || env.t - returning > 0.4) {
        if (env.still) carriageX.x = target
        else step(carriageX, target, 260, 26, env.dt)
      } else step(carriageX, target, 60, 12, env.dt)
      carriage.position.x = carriageX.x
      bell.visible = !env.still && env.t < bellUntil
      if (bell.visible) {
        const s = 1 + (bellUntil - env.t) * 0.4
        bellPositions.set([
          0.78,
          0.12,
          0.05,
          0.86 * s,
          0.2 * s,
          0.05,
          0.8,
          0.16,
          0.05,
          0.92 * s,
          0.17,
          0.05,
          0.8,
          0.08,
          0.05,
          0.9 * s,
          0.06,
          0.05,
        ])
        kit.markDirty(bell)
      }
    },
  }
}

/**
 * A vertical record player: the record stands facing you, so it can be seen
 * turning. A click lowers the arm and the record spins up; pencil notes rise
 * while it plays.
 */
export const buildRecordPlayer = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  const plinthShape = new Shape()
  plinthShape.moveTo(-0.58, 0.075)
  plinthShape.lineTo(0.48, 0.075)
  plinthShape.quadraticCurveTo(0.6, 0.075, 0.6, 0.2)
  plinthShape.lineTo(0.6, 0.88)
  plinthShape.quadraticCurveTo(0.6, 1.02, 0.46, 1.02)
  plinthShape.quadraticCurveTo(0.4, 1.02, 0.31, 0.97)
  plinthShape.lineTo(-0.55, 0.31)
  plinthShape.quadraticCurveTo(-0.66, 0.23, -0.66, 0.17)
  plinthShape.quadraticCurveTo(-0.66, 0.075, -0.58, 0.075)
  const plinthGeometry = new ExtrudeGeometry(plinthShape, { depth: 0.065, bevelEnabled: false, curveSegments: 16 })
  plinthGeometry.translate(0, 0, -0.14)
  const plinth = kit.edges(kit.solid(plinthGeometry), DETAIL)
  plinth.name = 'record-plinth'
  root.add(plinth)
  for (const x of [-0.43, 0.45]) {
    const foot = kit.hull(kit.edges(kit.solid(new CylinderGeometry(0.055, 0.07, 0.075, 24)), 0.8), DETAIL)
    foot.position.set(x, 0.0375, -0.09)
    root.add(foot)
  }
  root.add(rodBetween(kit, [0.37, 0.75, -0.14], [0.37, 0.035, -0.45], 0.025))
  const rearFoot = kit.hull(kit.edges(kit.solid(new CylinderGeometry(0.055, 0.065, 0.05, 24)), 0.8), DETAIL)
  rearFoot.position.set(0.37, 0.025, -0.45)
  root.add(rearFoot)
  const record = new Group()
  record.position.set(-0.12, 0.55, 0)
  root.add(record)
  const spin = new Group()
  spin.name = 'record-spin'
  record.add(spin)
  const discGeometry = new CylinderGeometry(0.425, 0.425, 0.035, 64)
  discGeometry.rotateX(Math.PI / 2)
  spin.add(kit.edges(kit.solid(discGeometry, 'vinyl'), DETAIL))
  spin.add(
    kit.segments(
      [0.4, 0.34, 0.28, 0.22].flatMap((r) => ring(r, 0, 0, 0.02, 64)),
      0.7,
      'groove',
    ),
  )
  const label = kit.solid(new CircleGeometry(0.125, 40))
  label.position.z = 0.021
  spin.add(label)
  spin.add(kit.segments([...ring(0.125, 0, 0, 0.023, 40), -0.06, 0.07, 0.024, 0.055, 0.07, 0.024], 0.8, 'ink3'))
  const clamp = kit.hull(kit.edges(kit.solid(new CylinderGeometry(0.055, 0.06, 0.055, 32)), 0.8), DETAIL)
  clamp.rotation.x = Math.PI / 2
  clamp.position.z = 0.045
  spin.add(clamp)
  const motor = kit.hull(kit.edges(kit.solid(new CylinderGeometry(0.06, 0.06, 0.065, 24)), 0.8), DETAIL)
  motor.rotation.x = Math.PI / 2
  motor.position.set(-0.55, 0.18, -0.04)
  root.add(motor)
  const pivot = new Group()
  pivot.name = 'record-tonearm'
  pivot.position.set(0.46, 0.87, 0.08)
  root.add(pivot)
  const bearing = kit.hull(kit.edges(kit.solid(new CylinderGeometry(0.065, 0.065, 0.07, 24)), 0.8), DETAIL)
  bearing.rotation.x = Math.PI / 2
  pivot.add(bearing)
  pivot.add(rodBetween(kit, [0, 0.13, 0], [0, -0.66, 0], 0.014))
  const weight = kit.hull(kit.edges(kit.solid(new CylinderGeometry(0.035, 0.035, 0.07, 24)), 0.8), DETAIL)
  weight.position.y = 0.12
  pivot.add(weight)
  const cartridge = kit.hull(kit.solid(roundedBox(0.06, 0.08, 0.05, 0.008)), DETAIL)
  cartridge.position.set(0, -0.66, 0)
  pivot.add(cartridge)
  cartridge.add(rodBetween(kit, [0, -0.03, 0], [0, -0.045, -0.06], 0.005))
  root.add(rodBetween(kit, [0.46, 0.26, -0.075], [0.46, 0.26, 0.08], 0.014))

  // Notes: an ink head and stem rising in pencil and fading.
  const notes = [0, 1, 2].map((i) => {
    const out: number[] = [...ring(0.03, 0, 0, 0, 14), 0.03, 0, 0, 0.03, 0.13, 0, 0.03, 0.13, 0, 0.08, 0.09, 0]
    const object = kit.segments(out, DETAIL, 'pencil')
    object.material.transparent = true
    object.visible = false
    root.add(object)
    return { object, offset: i * 0.9, x: -0.05 - i * 0.12 }
  })

  let playing = false
  const arm: Spring = { x: 0, v: 0 }
  const speed: Spring = { x: 0, v: 0 }
  let turn = 0
  return {
    root,
    click() {
      playing = !playing
    },
    frame(env) {
      const armTarget = playing ? -0.47 : 0
      const speedTarget = playing ? (100 / 3 / 60) * Math.PI * 2 : 0
      if (env.still) {
        arm.x = armTarget
        speed.x = 0
      } else {
        step(arm, armTarget, 50, 10, env.dt)
        step(speed, speedTarget, 6, 5, env.dt)
      }
      pivot.rotation.z = arm.x
      turn = (turn - speed.x * env.dt) % (Math.PI * 2)
      spin.rotation.z = turn
      for (const note of notes) {
        const cycle = ((env.t + note.offset) / 2.7) % 1
        note.object.visible = playing && !env.still
        if (!note.object.visible) continue
        note.object.position.set(note.x + Math.sin(cycle * 6 + note.offset) * 0.05, 0.82 + cycle * 0.5, 0.05)
        note.object.material.opacity = Math.sin(cycle * Math.PI)
      }
    },
  }
}

export const centerPropBuilders = {
  book: buildBook,
  laptop: buildLaptop,
  typewriter: buildTypewriter,
  record: buildRecordPlayer,
}
