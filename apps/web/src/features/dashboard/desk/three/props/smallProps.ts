import { staticSource } from '../sourceModels'
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  Points,
  SRGBColorSpace,
  ShaderMaterial,
  Shape,
  ExtrudeGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  AdditiveBlending,
  Box3,
  type Mesh,
  NormalBlending,
} from 'three'
import { DETAIL, LINE, circle, createRisers, step, type Spring } from '../kit'
import type { DeskProp, PropEnv, PropOptions } from './common'
import { roundedBox, rodBetween, tube } from './modeling'

// The small props (drinks, the plant, the kitchen timer, the candle).
// Each has an idle motion and one thing a click does.

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

const settle = (s: Spring, target: number, k: number, c: number, env: PropEnv) => {
  if (env.still) {
    s.x = target
    s.v = 0
  } else step(s, target, k, c, env.dt)
}

const glowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** A cup on a saucer with pencil steam. A click is a sip: the steam puffs up. */
export const buildCoffee = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  const saucer = kit.hull(
    kit.solid(
      kit.lathe([
        [0, 0],
        [0.19, 0],
        [0.2, 0.014],
        [0.45, 0.035],
        [0.47, 0.055],
        [0.45, 0.069],
        [0.23, 0.048],
        [0, 0.048],
      ]),
    ),
    DETAIL,
  )
  root.add(saucer)
  const cup = new Group()
  cup.position.y = 0.048
  root.add(cup)
  const vessel = kit.hull(
    kit.edges(
      kit.solid(
        kit.lathe([
          [0, 0],
          [0.16, 0],
          [0.18, 0.02],
          [0.255, 0.4],
          [0.269, 0.44],
          [0.247, 0.44],
          [0.235, 0.4],
          [0.155, 0.055],
          [0, 0.055],
        ]),
      ),
      DETAIL,
      40,
    ),
  )
  cup.add(vessel)
  const coffee = kit.solid(new CylinderGeometry(0.228, 0.228, 0.004, 48), 'coffee')
  coffee.position.y = 0.386
  cup.add(coffee)
  const handle = kit.hull(
    kit.solid(
      tube(
        [
          [0.244, 0.35, 0],
          [0.36, 0.35, 0],
          [0.4, 0.27, 0],
          [0.36, 0.17, 0],
          [0.207, 0.14, 0],
        ],
        0.022,
      ),
    ),
    DETAIL,
  )
  cup.add(handle)
  const steam = createRisers(
    kit,
    cup,
    [
      { x: -0.1, z: 0.3, offset: 0, phase: 0 },
      { x: 0, z: 0.3, offset: 1.07, phase: 1.9 },
      { x: 0.1, z: 0.3, offset: 2.13, phase: 3.8 },
    ],
    { from: 0.46, rise: 0.58, sway: 0.026, period: 3.2 },
  )
  const amplitude: Spring = { x: 1, v: 0 }
  const tilt: Spring = { x: 0, v: 0 }
  return {
    root,
    click() {
      amplitude.v += 4
      tilt.v += 1.2
    },
    frame(env) {
      settle(amplitude, env.hovered ? 1.25 : 1, 40, 9, env)
      settle(tilt, 0, 90, 10, env)
      cup.rotation.z = tilt.x * 0.1
      cup.position.y = 0.048 + Math.abs(Math.sin(cup.rotation.z)) * 0.18
      steam.draw(env.still ? 1.2 : env.t, Math.max(0.6, amplitude.x))
    },
  }
}

