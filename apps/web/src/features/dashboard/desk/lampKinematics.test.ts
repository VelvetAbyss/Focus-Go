import { describe, expect, it } from 'vitest'
import { deskFloor } from './deskLayout'
import {
  DEFAULT_POSE,
  LAMP_RIG,
  constrainPose,
  handleAngle,
  isPoseValid,
  lampFrame,
  nearestTurn,
  parsePose,
  pointerAngle,
  withHandleAngle,
  type LampBounds,
} from './lampKinematics'

const bounds: LampBounds = { left: -2.6, right: 2.8, top: 2.3 }
const floor = deskFloor('coffee')

describe('lampFrame', () => {
  it('puts the default shade over the book, pointing down at the task card', () => {
    const frame = lampFrame(DEFAULT_POSE)
    expect(frame.head[0]).toBeGreaterThan(0)
    expect(frame.head[0]).toBeLessThan(0.6)
    expect(frame.head[1]).toBeGreaterThan(1)
    // Nearly straight down, leaning a touch toward the book's middle.
    expect(Math.abs(frame.angle)).toBeLessThan(0.2)
    expect(frame.mouth[1]).toBeLessThan(frame.head[1])
  })

  it('keeps the arm lengths', () => {
    const { elbow, head } = lampFrame({ a1: 0.4, a2: 1.2, a3: 0 })
    const [sx, sy] = LAMP_RIG.shoulder
    expect(Math.hypot(elbow[0] - sx, elbow[1] - sy)).toBeCloseTo(LAMP_RIG.lowerArm)
    expect(Math.hypot(head[0] - elbow[0], head[1] - elbow[1])).toBeCloseTo(LAMP_RIG.upperArm)
  })
})

describe('isPoseValid', () => {
  it('accepts the default pose', () => {
    expect(isPoseValid(DEFAULT_POSE, bounds, floor)).toBe(true)
  })

  it('refuses a shade sunk into the book', () => {
    // Upper arm folded down so the head drops onto the desk.
    expect(isPoseValid({ ...DEFAULT_POSE, a2: 2.9 }, bounds, floor)).toBe(false)
  })

  it('refuses an elbow folded flat or a lamp out of the frame', () => {
    expect(isPoseValid({ ...DEFAULT_POSE, a2: 0.1 }, bounds, floor)).toBe(false)
    expect(isPoseValid(DEFAULT_POSE, { ...bounds, right: 2 }, floor)).toBe(false)
  })
})

describe('constrainPose', () => {
  it('passes a valid move straight through', () => {
    const next = { ...DEFAULT_POSE, a3: DEFAULT_POSE.a3 + 0.3 }
    expect(constrainPose(DEFAULT_POSE, next, bounds, floor)).toEqual(next)
  })

  it('stops a move at the limit instead of jumping', () => {
    const next = { ...DEFAULT_POSE, a2: 2.9 }
    const result = constrainPose(DEFAULT_POSE, next, bounds, floor)
    expect(isPoseValid(result, bounds, floor)).toBe(true)
    expect(result.a2).toBeGreaterThan(DEFAULT_POSE.a2)
    expect(result.a2).toBeLessThan(2.9)
  })

  it('never lets the shade point further up than its reach', () => {
    const result = constrainPose(DEFAULT_POSE, { ...DEFAULT_POSE, a3: 3 }, bounds, floor)
    expect(result.a1 + result.a2 + result.a3).toBeLessThanOrEqual(2.3 + 1e-9)
  })
})

describe('dragging a handle', () => {
  it('leaves a handle where it was when the pointer has not moved', () => {
    for (const handle of ['elbow', 'head', 'shade'] as const) {
      const frame = lampFrame(DEFAULT_POSE)
      const grab = handle === 'elbow' ? frame.elbow : handle === 'head' ? frame.head : frame.mouth
      const offset = handleAngle(handle, DEFAULT_POSE) - pointerAngle(handle, DEFAULT_POSE, grab[0], grab[1])
      const moved = withHandleAngle(handle, DEFAULT_POSE, pointerAngle(handle, DEFAULT_POSE, grab[0], grab[1]) + offset)
      expect(moved.a1).toBeCloseTo(DEFAULT_POSE.a1)
      expect(moved.a2).toBeCloseTo(DEFAULT_POSE.a2)
      expect(moved.a3).toBeCloseTo(DEFAULT_POSE.a3)
    }
  })

  it('turns only its own hinge; the joints past it ride along', () => {
    const turned = withHandleAngle('head', DEFAULT_POSE, handleAngle('head', DEFAULT_POSE) + 0.2)
    expect(turned.a1).toBe(DEFAULT_POSE.a1)
    expect(turned.a2).toBeCloseTo(DEFAULT_POSE.a2 + 0.2)
    expect(turned.a3).toBe(DEFAULT_POSE.a3)
    // The shade keeps its angle to the arm, so it swings with it.
    expect(lampFrame(turned).angle).toBeCloseTo(lampFrame(DEFAULT_POSE).angle + 0.2)
  })

  it('never spins a full turn across ±π', () => {
    expect(nearestTurn(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(Math.PI + 0.1)
    expect(nearestTurn(0.5, 0.4)).toBe(0.5)
  })
})

describe('parsePose', () => {
  it('reads a stored pose and rejects anything else', () => {
    expect(parsePose({ a1: 0.1, a2: 1, a3: -1 })).toEqual({ a1: 0.1, a2: 1, a3: -1 })
    expect(parsePose({ a1: 0.1, a2: '1', a3: -1 })).toBeNull()
    expect(parsePose({ a1: Number.NaN, a2: 1, a3: -1 })).toBeNull()
    expect(parsePose(null)).toBeNull()
  })
})
