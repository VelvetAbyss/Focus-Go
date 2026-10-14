import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  Points,
  SRGBColorSpace,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  BoxGeometry,
  AdditiveBlending,
  NormalBlending,
} from 'three'
import { DETAIL, LINE, circle, createRisers, step, type Spring } from '../kit'
import type { DeskProp, PropEnv, PropOptions } from './common'

// The small props (drinks, the plant, the kitchen timer, the candle, the cat).
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
  const cup = new Group()
  root.add(cup)
  cup.add(kit.hull(kit.edges(kit.solid(kit.lathe([[0, 0], [0.19, 0], [0.21, 0.02], [0.45, 0.04], [0.49, 0.075], [0.465, 0.075], [0.22, 0.05], [0, 0.05]])), DETAIL, 25), DETAIL))
  cup.add(kit.hull(kit.edges(kit.solid(kit.lathe([[0, 0.05], [0.17, 0.05], [0.19, 0.072], [0.27, 0.46], [0.285, 0.5], [0.262, 0.5], [0.25, 0.46], [0.17, 0.097], [0, 0.097]])), LINE, 35)))
  const handle = kit.hull(kit.solid(new TorusGeometry(0.11, 0.024, 10, 28, Math.PI * 1.15)))
  handle.rotation.z = -Math.PI * 0.575
  handle.position.set(0.285, 0.28, 0)
  cup.add(handle)
  const steam = createRisers(kit, cup, [
    { x: -0.1, z: 0.3, offset: 0, phase: 0 },
    { x: 0, z: 0.3, offset: 1.07, phase: 1.9 },
    { x: 0.1, z: 0.3, offset: 2.13, phase: 3.8 },
  ], { from: 0.56, rise: 0.68, sway: 0.034, period: 3.2 })
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
      cup.rotation.z = tilt.x * 0.12
      steam.draw(env.still ? 1.2 : env.t, Math.max(0.6, amplitude.x))
    },
  }
}