/** A glass of iced cola: ice bobbing, bubbles rising. A click fizzes it. */
export const buildCola = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  // A closed, thin glass wall; the interior liquid never intersects the rim.
  const wall = kit.solid(
    kit.lathe([
      [0, 0],
      [0.205, 0],
      [0.26, 0.72],
      [0.242, 0.72],
      [0.187, 0.045],
      [0, 0.045],
    ]),
    'paper',
    { opacity: 0.08 },
  )
  wall.name = 'glass-wall'
  root.add(wall)
  root.add(
    kit.segments(
      [
        ...circle(0.26, 0.72),
        ...circle(0.242, 0.72),
        ...circle(0.205, 0),
        ...circle(0.187, 0.045),
        -0.205,
        0,
        0,
        -0.26,
        0.72,
        0,
        0.205,
        0,
        0,
        0.26,
        0.72,
        0,
      ],
      LINE,
    ),
  )
  const liquid = kit.edges(kit.solid(new CylinderGeometry(0.224, 0.188, 0.44, 40), 'cola'), DETAIL)
  liquid.position.y = 0.265
  root.add(liquid)
  const ice = [
    [-0.07, 0.04, 0.3],
    [0.08, -0.05, 1.1],
    [0.01, 0.08, 2.0],
  ].map(([x, z, turn]) => {
    const cube = kit.hull(kit.solid(roundedBox(0.13, 0.11, 0.13, 0.014), 'ice'), 0.8)
    cube.position.set(x, 0.5, z)
    cube.rotation.set(0.3, turn, 0.2)
    root.add(cube)
    return { cube, turn, jiggle: { x: 0, v: 0 } as Spring }
  })
  const count = 8
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const bubbles = Array.from({ length: count }, (_, i) => {
    sizes[i] = 0.6 + Math.random() * 0.6
    return { x: (Math.random() - 0.5) * 0.28, y: 0.07 + Math.random() * 0.4, speed: 0.1 + Math.random() * 0.14 }
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: new Vector3() }, uSize: { value: 4.2 * (window.devicePixelRatio || 1) } },
    vertexShader: BUBBLE_VERTEX,
    fragmentShader: BUBBLE_FRAGMENT,
    depthTest: true,
    depthWrite: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 5
  points.raycast = () => {}
  root.add(points)
  const straw = rodBetween(kit, [0.035, 0.31, -0.06], [0.15, 0.86, -0.06], 0.018)
  straw.name = 'cola-straw'
  root.add(straw)
  let fizzUntil = 0
  let t = 0
  return {
    root,
    click() {
      fizzUntil = t + 1.5
      for (const cube of ice) cube.jiggle.v += 3
    },
    frame(env) {
      t = env.t
      const bubble = kit.colors().dark ? [0.56, 0.52, 0.48] : [0.79, 0.74, 0.69]
      ;(material.uniforms.uColor.value as Vector3).set(bubble[0], bubble[1], bubble[2])
      const fizz = env.t < fizzUntil ? 3 : 1
      ice.forEach(({ cube, turn, jiggle }, i) => {
        settle(jiggle, 0, 200, 8, env)
        cube.position.y = 0.5 + Math.sin((env.still ? 0 : env.t) * 1.3 + i * 2) * 0.01 + jiggle.x * 0.01
        cube.rotation.y = turn + Math.sin((env.still ? 0 : env.t) * 0.5 + i) * 0.15 + jiggle.x * 0.1
      })
      bubbles.forEach((b, i) => {
        if (!env.still) {
          b.y += b.speed * fizz * env.dt
          if (b.y > 0.48) {
            b.y = 0.07
            b.x = (Math.random() - 0.5) * 0.28
          }
        }
        const x = b.x + Math.sin((env.still ? 0 : env.t) * 3 + i) * 0.008
        const r = 0.188 + ((b.y - 0.045) / 0.44) * 0.036
        positions.set([x, b.y, Math.sqrt(Math.max(0, r * r - x * x)) + 0.003], i * 3)
      })
      geometry.attributes.position.needsUpdate = true
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

/** A leaf along +x from its stalk, a midrib down its middle. */
const leafGeometry = (length: number, width: number) => {
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(length * 0.45, width, length, 0)
  shape.quadraticCurveTo(length * 0.45, -width, 0, 0)
  const geometry = new ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: false, curveSegments: 10 })
  geometry.translate(0, 0, -0.004)
  return geometry
}

/**
 * A potted plant whose leaves sway. With the lamp on it leans toward the
 * light; a click waters it, and the leaves give a little bounce.
 */
