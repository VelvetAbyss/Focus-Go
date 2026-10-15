// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { prepareSourceModels } from '../sourceModels'
import { Box3, Mesh, Vector3 } from 'three'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROP_FOOTPRINT } from '../../deskLayout'
import type { DeskColors, DeskPropId } from '../../deskTypes'
import { createKit } from '../kit'
import { buildLampRig } from '../lampRig'
import { DEFAULT_POSE, LAMP_RIG, lampFrame } from '../../lampKinematics'
import { centerPropBuilders } from './centerProps'
import { smallPropBuilders } from './smallProps'
import type { DeskProp, PropEnv } from './common'

const colors: DeskColors = {
  paper: [1, 1, 1],
  ink: [0.23, 0.22, 0.2],
  ink3: [0.47, 0.45, 0.42],
  ink4: [0.66, 0.64, 0.6],
  pencil: [0.58, 0.56, 0.52],
  pen: [0.1, 0.31, 0.29],
  dark: false,
}
const builders = { ...centerPropBuilders, ...smallPropBuilders }
const now = 1_800_000_000_000
const env = (time = 0, still = false): PropEnv => ({
  dt: 1 / 60,
  t: time,
  now: now + time * 1000,
  still,
  hovered: false,
  light: 1,
  bulb: new Vector3(-2, 2, 0),
  keys: 0,
})
const physicalBounds = (prop: DeskProp) => {
  const bounds = new Box3()
  const vertex = new Vector3()
  prop.root.updateMatrixWorld(true)
  prop.root.traverseVisible((o) => {
    if (!(o instanceof Mesh) || 'isLineSegments2' in o || o.userData.outline) return
    const positions = o.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(o.getVertexPosition(i, vertex).applyMatrix4(o.matrixWorld))
  })
  return bounds
}
const make = (kind: DeskPropId) => {
  let endsAt: number | null = null
  const kit = createKit({ width: 800, height: 300, unit: 60, colors })
  const prop = builders[kind]({
    kit,
    timer: {
      get: () => endsAt,
      set: (v) => {
        endsAt = v
      },
    },
  })
  return {
    prop,
    kit,
    get endsAt() {
      return endsAt
    },
    set endsAt(v) {
      endsAt = v
    },
  }
}
// Load the shipped GLB geometry, stripping only GPU images for
// jsdom. Browser tests exercise the real textures and shader compilation.
beforeAll(async () => {
  const loader = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async (url) => {
    const name = String(url).split('/').pop()!.split('?')[0]
    const file = await readFile(`${process.cwd()}/src/features/dashboard/desk/assets/${name}`)
    const jsonLength = file.readUInt32LE(12)
    const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString())
    json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }))
    delete json.images
    delete json.textures
    const encoded = Buffer.from(JSON.stringify(json))
    const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32)
    encoded.copy(padded)
    const binary = file.subarray(20 + jsonLength)
    const rebuilt = Buffer.alloc(20 + padded.length + binary.length)
    rebuilt.writeUInt32LE(0x46546c67, 0)
    rebuilt.writeUInt32LE(2, 4)
    rebuilt.writeUInt32LE(rebuilt.length, 8)
    rebuilt.writeUInt32LE(padded.length, 12)
    rebuilt.writeUInt32LE(0x4e4f534a, 16)
    padded.copy(rebuilt, 20)
    binary.copy(rebuilt, 20 + padded.length)
    const data = new ArrayBuffer(rebuilt.length)
    new Uint8Array(data).set(rebuilt)
    return new GLTFLoader().parseAsync(data, '')
  })
  await prepareSourceModels()
  loader.mockRestore()
})
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
  } as unknown as CanvasRenderingContext2D)
})
afterEach(() => vi.restoreAllMocks())

describe('physical model envelopes', () => {
  for (const kind of Object.keys(builders) as DeskPropId[])
    it(`${kind}: grounded, finite, and inside its placement envelope throughout actions`, () => {
      const { prop, kit } = make(kind),
        limit = PROP_FOOTPRINT[kind]
      for (let i = 0; i < 240; i++) {
        if (i === 20 || i === 90 || i === 150) prop.click()
        const frame = env(i / 60)
        frame.hovered = i > 30 && i < 80
        frame.keys = kind === 'typewriter' ? 2 : 0
        prop.frame(frame)
        const b = physicalBounds(prop)
        expect(b.min.y, `${kind} bottom at ${i}`).toBeGreaterThanOrEqual(-0.012)
        expect(Math.max(-b.min.x, b.max.x), `${kind} width at ${i}`).toBeLessThanOrEqual(limit.half + 0.01)
        expect(b.max.y, `${kind} height at ${i}`).toBeLessThanOrEqual(limit.top + 0.01)
        expect([...b.min.toArray(), ...b.max.toArray()].every(Number.isFinite)).toBe(true)
      }
      prop.dispose?.()
      kit.release(prop.root)
    })
})