/** A glass of iced cola: ice bobbing, bubbles rising. A click fizzes it. */
export const buildCola = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  const glass = [...circle(0.26, 0.72), ...circle(0.21, 0), ...circle(0.19, 0.05), 0.21, 0, 0, 0.26, 0.72, 0, -0.21, 0, 0, -0.26, 0.72, 0]
  root.add(kit.segments(glass, LINE))
  const liquid = kit.edges(kit.solid(new CylinderGeometry(0.24, 0.2, 0.44, 40), 'cola'), DETAIL)
  liquid.position.y = 0.27
  root.add(liquid)
  const ice = [[-0.07, 0.04, 0.3], [0.08, -0.05, 1.1], [0.01, 0.08, 2.0]].map(([x, z, turn]) => {
    const cube = kit.edges(kit.solid(new BoxGeometry(0.13, 0.11, 0.13), 'ice'), DETAIL)
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
    depthTest: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 5
  points.raycast = () => {}
  root.add(points)
  const straw = kit.hull(kit.solid(new CylinderGeometry(0.02, 0.02, 0.9, 10)), LINE * 0.9)
  straw.position.set(0.05, 0.62, -0.05)
  straw.rotation.z = -0.2
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
        cube.position.y = 0.5 + Math.sin(env.t * 1.3 + i * 2) * 0.01 + jiggle.x * 0.01
        cube.rotation.y = turn + Math.sin(env.t * 0.5 + i) * 0.15 + jiggle.x * 0.1
      })
      bubbles.forEach((b, i) => {
        if (!env.still) {
          b.y += b.speed * fizz * env.dt
          if (b.y > 0.48) {
            b.y = 0.07
            b.x = (Math.random() - 0.5) * 0.28
          }
        }
        positions.set([b.x + Math.sin(env.t * 3 + i) * 0.008, b.y, 0.25], i * 3)
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
  return new ShapeGeometry(shape, 10)
}

/**
 * A potted plant whose leaves sway. With the lamp on it leans toward the
 * light; a click waters it, and the leaves give a little bounce.
 */
export const buildPlant = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  root.add(kit.hull(kit.edges(kit.solid(kit.lathe([[0, 0], [0.15, 0], [0.185, 0.27], [0.21, 0.27], [0.21, 0.32], [0.175, 0.32], [0.168, 0.29], [0, 0.29]])), LINE, 30)))
  const stems = [
    { x: -0.04, angle: 0.28, length: 0.42, leaves: [[0.2, -1], [0.36, 1]] },
    { x: 0.02, angle: -0.06, length: 0.6, leaves: [[0.22, 1], [0.42, -1]] },
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
    pivot.add(kit.segments(stem, DETAIL))
    const leaves = [...spec.leaves, [spec.length, 0]].map(([at, side], j) => {
      const leaf = new Group()
      leaf.position.set(Math.sin((at / spec.length) * Math.PI) * bend, at, 0.004)
      leaf.rotation.z = Math.PI / 2 - side * 0.95
      const length = side === 0 ? 0.16 : 0.2 - j * 0.02
      const blade = kit.solid(leafGeometry(length, length * 0.38), 'paper', { side: DoubleSide })
      leaf.add(kit.edges(blade, DETAIL, 30))
      leaf.add(kit.segments([0.01, 0, 0.002, length * 0.85, 0, 0.002], DETAIL * 0.8, 'ink3'))
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
  let t = 0
  const lean: Spring = { x: 0, v: 0 }
  const here = new Vector3()
  return {
    root,
    click() {
      wateredAt = t
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
      stems.forEach((stem, i) => {
        if (since > 0.55 && since < 0.6) stem.sway.v -= 2.5
        settle(stem.sway, 0, 60, 4, env)
        const breeze = env.still ? 0 : Math.sin(env.t * (0.9 + i * 0.2) + i * 1.7) * 0.035
        stem.pivot.rotation.z = stem.base + breeze + lean.x + stem.sway.x * 0.15
        for (const leaf of stem.leaves) leaf.leaf.rotation.z = leaf.base + (env.still ? 0 : Math.sin(env.t * 1.6 + leaf.phase) * 0.06)
      })
    },
  }
}

const TIMER = { radius: 0.26, squash: 0.82, centre: 0.215 }

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
  const shell = kit.hull(kit.solid(new SphereGeometry(TIMER.radius, 36, 22)))
  shell.scale.y = TIMER.squash
  shell.position.y = TIMER.centre
  body.add(shell)
  const dial = new Group()
  dial.position.y = TIMER.centre
  body.add(dial)
  const ticks: number[] = []
  const r = TIMER.radius + 0.004
  for (let m = 0; m < 60; m += 1) {
    const a = (m / 60) * Math.PI * 2
    const long = m % 5 === 0
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    ticks.push(x, 0.005, z, x, long ? 0.05 : 0.028, z)
  }
  dial.add(kit.segments(ticks, DETAIL, 'ink3'))
  const stalk = kit.hull(kit.solid(new CylinderGeometry(0.018, 0.022, 0.06, 10)), DETAIL)
  stalk.position.y = TIMER.radius * TIMER.squash + 0.02
  dial.add(stalk)
  for (let i = 0; i < 5; i += 1) {
    const leaf = kit.hull(kit.solid(new ConeGeometry(0.025, 0.12, 8)), DETAIL)
    const a = (i / 5) * Math.PI * 2
    leaf.position.set(Math.sin(a) * 0.05, TIMER.radius * TIMER.squash - 0.005, Math.cos(a) * 0.05)
    leaf.rotation.set(Math.cos(a) * 1.25, 0, -Math.sin(a) * 1.25)
    dial.add(leaf)
  }
  const mark = kit.segments([0, TIMER.centre - 0.07, TIMER.radius * 0.97, 0, TIMER.centre - 0.005, TIMER.radius + 0.008], LINE, 'ink3')
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
      else timer.set(now + 25 * 60000)
    },
    wheel(delta) {
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
              ringPositions.set([
                side * Math.cos(a0) * radius, TIMER.centre + Math.sin(a0) * radius, 0.2,
                side * Math.cos(a1) * radius, TIMER.centre + Math.sin(a1) * radius, 0.2,
              ], n)
              n += 6
            }
          }
        }
        kit.markDirty(rings)
      }
    },
  }
}

const CANDLE = { full: 0.55, stub: 0.12, burnSeconds: 40 * 60 }

/**
 * A candle on a dish. A click lights it or blows it out (a curl of smoke);
 * lit, it flickers, warms the paper around it and slowly burns down. A spent
 * candle is replaced on the next click.
 */