export const buildPlant = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  root.add(
    kit.hull(
      kit.edges(
        kit.solid(
          kit.lathe([
            [0, 0],
            [0.15, 0],
            [0.185, 0.27],
            [0.21, 0.27],
            [0.21, 0.32],
            [0.175, 0.32],
            [0.168, 0.29],
            [0, 0.29],
          ]),
        ),
        LINE,
        30,
      ),
    ),
  )
  const soil = kit.solid(new CylinderGeometry(0.167, 0.167, 0.008, 32), 'coffee')
  soil.position.y = 0.29
  root.add(soil)
  const stems = [
    {
      x: -0.04,
      angle: 0.28,
      length: 0.42,
      leaves: [
        [0.2, -1],
        [0.36, 1],
      ],
    },
    {
      x: 0.02,
      angle: -0.06,
      length: 0.51,
      leaves: [
        [0.2, 1],
        [0.37, -1],
      ],
    },
    { x: 0.06, angle: -0.36, length: 0.38, leaves: [[0.18, 1]] },
  ].map((spec, i) => {
    const pivot = new Group()
    pivot.position.set(spec.x, 0.29, 0.02 * i)
    root.add(pivot)
    const bend = 0.06 * Math.sign(spec.angle || 1)
    const stem: number[] = []
    for (let k = 0; k < 8; k += 1) {
      const a = k / 8
      const b = (k + 1) / 8
      stem.push(Math.sin(a * Math.PI) * bend, a * spec.length, 0, Math.sin(b * Math.PI) * bend, b * spec.length, 0)
    }
    pivot.add(
      kit.hull(
        kit.solid(
          tube(
            Array.from({ length: 9 }, (_, k) => [Math.sin((k / 8) * Math.PI) * bend, (k / 8) * spec.length, 0] as [number, number, number]),
            0.009,
            16,
          ),
        ),
        0.7,
      ),
    )
    const leaves = [...spec.leaves, [spec.length, 0]].map(([at, side], j) => {
      const leaf = new Group()
      leaf.position.set(Math.sin((at / spec.length) * Math.PI) * bend, at, 0.004)
      leaf.rotation.z = Math.PI / 2 - side * 1.05
      leaf.rotation.y = j % 2 === 0 ? -0.15 : 0.15
      const length = side === 0 ? 0.14 : 0.25 - j * 0.025
      const blade = kit.solid(leafGeometry(length, length * 0.48))
      leaf.add(kit.edges(blade, DETAIL, 30))
      leaf.add(kit.segments([0.01, 0, 0.006, length * 0.85, 0, 0.006], DETAIL * 0.8, 'ink3'))
      pivot.add(leaf)
      return { leaf, base: leaf.rotation.z, phase: Math.random() * 6 }
    })
    return { pivot, base: spec.angle, sway: { x: 0, v: 0 } as Spring, leaves }
  })
  // Water: a few pencil drops falling into the pot.
  const dropPositions = new Float32Array(4 * 6)
  const drops = kit.segments(dropPositions, DETAIL, 'pencil')
  drops.visible = false
  root.add(drops)
  let wateredAt = -10
  let waterBounced = true
  let t = 0
  const lean: Spring = { x: 0, v: 0 }
  const here = new Vector3()
  return {
    root,
    click() {
      wateredAt = t
      waterBounced = false
    },
    frame(env) {
      t = env.t
      root.getWorldPosition(here)
      // Toward the bulb: a positive turn about z leans the stems to -x.
      const toward = env.light > 0.05 ? -Math.sign(env.bulb.x - here.x) * 0.2 * env.light : 0
      settle(lean, toward, 6, 4, env)
      const since = env.t - wateredAt
      drops.visible = since < 0.6 && !env.still
      if (drops.visible) {
        for (let i = 0; i < 4; i += 1) {
          const y = 1.0 - since * 1.2 - i * 0.07
          const x = -0.08 + i * 0.05
          dropPositions.set([x, y, 0.1, x, y - 0.05, 0.1], i * 6)
        }
        kit.markDirty(drops)
      }
      if (!waterBounced && since >= 0.55) {
        waterBounced = true
        for (const stem of stems) stem.sway.v -= 2.5
      }
      stems.forEach((stem, i) => {
        settle(stem.sway, 0, 60, 4, env)
        const breeze = env.still ? 0 : Math.sin(env.t * (0.9 + i * 0.2) + i * 1.7) * 0.035
        stem.pivot.rotation.z = stem.base + breeze + lean.x + stem.sway.x * 0.15
        for (const leaf of stem.leaves) leaf.leaf.rotation.z = leaf.base + (env.still ? 0 : Math.sin(env.t * 1.6 + leaf.phase) * 0.06)
      })
    },
  }
}

