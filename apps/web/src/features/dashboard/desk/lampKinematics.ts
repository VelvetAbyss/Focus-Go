// The desk lamp's arm, in the scene's side view: world units, y up, the desk
// surface at y = 0. Three hinges: the shoulder on the base (a1), the elbow
// between the two arms (a2, relative to the lower arm) and the head (a3,
// relative to the upper arm). Pure maths, shared by the scene and its tests.

export type LampPose = { a1: number; a2: number; a3: number }

/** What a drag turns: the elbow joint swings the lower arm, the head joint the
 *  upper arm, and the shade turns on the head. */
export type LampHandle = 'elbow' | 'head' | 'shade'

export type Point = [number, number]

export const LAMP_RIG = {
  /** World position of the shoulder hinge on the base. */
  shoulder: [1.99, 0.11] as Point,
  lowerArm: 1.45,
  upperArm: 1.65,
  /** From the head hinge to the middle of the shade's mouth. */
  mouth: 0.62,
  mouthRadius: 0.275,
  /** The shade leans this far toward the viewer (radians, about its own pitch axis). */
  tilt: -0.32,
} as const

/** Lower arm leaning back, upper arm reaching over the book, shade pointing down. */
export const DEFAULT_POSE: LampPose = { a1: -0.18, a2: 1.59, a3: -1.51 }

/** The elbow can't fold flat or open past straight. */
const ELBOW_MIN = 0.25
const ELBOW_MAX = 2.95
/** The shade can point anywhere from 40° above one horizontal to the other. */
const SHADE_REACH = 2.3
const SHADE_CLEARANCE = 0.025

/** The solid shade and its collision envelope use the same revolved section. */
export const LAMP_SHADE_PROFILE: [number, number][] = [
  [0.275, -LAMP_RIG.mouth], [0.265, -0.58], [0.22, -0.48],
  [0.145, -0.35], [0.1, -0.24], [0.09, -0.07], [0.07, -0.025],
  [0.045, 0], [0.03, 0], [0.055, -0.035], [0.074, -0.08],
  [0.084, -0.245], [0.128, -0.36], [0.203, -0.49],
  [0.248, -0.588], [0.257, -LAMP_RIG.mouth], [0.275, -LAMP_RIG.mouth],
]
// Include every outer vertex, including the near/far edges lowered by pitch.
// Pitch is fixed, so only the final 2D rotation is needed during a drag.
const SHADE_ENVELOPE: Point[] = LAMP_SHADE_PROFILE.slice(0, 8).flatMap(([r, y]) =>
  Array.from({ length: 48 }, (_, i): Point => {
    const angle = i / 48 * Math.PI * 2
    return [r * Math.sin(angle), y * Math.cos(LAMP_RIG.tilt) - r * Math.cos(angle) * Math.sin(LAMP_RIG.tilt)]
  }),
)

export type LampFrame = {
  elbow: Point
  head: Point
  mouth: Point
  /** World angle of the shade's axis: 0 points straight down, positive turns toward +x. */
  angle: number
}

export const lampFrame = (pose: LampPose): LampFrame => {
  const [sx, sy] = LAMP_RIG.shoulder
  const elbow: Point = [sx - Math.sin(pose.a1) * LAMP_RIG.lowerArm, sy + Math.cos(pose.a1) * LAMP_RIG.lowerArm]
  const upper = pose.a1 + pose.a2
  const head: Point = [elbow[0] - Math.sin(upper) * LAMP_RIG.upperArm, elbow[1] + Math.cos(upper) * LAMP_RIG.upperArm]
  const angle = upper + pose.a3
  const reach = LAMP_RIG.mouth * Math.cos(LAMP_RIG.tilt)
  const mouth: Point = [head[0] + Math.sin(angle) * reach, head[1] - Math.cos(angle) * reach]
  return { elbow, head, mouth, angle }
}

/** Where the lamp may go: the visible part of the scene (world units). */
export type LampBounds = { left: number; right: number; top: number }

/** Height of whatever stands on the desk at x (the book, the cup), so the
 *  shade can't sink into it. */
export type DeskFloor = (x: number) => number

export const isPoseValid = (pose: LampPose, bounds: LampBounds, floor: DeskFloor): boolean => {
  if (pose.a2 < ELBOW_MIN || pose.a2 > ELBOW_MAX) return false
  const { elbow, head, angle } = lampFrame(pose)
  const inside = ([x, y]: Point, margin = 0) => x >= bounds.left - margin && x <= bounds.right + margin && y <= bounds.top
  if (!inside(elbow) || elbow[1] < 0.35) return false
  if (!inside(head) || head[1] < floor(head[0]) + 0.32) return false
  const c = Math.cos(angle), s = Math.sin(angle)
  return SHADE_ENVELOPE.every(([x, y]) => {
    const p: Point = [head[0] + x * c - y * s, head[1] + x * s + y * c]
    return inside(p) && p[1] >= floor(p[0]) + SHADE_CLEARANCE
  })
}