export const buildCandle = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  root.add(kit.hull(kit.edges(kit.solid(kit.lathe([[0, 0], [0.2, 0], [0.24, 0.03], [0.22, 0.04], [0.08, 0.035], [0, 0.035]])), DETAIL, 25), DETAIL))
  const waxGeometry = new CylinderGeometry(0.075, 0.08, 1, 24)
  waxGeometry.translate(0, 0.5, 0)
  const wax = kit.hull(kit.edges(kit.solid(waxGeometry), DETAIL, 30))
  wax.position.y = 0.035
  root.add(wax)
  const top = new Group()
  root.add(top)
  top.add(kit.segments([0, 0, 0.01, 0.005, 0.045, 0.01], DETAIL))
  const flameGroup = new Group()
  flameGroup.position.y = 0.035
  top.add(flameGroup)
  const flame = kit.hull(kit.solid(kit.lathe([[0, 0], [0.028, 0.025], [0.04, 0.07], [0.028, 0.12], [0.01, 0.16], [0, 0.18]], 24), 'flame', { glow: 'flame' }), DETAIL * 0.8)
  flameGroup.add(flame)
  const texture = glowTexture()
  const haloMaterial = new SpriteMaterial({ map: texture, color: new Color('#ffcf8a'), transparent: true, opacity: 0, depthWrite: false })
  const halo = new Sprite(haloMaterial)
  halo.scale.set(0.55, 0.55, 1)
  halo.position.y = 0.09
  halo.renderOrder = 6
  flameGroup.add(halo)
  const smoke = createRisers(kit, top, [
    { x: 0, z: 0.1, offset: 0, phase: 0.4 },
    { x: 0.03, z: 0.1, offset: 0.9, phase: 2.1 },
  ], { from: 0.06, rise: 0.5, sway: 0.03, period: 2.2, px: 1 })

  let lit = false
  let height = CANDLE.full
  let smokeUntil = -10
  let flicker = 1
  let t = 0
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
      }
    },
    frame(env) {
      t = env.t
      if (lit && !env.still) height = Math.max(CANDLE.stub, height - ((CANDLE.full - CANDLE.stub) / CANDLE.burnSeconds) * env.dt)
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
    dispose() {
      texture.dispose()
      haloMaterial.dispose()
    },
  }
}

const TAIL_POINTS = [
  [0.4, 0.2, 0],
  [0.54, 0.1, 0.12],
  [0.36, 0.05, 0.26],
  [0.05, 0.06, 0.28],
  [-0.12, 0.14, 0.27],
]

/**
 * A cat asleep in a loaf, breathing, a pencil "z" now and then. Pointing at it
 * twitches an ear; a click wakes it for a moment: it lifts its head, opens an
 * eye and flicks its tail, then settles back down.
 */