const TIMER = { centre: 0.22 }

/**
 * A tomato kitchen timer. Twist it (the wheel over it) to set up to an hour
 * and it starts once the wheel rests; a click starts 25 minutes, or stops it. The dial winds
 * back as time runs out, the mark turns to the pen while it runs, and it
 * rings with a shake.
 */
export const buildTimer = ({ kit, timer }: PropOptions): DeskProp => {
  const root = new Group()
  const body = new Group()
  root.add(body)
  const shell = kit.hull(
    kit.solid(
      kit.lathe([
        [0, 0],
        [0.14, 0],
        ...Array.from({ length: 25 }, (_, i) => {
          const a = -1.05 + (i / 24) * 1.05
          return [0.3 * Math.cos(a), 0.215 + 0.24 * Math.sin(a)] as [number, number]
        }),
        [0, 0.215],
      ]),
    ),
    DETAIL,
  )
  body.add(shell)
  const dial = new Group()
  dial.name = 'timer-dial'
  dial.position.y = 0.22
  body.add(dial)
  const crown = kit.hull(
    kit.solid(
      kit.lathe([
        [0, 0],
        ...Array.from({ length: 25 }, (_, i) => {
          const a = ((i / 24) * Math.PI) / 2
          return [0.3 * Math.cos(a), 0.2 * Math.sin(a) - 0.008 * Math.pow(i / 24, 8)] as [number, number]
        }),
      ]),
    ),
    DETAIL,
  )
  dial.add(crown)
  const ticks: number[] = []
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2
    const y = m % 5 === 0 ? 0.036 : 0.021,
      r = 0.3 * Math.sqrt(1 - (y / 0.2) ** 2) + 0.002
    ticks.push(Math.sin(a) * 0.302, 0.004, Math.cos(a) * 0.302, Math.sin(a) * r, y, Math.cos(a) * r)
  }
  dial.add(kit.segments(ticks, 0.7, 'ink3'))
  // Small line digits wrap around the scale; they rotate with the numbered half.
  const digitPaths = [
    ['ab', 'bc', 'cd', 'de', 'ef', 'fa'],
    ['bc', 'cd'],
    ['ab', 'bc', 'fg', 'ed', 'dc'],
    ['ab', 'bc', 'fg', 'cd', 'de'],
    ['af', 'fg', 'bc', 'cd'],
    ['ab', 'af', 'fg', 'cd', 'de'],
    ['ab', 'af', 'fg', 'ef', 'de', 'cd'],
    ['ab', 'bc', 'cd'],
    ['ab', 'bc', 'cd', 'de', 'ef', 'fa', 'fg'],
    ['ab', 'bc', 'cd', 'de', 'fa', 'fg'],
  ]
  const points: Record<string, [number, number]> = { a: [0, 1], b: [1, 1], c: [1, 0.5], d: [1, 0], e: [0, 0], f: [0, 0.5], g: [1, 0.5] }
  const digits: number[] = []
  for (let m = 0; m < 60; m += 5) {
    const text = String(m),
      a = (m / 60) * Math.PI * 2
    for (let j = 0; j < text.length; j++)
      for (const segment of digitPaths[Number(text[j])]) {
        for (const k of segment) {
          const [x, y] = points[k],
            u = (j - (text.length - 1) / 2) * 0.026 + (x - 0.5) * 0.018
          const theta = a + u / 0.295
          const height = 0.052 + y * 0.027,
            r = 0.3 * Math.sqrt(1 - (height / 0.2) ** 2) + 0.002
          digits.push(Math.sin(theta) * r, height, Math.cos(theta) * r)
        }
      }
  }
  dial.add(kit.segments(digits, 0.65, 'ink3'))
  const stalk = rodBetween(kit, [0, 0.19, 0], [0.012, 0.245, 0], 0.013)
  dial.add(stalk)
  for (let i = 0; i < 5; i++) {
    const leaf = kit.edges(kit.solid(leafGeometry(0.11, 0.026)), 0.7)
    leaf.rotation.x = Math.PI / 2
    const petal = new Group()
    petal.position.y = 0.197
    petal.rotation.y = (i / 5) * Math.PI * 2
    petal.add(leaf)
    dial.add(petal)
  }
  const mark = kit.segments([-0.018, 0.181, 0.294, 0, 0.209, 0.294, 0, 0.209, 0.294, 0.018, 0.181, 0.294], DETAIL, 'ink3')
  body.add(mark)
  const ringPositions = new Float32Array(4 * 4 * 6)
  const rings = kit.segments(ringPositions, DETAIL, 'pencil')
  rings.visible = false
  root.add(rings)

  let angle = 0
  // Twisting: the wheel turns the dial; it starts once the wheel rests.
  let twisting: { minutes: number; at: number } | null = null
  let ringUntil = 0
  let now = Date.now()
  const turnFor = (minutes: number) => (minutes / 60) * Math.PI * 2
  return {
    root,
    click() {
      twisting = null
      if (timer.get()) timer.set(null)
      else timer.set(Date.now() + 25 * 60000)
    },
    wheel(delta) {
      now = Date.now()
      const endsAt = timer.get()
      const from = twisting?.minutes ?? (endsAt ? Math.max(0, (endsAt - now) / 60000) : 0)
      // Wheel up winds it on: a couple of minutes per notch of a mouse wheel.
      twisting = { minutes: Math.min(60, Math.max(0, from - delta / 40)), at: performance.now() }
    },
    frame(env) {
      now = env.now
      const endsAt = timer.get()
      const remaining = endsAt ? Math.max(0, endsAt - env.now) / 60000 : 0
      if (endsAt && remaining <= 0) {
        timer.set(null)
        ringUntil = env.t + 1.6
      }
      if (twisting && performance.now() - twisting.at > 700) {
        timer.set(twisting.minutes >= 0.5 ? env.now + Math.round(twisting.minutes) * 60000 : null)
        twisting = null
      }
      const target = turnFor(twisting ? twisting.minutes : remaining)
      angle = env.still ? target : angle + (target - angle) * Math.min(1, env.dt * (twisting ? 18 : 10))
      dial.rotation.y = angle
      kit.setLineKey(mark, endsAt || twisting ? 'pen' : 'ink3')
      const ringing = env.t < ringUntil && !env.still
      body.position.x = ringing ? Math.sin(env.t * 70) * 0.012 : 0
      body.rotation.z = ringing ? Math.sin(env.t * 55) * 0.05 : 0
      rings.visible = ringing
      if (ringing) {
        let n = 0
        for (const side of [-1, 1]) {
          for (let k = 0; k < 2; k += 1) {
            const radius = 0.3 + k * 0.07 + ((env.t * 0.6) % 0.07)
            for (let j = 0; j < 2; j += 1) {
              const a0 = -0.5 + j * 0.5
              const a1 = a0 + 0.45
              ringPositions.set(
                [
                  side * Math.cos(a0) * radius,
                  TIMER.centre + Math.sin(a0) * radius,
                  0.2,
                  side * Math.cos(a1) * radius,
                  TIMER.centre + Math.sin(a1) * radius,
                  0.2,
                ],
                n,
              )
              n += 6
            }
          }
        }
        kit.markDirty(rings)
      }
    },
  }
}

