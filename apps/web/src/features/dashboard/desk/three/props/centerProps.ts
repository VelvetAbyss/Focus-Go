import { BoxGeometry, CircleGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, type Mesh, PlaneGeometry, Shape } from 'three'
import { DETAIL, LINE, clamp01, easeInOut, rectangle, ring, step, type Spring } from '../kit'
import type { DeskProp, PropEnv, PropOptions } from './common'

// The wide props (book, laptop, typewriter, record player). Each is seen
// exactly side on, or turned a little where its face matters (laptop, typewriter).

const BOOK = { pageWidth: 0.95, segments: 24, spineLift: 0.75, gutter: 0.062, board: 0.04, depth: 1.3 }

/** An open book seen end on: two page blocks rising from the gutter. A page
 *  turns every so often, or on a click; its corner lifts on hover. */
export const buildBook = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
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
  const boards = kit.edges(kit.solid(new BoxGeometry(2 * foreX + 0.12, BOOK.board, BOOK.depth + 0.08)), DETAIL)
  boards.position.y = BOOK.board / 2
  root.add(boards)
  for (const side of [1, -1]) {
    const shape = new Shape()
    shape.moveTo(0, BOOK.board)
    shape.lineTo(0, BOOK.gutter)
    for (let i = 1; i <= BOOK.segments; i += 1) shape.lineTo(side * pageTop[i][0], pageTop[i][1])
    shape.quadraticCurveTo(side * (foreX + 0.035), (foreY + BOOK.board) / 2, side * foreX, BOOK.board)
    const geometry = new ExtrudeGeometry(shape, { depth: BOOK.depth, bevelEnabled: false, curveSegments: 8 })
    geometry.translate(0, 0, -BOOK.depth / 2)
    root.add(kit.edges(kit.solid(geometry)))
    const fan: number[] = []
    for (const t of [0.3, 0.55, 0.78]) {
      for (let k = 1; k < BOOK.segments - 1; k += 1) {
        const [x0, y0] = pageTop[k]
        const [x1, y1] = pageTop[k + 1]
        const z = BOOK.depth / 2 + 0.003
        fan.push(side * x0, y0 - t * (y0 - BOOK.board), z, side * x1, y1 - t * (y1 - BOOK.board), z)
      }
    }
    root.add(kit.segments(fan, DETAIL * 0.85, 'ink4'))
  }
  // The turning page, edge on: one ink curve, its free edge leading.
  const pagePositions = new Float32Array(BOOK.segments * 6)
  const page = kit.segments(pagePositions, LINE)
  page.visible = false
  root.add(page)
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
    kit.markDirty(page)
  }

  let flip = -1
  let nextFlip = 9 + Math.random() * 6
  const peek: Spring = { x: 0, v: 0 }
  return {
    root,
    click() {
      if (flip < 0) flip = 0
    },
    frame(env: PropEnv) {
      if (flip >= 0) {
        flip += env.still ? 1 : env.dt / 1.2
        if (flip >= 1) {
          flip = -1
          page.visible = false
          nextFlip = env.t + 9 + Math.random() * 6
        } else {
          page.visible = true
          setPage(flip, 0)
        }
        return
      }
      const target = env.hovered ? 0.12 : 0
      if (env.still) peek.x = target
      else step(peek, target, 90, 14, env.dt)
      page.visible = peek.x > 0.006
      if (page.visible) setPage(0, peek.x)
      if (!env.still && env.t > nextFlip) flip = 0
    },
  }
}

/** A laptop turned a little so its screen shows; a line types itself and the
 *  lid opens and closes on a click. */