const lerpPose = (a: LampPose, b: LampPose, t: number): LampPose => ({
  a1: a.a1 + (b.a1 - a.a1) * t,
  a2: a.a2 + (b.a2 - a.a2) * t,
  a3: a.a3 + (b.a3 - a.a3) * t,
})

/**
 * Moves from a valid pose toward `next` as far as the limits allow, so a drag
 * slides to a stop against the desk or the edge instead of jumping.
 */
export const constrainPose = (from: LampPose, next: LampPose, bounds: LampBounds, floor: DeskFloor): LampPose => {
  const target = { ...next }
  const shade = target.a1 + target.a2 + target.a3
  if (shade > SHADE_REACH) target.a3 = SHADE_REACH - target.a1 - target.a2
  if (shade < -SHADE_REACH) target.a3 = -SHADE_REACH - target.a1 - target.a2
  if (isPoseValid(target, bounds, floor)) return target
  if (!isPoseValid(from, bounds, floor)) return from
  let lo = 0
  let hi = 1
  for (let i = 0; i < 10; i += 1) {
    const mid = (lo + hi) / 2
    if (isPoseValid(lerpPose(from, target, mid), bounds, floor)) lo = mid
    else hi = mid
  }
  return lerpPose(from, target, lo)
}

/** Joint moves tried when something stands in the lamp's way, smallest first:
 *  the shoulder (a1) and the elbow (a2), the shade keeping its aim. */
const CLEARING_MOVES: [number, number][] = (() => {
  const moves: [number, number, number][] = []
  for (let i = -15; i <= 15; i += 1) {
    for (let j = -30; j <= 30; j += 1) moves.push([i * 0.04, j * 0.04, Math.abs(i) * 0.04 + Math.abs(j) * 0.028])
  }
  return moves.sort((a, b) => a[2] - b[2]).map(([d1, d2]) => [d1, d2])
})()

/**
 * The nearest pose that clears the desk and the edges, moving the two arms
 * and keeping the shade pointed the same way (so the light still falls where
 * it did); null when nothing nearby fits.
 */
export const clearPose = (pose: LampPose, bounds: LampBounds, floor: DeskFloor): LampPose | null => {
  const shade = pose.a1 + pose.a2 + pose.a3
  for (const [d1, d2] of CLEARING_MOVES) {
    const a1 = pose.a1 + d1
    const a2 = pose.a2 + d2
    const candidate = { a1, a2, a3: shade - a1 - a2 }
    if (isPoseValid(candidate, bounds, floor)) return candidate
  }
  return null
}

/**
 * The pose the lamp actually takes for the one the user left it in: that one
 * when it fits, else the nearest that clears whatever was put under it, else
 * the rest pose (or the nearest to it); null when the lamp fits nowhere here.
 */
export const fitPose = (rest: LampPose, bounds: LampBounds, floor: DeskFloor): LampPose | null => {
  if (isPoseValid(rest, bounds, floor)) return rest
  return clearPose(rest, bounds, floor) ?? (isPoseValid(DEFAULT_POSE, bounds, floor) ? DEFAULT_POSE : clearPose(DEFAULT_POSE, bounds, floor))
}

/** The world angle a handle currently sets. */
export const handleAngle = (handle: LampHandle, pose: LampPose): number => {
  if (handle === 'elbow') return pose.a1
  if (handle === 'head') return pose.a1 + pose.a2
  return pose.a1 + pose.a2 + pose.a3
}

/** The world angle that would put a handle under the pointer at (x, y). */
export const pointerAngle = (handle: LampHandle, pose: LampPose, x: number, y: number): number => {
  if (handle === 'elbow') {
    const [sx, sy] = LAMP_RIG.shoulder
    return Math.atan2(-(x - sx), y - sy)
  }
  const { elbow, head } = lampFrame(pose)
  if (handle === 'head') return Math.atan2(-(x - elbow[0]), y - elbow[1])
  return Math.atan2(x - head[0], -(y - head[1]))
}

/** Picks the turn of `angle` closest to `reference`, so a drag never spins a full circle. */
export const nearestTurn = (angle: number, reference: number): number => {
  let a = angle
  while (a - reference > Math.PI) a -= Math.PI * 2
  while (a - reference < -Math.PI) a += Math.PI * 2
  return a
}

/** The pose with one handle turned to a world angle; the joints past it ride along. */
export const withHandleAngle = (handle: LampHandle, pose: LampPose, angle: number): LampPose => {
  const turned = nearestTurn(angle, handleAngle(handle, pose))
  if (handle === 'elbow') return { ...pose, a1: turned }
  if (handle === 'head') return { ...pose, a2: turned - pose.a1 }
  return { ...pose, a3: turned - pose.a1 - pose.a2 }
}

/** A stored pose, or null when it isn't one. */
export const parsePose = (value: unknown): LampPose | null => {
  if (!value || typeof value !== 'object') return null
  const { a1, a2, a3 } = value as Record<string, unknown>
  const ok = [a1, a2, a3].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10)
  return ok ? { a1: a1 as number, a2: a2 as number, a3: a3 as number } : null
}