const CANDLE = { full: 0.61, stub: 0.12, burnSeconds: 40 * 60 }

/**
 * A candle on a dish. A click lights it or blows it out (a curl of smoke);
 * lit, it flickers, warms the paper around it and slowly burns down. A spent
 * candle is replaced on the next click.
 */
export const buildCandle = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  root.add(
    kit.hull(
      kit.edges(
        kit.solid(
          kit.lathe([
            [0, 0],
            [0.2, 0],
            [0.24, 0.03],
            [0.22, 0.04],
            [0.08, 0.035],
            [0, 0.035],
          ]),
        ),
        DETAIL,
        25,
      ),
      DETAIL,
    ),
  )
  const wax = staticSource('candle', 0.29, kit)
  // The source's asymmetric melted rim remains real geometry. Normalize only
  // its height so the existing burn-down/timekeeping code scales the whole wax.
  wax.updateMatrixWorld(true)
  const waxBounds = new Box3().setFromObject(wax)
  for (const child of wax.children as Mesh[]) child.geometry.scale(1, 1 / waxBounds.max.y, 1)
  // Source edges must receive the same normalization as their owning mesh.
  wax.traverse((object) => {
    if ('isLineSegments2' in object) object.scale.y = 1 / waxBounds.max.y
  })
  wax.position.y = 0.035
  root.add(wax)
  const top = new Group()
  root.add(top)
  const flameGroup = new Group()
  // The source already contains the wick; the flame starts at its tip.
  flameGroup.position.y = 0.002
  top.add(flameGroup)
  const flame = kit.hull(
    kit.solid(
      kit.lathe(
        [
          [0, 0],
          [0.028, 0.025],
          [0.04, 0.07],
          [0.028, 0.12],
          [0.01, 0.16],
          [0, 0.18],
        ],
        24,
      ),
      'flame',
      { glow: 'flame' },
    ),
    DETAIL * 0.8,
  )
  flameGroup.add(flame)
  const texture = glowTexture()
  const haloMaterial = new SpriteMaterial({ map: texture, color: new Color('#ffcf8a'), transparent: true, opacity: 0, depthWrite: false })
  const halo = new Sprite(haloMaterial)
  halo.scale.set(0.55, 0.55, 1)
  halo.position.y = 0.09
  halo.renderOrder = 6
  flameGroup.add(halo)
  const smoke = createRisers(
    kit,
    top,
    [
      { x: 0, z: 0.1, offset: 0, phase: 0.4 },
      { x: 0.03, z: 0.1, offset: 0.9, phase: 2.1 },
    ],
    { from: 0.06, rise: 0.5, sway: 0.03, period: 2.2, px: 1 },
  )

  let lit = false
  let height = CANDLE.full
  let smokeUntil = -10
  let flicker = 1
  let t = 0
  let lastBurnAt = 0
  const here = new Vector3()
  return {
    root,
    click() {
      if (lit) {
        lit = false
        smokeUntil = t + 2.4
      } else {
        if (height <= CANDLE.stub + 0.01) height = CANDLE.full
        lit = true
        lastBurnAt = Date.now()
      }
    },
    frame(env) {
      t = env.t
      if (lit) {
        const seconds = Math.max(0, (env.now - lastBurnAt) / 1000)
        height = Math.max(CANDLE.stub, height - ((CANDLE.full - CANDLE.stub) / CANDLE.burnSeconds) * seconds)
        lastBurnAt = env.now
      }
      if (lit && height <= CANDLE.stub) {
        lit = false
        smokeUntil = env.t + 2.4
      }
      wax.scale.y = height
      top.position.y = 0.035 + height
      flicker = env.still ? 1 : 1 + Math.sin(env.t * 13) * 0.07 + Math.sin(env.t * 23.7) * 0.05
      flameGroup.visible = lit
      flame.scale.set(1, flicker, 1)
      flameGroup.rotation.z = env.still ? 0 : Math.sin(env.t * 6.3) * 0.05
      haloMaterial.blending = kit.colors().dark ? AdditiveBlending : NormalBlending
      haloMaterial.opacity = lit ? 0.5 * flicker : 0
      if (env.t < smokeUntil) smoke.draw(env.t - smokeUntil + 2.4, 1, !env.still)
      else smoke.hide()
    },
    emitter() {
      if (!lit) return null
      flameGroup.getWorldPosition(here)
      here.y += 0.08
      return { position: here, strength: 0.75 * flicker }
    },
    needsTick: () => lit,
    dispose() {
      texture.dispose()
      haloMaterial.dispose()
    },
  }
}

export const smallPropBuilders = {
  coffee: buildCoffee,
  cola: buildCola,
  plant: buildPlant,
  timer: buildTimer,
  candle: buildCandle,
}