export const buildCat = ({ kit }: PropOptions): DeskProp => {
  const root = new Group()
  const cat = new Group()
  root.add(cat)
  const body = kit.hull(kit.solid(new SphereGeometry(1, 36, 22)))
  body.scale.set(0.42, 0.22, 0.24)
  body.position.set(0.05, 0.22, 0)
  cat.add(body)
  const head = new Group()
  head.position.set(-0.32, 0.3, 0.06)
  cat.add(head)
  const skull = kit.hull(kit.solid(new SphereGeometry(1, 30, 20)))
  skull.scale.set(0.16, 0.14, 0.15)
  head.add(skull)
  const ears = [[-0.06, 0.12, 0.02, 0.35], [0.05, 0.13, -0.05, -0.2]].map(([x, y, z, tilt]) => {
    const ear = kit.hull(kit.solid(new ConeGeometry(0.05, 0.1, 10)), DETAIL)
    ear.position.set(x, y, z)
    ear.rotation.z = tilt
    head.add(ear)
    return { ear, tilt, twitch: { x: 0, v: 0 } as Spring }
  })
  const closedEye: number[] = []
  for (let i = 0; i < 6; i += 1) {
    const a0 = Math.PI * (1.1 + (i / 6) * 0.8)
    const a1 = Math.PI * (1.1 + ((i + 1) / 6) * 0.8)
    closedEye.push(-0.07 + Math.cos(a0) * 0.035, 0.02 + Math.sin(a0) * 0.025 + 0.025, 0.14, -0.07 + Math.cos(a1) * 0.035, 0.02 + Math.sin(a1) * 0.025 + 0.025, 0.14)
  }
  const eyeShut = kit.segments(closedEye, DETAIL)
  head.add(eyeShut)
  const eyeOpenPositions: number[] = []
  for (let i = 0; i < 10; i += 1) {
    const a0 = (i / 10) * Math.PI * 2
    const a1 = ((i + 1) / 10) * Math.PI * 2
    eyeOpenPositions.push(-0.07 + Math.cos(a0) * 0.02, 0.03 + Math.sin(a0) * 0.02, 0.14, -0.07 + Math.cos(a1) * 0.02, 0.03 + Math.sin(a1) * 0.02, 0.14)
  }
  const eyeOpen = kit.segments(eyeOpenPositions, DETAIL)
  eyeOpen.visible = false
  head.add(eyeOpen)

  // The tail curls round the front; it is rebuilt only while it moves.
  const tailMaterial = kit.fill('paper')
  let tail: Mesh | null = null
  const buildTail = (lift: number) => {
    const points = TAIL_POINTS.map(([x, y, z], i) => new Vector3(x, y + (i === TAIL_POINTS.length - 1 ? lift : 0), z))
    const geometry = new TubeGeometry(new CatmullRomCurve3(points), 32, 0.042, 10, false)
    if (tail) {
      tail.geometry.dispose()
      tail.geometry = geometry
      for (const child of tail.children) (child as Mesh).geometry = geometry
    } else {
      tail = kit.hull(new Mesh(geometry, tailMaterial))
      cat.add(tail)
    }
  }
  buildTail(0)

  const zPositions = new Float32Array(3 * 3 * 6)
  const zs = kit.segments(zPositions, DETAIL, 'pencil')
  root.add(zs)
  let awakeUntil = -10
  let t = 0
  let lastLift = 0
  const lift: Spring = { x: 0, v: 0 }
  const tailFlick: Spring = { x: 0, v: 0 }
  let nextFlick = 4 + Math.random() * 5
  return {
    root,
    click() {
      awakeUntil = t + 3
      tailFlick.v += 3
    },
    frame(env) {
      t = env.t
      const awake = env.t < awakeUntil
      settle(lift, awake ? 1 : 0, 40, 9, env)
      head.rotation.z = -0.3 * lift.x
      head.position.y = 0.3 + 0.05 * lift.x
      eyeShut.visible = !awake
      eyeOpen.visible = awake
      body.scale.y = 0.22 * (1 + (env.still ? 0 : Math.sin(env.t * 1.7) * 0.035))
      for (const ear of ears) {
        if (env.hovered && Math.abs(ear.twitch.v) < 0.1 && Math.random() < 0.02) ear.twitch.v += 6
        settle(ear.twitch, 0, 300, 12, env)
        ear.ear.rotation.z = ear.tilt + ear.twitch.x * 0.15
      }
      if (!env.still && env.t > nextFlick) {
        tailFlick.v += 2
        nextFlick = env.t + 4 + Math.random() * 6
      }
      settle(tailFlick, 0, 90, 6, env)
      const tailLift = tailFlick.x * 0.08
      if (Math.abs(tailLift - lastLift) > 0.002) {
        buildTail(tailLift)
        lastLift = tailLift
      }
      // Sleeping: a pencil "z", rising and growing, one after another.
      zPositions.fill(0)
      if (!awake && !env.still) {
        for (let i = 0; i < 3; i += 1) {
          const cycle = ((env.t + i * 1.1) / 3.3) % 1
          if (cycle > 0.85) continue
          const s = 0.03 + cycle * 0.04
          const x = -0.3 + cycle * 0.18
          const y = 0.5 + cycle * 0.45
          zPositions.set([x, y + s, 0.1, x + s, y + s, 0.1, x + s, y + s, 0.1, x, y, 0.1, x, y, 0.1, x + s, y, 0.1], i * 18)
        }
      }
      kit.markDirty(zs)
    },
  }
}

export const smallPropBuilders = {
  coffee: buildCoffee,
  cola: buildCola,
  plant: buildPlant,
  timer: buildTimer,
  candle: buildCandle,
  cat: buildCat,
}