it('keeps the visible shade mouth on the analytical light origin through all three joints', () => {
  const kit = createKit({ width: 800, height: 300, unit: 60, colors })
  const lamp = buildLampRig(kit)
  for (const pose of [DEFAULT_POSE, { a1: 0.2, a2: 1.1, a3: -1.2 }, { a1: -0.5, a2: 2.1, a3: -0.9 }]) {
    lamp.shoulder.rotation.z = pose.a1
    lamp.elbow.rotation.z = pose.a2
    lamp.head.rotation.set(LAMP_RIG.tilt, 0, pose.a3)
    lamp.root.updateMatrixWorld(true)
    const expected = lampFrame(pose)
    const mouth = lamp.head.localToWorld(new Vector3(0, -LAMP_RIG.mouth, 0))
    const axis = lamp.head.localToWorld(new Vector3(0, -LAMP_RIG.mouth - 1, 0)).sub(mouth)
    expect(mouth.x).toBeCloseTo(expected.mouth[0], 6)
    expect(mouth.y).toBeCloseTo(expected.mouth[1], 6)
    expect(Math.atan2(axis.x, -axis.y)).toBeCloseTo(expected.angle, 6)
  }
  lamp.dispose()
  kit.release(lamp.root)
})

it('turns a full paper surface through the spine, then hides the completed leaf', () => {
  const { prop } = make('book')
  prop.frame(env())
  prop.click()
  for (let i = 0; i < 34; i++) prop.frame(env(i / 60))
  const page = prop.root.getObjectByName('turning-page') as Mesh
  expect(page.parent?.visible).toBe(true)
  expect(page.geometry.index!.count).toBeGreaterThan(100)
  const box = physicalBounds(prop)
  expect(box.max.y).toBeGreaterThan(0.8)
  for (let i = 34; i < 90; i++) prop.frame(env(i / 60))
  expect(page.parent?.visible).toBe(false)
})

it('never lets a rapidly toggled laptop lid penetrate the keyboard deck', () => {
  const { prop } = make('laptop')
  for (let i = 0; i < 200; i++) {
    if (i % 7 === 0) prop.click()
    prop.frame(env(i / 60))
    const hinge = prop.root.getObjectByName('laptop-hinge')!
    expect(hinge.rotation.x).toBeLessThanOrEqual(0)
    expect(hinge.rotation.x).toBeGreaterThanOrEqual(-1.95)
  }
})

it('keeps the record stylus on the recorded area with the arm engaged', () => {
  const { prop } = make('record')
  prop.click()
  prop.frame(env(0, true))
  prop.root.updateMatrixWorld(true)
  const arm = prop.root.getObjectByName('record-tonearm')!
  const stylus = arm.localToWorld(new Vector3(0, -0.705, -0.06))
  expect(Math.hypot(stylus.x + 0.12, stylus.y - 0.55)).toBeGreaterThan(0.125)
  expect(Math.hypot(stylus.x + 0.12, stylus.y - 0.55)).toBeLessThan(0.425)
  expect(stylus.z).toBeCloseTo(0.02)
})

it('keeps each kitchen timer independent and expires it with reduced motion', () => {
  const a = make('timer'),
    b = make('timer')
  a.prop.click()
  b.prop.click()
  a.prop.click()
  expect(a.endsAt).toBeNull()
  expect(b.endsAt).toBe(now + 25 * 60000)
  b.prop.frame({ ...env(1501, true), now: now + 1501_000 })
  expect(b.endsAt).toBeNull()
})

it('types an entire click in one reduced-motion frame', () => {
  const { prop } = make('typewriter')
  prop.frame(env(0, true))
  const before = physicalBounds(prop)
  prop.click()
  prop.frame(env(0, true))
  const after = physicalBounds(prop)
  expect(after.max.x).toBeLessThan(before.max.x)
})

it('keeps imported model geometry independent when another instance is removed', () => {
  const a = make('laptop'), b = make('laptop')
  const meshes = (prop: DeskProp) => {
    const result: Mesh[] = []
    prop.root.traverse((object) => {
      if (object instanceof Mesh && !object.userData.outline && !('isLineSegments2' in object)) result.push(object)
    })
    return result
  }
  const first = meshes(a.prop), second = meshes(b.prop)
  expect(first.length).toBeGreaterThan(0)
  expect(second).toHaveLength(first.length)
  for (let i = 0; i < first.length; i++) expect(first[i].geometry).not.toBe(second[i].geometry)
  const dispose = vi.spyOn(second[0].geometry, 'dispose')
  a.prop.dispose?.()
  a.kit.release(a.prop.root)
  expect(dispose).not.toHaveBeenCalled()
  expect(() => b.prop.frame(env(5))).not.toThrow()
})

it('burns a candle according to elapsed wall time, including reduced motion', () => {
  const { prop } = make('candle')
  prop.frame(env())
  prop.click()
  prop.frame(env(0, true))
  expect(prop.emitter?.()).not.toBeNull()
  const start = prop.emitter!()!.position.y
  prop.frame(env(1200, true))
  expect(prop.emitter!()!.position.y).toBeLessThan(start - 0.15)
  prop.frame(env(2401, true))
  expect(prop.emitter?.()).toBeNull()
})
