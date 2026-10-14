import { describe, expect, it } from 'vitest'
import { LAMP_X, deskFloor } from './deskLayout'
import {
  DEFAULT_POSE,
  LAMP_RIG,
  clearPose,
  constrainPose,
  fitPose,
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
const floor = deskFloor([{ kind: 'book', x: 0 }, { kind: 'coffee', x: -1.8 }], LAMP_X)

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

describe('deskFloor', () => {
  it('follows whatever stands where', () => {
    const book = deskFloor([{ kind: 'book', x: 0 }, { kind: 'plant', x: -3.3 }], LAMP_X)
    const record = deskFloor([{ kind: 'record', x: 0 }, { kind: 'plant', x: -3.3 }], LAMP_X)
    expect(book(0)).toBeLessThan(record(0))
    expect(book(-3.3)).toBe(record(-3.3))
    // The lamp's own base counts too.
    expect(book(LAMP_X)).toBeGreaterThan(book(-2.5))
  })

  it('makes a lamp lowered over the book too low for a taller prop', () => {
    const low = { ...DEFAULT_POSE, a2: 2.0 }
    const book = deskFloor([{ kind: 'book', x: 0 }], LAMP_X)
    const record = deskFloor([{ kind: 'record', x: 0 }], LAMP_X)
    expect(isPoseValid(low, bounds, book)).toBe(true)
    expect(isPoseValid(low, bounds, record)).toBe(false)
    // At rest over the book there's room for any prop with a little lift.
    expect(isPoseValid(DEFAULT_POSE, bounds, book)).toBe(true)
    expect(fitPose(DEFAULT_POSE, bounds, record)).not.toBeNull()
  })
})

describe('making room under the lamp', () => {
  const low = { ...DEFAULT_POSE, a2: 2.05 }
  const tall = deskFloor([{ kind: 'plant', x: 0.5 }], LAMP_X)

  it('lifts the head clear of a prop put under it, still aiming the same way', () => {
    expect(isPoseValid(low, bounds, tall)).toBe(false)
    const cleared = clearPose(low, bounds, tall)
    expect(cleared).not.toBeNull()
    expect(isPoseValid(cleared!, bounds, tall)).toBe(true)
    expect(lampFrame(cleared!).angle).toBeCloseTo(lampFrame(low).angle)
    expect(lampFrame(cleared!).mouth[1]).toBeGreaterThan(lampFrame(low).mouth[1])
  })

  it('keeps the pose the user left it in when it fits, and goes back to it once the prop is gone', () => {
    const empty = deskFloor([], LAMP_X)
    expect(fitPose(low, bounds, empty)).toBe(low)
    expect(fitPose(low, bounds, tall)).not.toEqual(low)
  })

  it('gives up only when the lamp fits nowhere', () => {
    expect(fitPose(DEFAULT_POSE, { left: 1.5, right: 2.3, top: 2.3 }, floor)).toBeNull()
  })
})