export const buildLaptop = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  const body = new Group()
  body.rotation.y = -0.45
  body.scale.setScalar(0.8)
  root.add(body)
  const base = kit.edges(kit.solid(new BoxGeometry(1.6, 0.05, 1.04)))
  base.position.y = 0.025
  body.add(base)
  const lid = new Group()
  lid.position.set(0, 0.05, -0.52)
  body.add(lid)
  const board = kit.edges(kit.solid(new BoxGeometry(1.6, 0.03, 1.02)))
  board.position.set(0, 0.015, 0.51)
  lid.add(board)
  const y = -0.004
  const screen: number[] = []
  rectangle(screen, -0.72, 0.06, 0.72, 0.96, y)
  rectangle(screen, -0.64, 0.52, -0.25, 0.78, y)
  rectangle(screen, -0.19, 0.52, 0.2, 0.78, y)
  rectangle(screen, 0.26, 0.52, 0.64, 0.78, y)
  screen.push(-0.64, y, 0.88, -0.18, y, 0.88)
  for (const [z, length] of [[0.41, 0.82], [0.33, 0.56], [0.25, 0.68]]) screen.push(-0.64, y, z, -0.64 + length, y, z)
  lid.add(kit.segments(screen, DETAIL * 0.9, 'ink3'))
  const typingPositions = new Float32Array(12)
  const typing = kit.segments(typingPositions, DETAIL * 1.1, 'ink3')
  lid.add(typing)

  let open = true
  const angle: Spring = { x: -1.85, v: 0 }
  return {
    root,
    click() {
      open = !open
    },
    frame(env) {
      const target = open ? -1.85 : -0.03
      if (env.still) angle.x = target
      else step(angle, target, 80, 11, env.dt)
      lid.rotation.x = angle.x
      const typed = Math.floor(((env.t / 3.2) % 1) * 14) / 14
      const end = -0.64 + 0.9 * typed
      const caret = (env.t * 2) % 1 < 0.6 && open
      typingPositions.set([-0.64, y, 0.15, end, y, 0.15, end + 0.03, y, caret ? 0.11 : 0.15, end + 0.03, y, caret ? 0.19 : 0.15])
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
  const root = new Group()
  const body = new Group()
  body.rotation.y = -0.42
  body.scale.setScalar(0.8)
  root.add(body)
  const base = kit.edges(kit.solid(new BoxGeometry(1.3, 0.14, 0.95)))
  base.position.y = 0.07
  body.add(base)
  const housing = kit.edges(kit.solid(new BoxGeometry(1.25, 0.2, 0.36)))
  housing.position.set(0, 0.24, -0.27)
  body.add(housing)
  const deck = new Group()
  deck.position.set(0, 0.16, 0.16)
  deck.rotation.x = 0.3
  body.add(deck)
  const plate = kit.edges(kit.solid(new BoxGeometry(1.2, 0.03, 0.56)), DETAIL)
  deck.add(plate)
  const keyGeometry = new CylinderGeometry(0.045, 0.045, 0.035, 18)
  const keys: { mesh: Mesh; spring: Spring }[] = []
  ;[0.17, 0.02, -0.13].forEach((z, row) => {
    for (let i = 0; i < 7 - row; i += 1) {
      const key = kit.edges(kit.solid(keyGeometry), DETAIL, 30)
      key.position.set(-0.39 + i * 0.13 + row * 0.065, 0.045, z)
      deck.add(key)
      keys.push({ mesh: key, spring: { x: 0, v: 0 } })
    }
  })
  const spacebar = kit.edges(kit.solid(new BoxGeometry(0.5, 0.03, 0.06)), DETAIL)
  spacebar.position.set(0, 0.04, 0.25)
  deck.add(spacebar)

  // The carriage: platen, knobs, return lever and the paper riding on it.
  const carriage = new Group()
  carriage.position.set(0, 0.45, -0.3)
  body.add(carriage)
  const platenGeometry = new CylinderGeometry(0.085, 0.085, 1.4, 24)
  platenGeometry.rotateZ(Math.PI / 2)
  carriage.add(kit.hull(kit.solid(platenGeometry)))
  for (const x of [-0.74, 0.74]) {
    const knobGeometry = new CylinderGeometry(0.06, 0.06, 0.06, 18)
    knobGeometry.rotateZ(Math.PI / 2)
    const knob = kit.hull(kit.solid(knobGeometry))
    knob.position.x = x
    carriage.add(knob)
  }
  carriage.add(kit.segments([-0.74, 0.06, 0, -0.86, 0.2, 0.05, -0.86, 0.2, 0.05, -0.96, 0.22, 0.08], DETAIL))
  const paper = new Group()
  paper.position.set(0, 0.27, -0.02)
  paper.rotation.x = -0.15
  carriage.add(paper)
  const sheet = kit.solid(new PlaneGeometry(0.8, 0.5), 'paper', { side: DoubleSide })
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
  const carriageX: Spring = { x: 0.36, v: 0 }

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
      pending += 6
    },
    frame(env) {
      // Typed keys plus a click's word, a few per frame at most.
      let budget = Math.min(3, env.keys)
      while (budget > 0) {
        typeOne(env.t)
        budget -= 1
      }
      if (pending > 0 && env.t - pendingAt > 0.07) {
        pending -= 1
        pendingAt = env.t
        typeOne(env.t)
      }
      for (const key of keys) {
        if (env.still) key.spring.x = 0
        else step(key.spring, 0, 400, 22, env.dt)
        key.mesh.position.y = 0.045 + Math.max(-0.03, key.spring.x * 0.02)
      }
      const column = lines[lines.length - 1].length
      const target = 0.36 - column * glyph
      if (env.still || env.t - returning > 0.4) {
        if (env.still) carriageX.x = target
        else step(carriageX, target, 260, 26, env.dt)
      } else step(carriageX, target, 60, 12, env.dt)
      carriage.position.x = carriageX.x
      bell.visible = env.t < bellUntil
      if (bell.visible) {
        const s = 1 + (bellUntil - env.t) * 0.4
        bellPositions.set([0.78, 0.12, 0.05, 0.86 * s, 0.2 * s, 0.05, 0.8, 0.16, 0.05, 0.92 * s, 0.17, 0.05, 0.8, 0.08, 0.05, 0.9 * s, 0.06, 0.05])
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
  const base = kit.edges(kit.solid(new BoxGeometry(1.4, 0.1, 0.5)))
  base.position.y = 0.05
  root.add(base)
  const postGeometry = new CylinderGeometry(0.04, 0.04, 0.34, 12)
  postGeometry.translate(0, 0.17, 0)
  const post = kit.hull(kit.solid(postGeometry), DETAIL)
  post.position.set(0, 0.1, -0.12)
  root.add(post)

  const record = new Group()
  record.position.set(0, 0.44, 0.02)
  root.add(record)
  const discGeometry = new CylinderGeometry(0.34, 0.34, 0.02, 64)
  discGeometry.rotateX(Math.PI / 2)
  record.add(kit.edges(kit.solid(discGeometry, 'vinyl'), DETAIL, 30))
  const spin = new Group()
  record.add(spin)
  const grooves = [0.315, 0.275, 0.235, 0.195].flatMap((r) => ring(r, 0, 0, 0.012, 64))
  spin.add(kit.segments(grooves, DETAIL * 0.8, 'groove'))
  const label = kit.solid(new CircleGeometry(0.12, 36))
  label.position.z = 0.0125
  spin.add(label)
  spin.add(kit.segments([...ring(0.12, 0, 0, 0.014, 36), -0.02, 0.055, 0.015, 0.065, 0.055, 0.015, ...ring(0.012, 0, 0, 0.015, 12)], DETAIL, 'ink'))
  // The sheen doesn't turn, so the record visibly does.
  const sheen: number[] = []
  for (let i = 0; i < 8; i += 1) {
    const a0 = 2.2 + i * 0.05
    const a1 = a0 + 0.05
    sheen.push(Math.cos(a0) * 0.26, Math.sin(a0) * 0.26, 0.016, Math.cos(a1) * 0.26, Math.sin(a1) * 0.26, 0.016)
  }
  record.add(kit.segments(sheen, DETAIL, 'pencil'))

  const armPostGeometry = new CylinderGeometry(0.03, 0.03, 0.76, 12)
  armPostGeometry.translate(0, 0.38, 0)
  const armPost = kit.hull(kit.solid(armPostGeometry), DETAIL)
  armPost.position.set(-0.5, 0.1, 0.04)
  root.add(armPost)
  const pivot = new Group()
  pivot.position.set(-0.5, 0.86, 0.06)
  root.add(pivot)
  pivot.add(kit.hull(kit.solid(new BoxGeometry(0.07, 0.07, 0.07)), DETAIL))
  const rodGeometry = new CylinderGeometry(0.014, 0.014, 0.44, 8)
  rodGeometry.translate(0, -0.22, 0)
  pivot.add(kit.hull(kit.solid(rodGeometry), DETAIL))
  const head = kit.edges(kit.solid(new BoxGeometry(0.09, 0.05, 0.05)), DETAIL)
  head.position.y = -0.44
  pivot.add(head)

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
      const armTarget = playing ? 0.55 : 0
      const speedTarget = playing ? 0.55 * Math.PI * 2 : 0
      if (env.still) {
        arm.x = armTarget
        speed.x = 0
      } else {
        step(arm, armTarget, 50, 10, env.dt)
        step(speed, speedTarget, 6, 5, env.dt)
      }
      pivot.rotation.z = arm.x
      turn -= speed.x * env.dt
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

