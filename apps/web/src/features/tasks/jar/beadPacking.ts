/**
 * Where the beads sit in a completion jar. Beads are dropped one at a time, in
 * completion order, from a seeded spot above the pile, then fall and roll off
 * whatever they touch until they rest on the floor, the wall or three other
 * beads. The same week always packs the same way, and adding a bead never
 * moves the ones below it, so each jar looks the same every time it is drawn.
 *
 * Units: the jar's inner radius is 1; y is up from the inner floor. Pure — no
 * three.js here, so it is cheap to test and to import.
 */

export type Vec3 = [number, number, number]

export type SettledBead = {
  position: Vec3
  /** Positions along the way down, for the drop animation. */
  path: Vec3[]
  /** Index into `path` where the bead first touched something. */
  contactIndex: number
}

export const BEAD_RADIUS = 0.29

const hashString = (value: string) => {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const rng = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Height of the top of the pile (0 when empty). */
export const pileTop = (positions: readonly Vec3[], radius: number) =>
  positions.reduce((top, p) => Math.max(top, p[1] + radius), 0)

/**
 * Drops one bead onto `placed` and returns where it rests. `seedKey` fixes the
 * spot it falls from.
 */
export const settleBead = (placed: readonly Vec3[], seedKey: string, radius = BEAD_RADIUS): SettledBead => {
  const random = rng(hashString(seedKey))
  const reach = 1 - radius
  const angle = random() * Math.PI * 2
  const distance = Math.sqrt(random()) * reach * 0.9
  let x = Math.cos(angle) * distance
  let z = Math.sin(angle) * distance
  let y = pileTop(placed, radius) + radius * 2.5
  const diameter = radius * 2
  const step = radius * 0.06
  const path: Vec3[] = [[x, y, z]]
  let contactIndex = -1
  let still = 0

  for (let i = 0; i < 1200 && still < 4; i++) {
    const px = x
    const py = y
    const pz = z
    y -= step
    let touched = false
    // A few passes so a bead wedged between several neighbours settles cleanly.
    // The glass and the floor go last: they are hard limits, beads may give a hair.
    for (let pass = 0; pass < 4; pass++) {
      for (const [bx, by, bz] of placed) {
        const dx = x - bx
        const dy = y - by
        const dz = z - bz
        const gap = dx * dx + dy * dy + dz * dz
        if (gap >= diameter * diameter) continue
        const d = Math.sqrt(gap) || 1e-6
        const push = (diameter - d) / d
        x += dx * push
        y += dy * push
        z += dz * push
        touched = true
      }
      if (y < radius) {
        y = radius
        touched = true
      }
      const fromAxis = Math.hypot(x, z)
      if (fromAxis > reach) {
        x *= reach / fromAxis
        z *= reach / fromAxis
        touched = true
      }
    }
    if (touched && contactIndex < 0) contactIndex = path.length
    path.push([x, y, z])
    const moved = Math.hypot(x - px, y - py, z - pz)
    still = moved < step * 0.02 ? still + 1 : 0
  }

  return { position: [x, y, z], path, contactIndex: contactIndex < 0 ? path.length - 1 : contactIndex }
}

/**
 * Packs a whole jar: one bead per id, in order. `weekKey` + id seed each drop,
 * so the result depends only on which tasks were done and in what order.
 */
export const packJar = (weekKey: string, ids: readonly string[], radius = BEAD_RADIUS): SettledBead[] => {
  const placed: Vec3[] = []
  const beads: SettledBead[] = []
  for (const id of ids) {
    const bead = settleBead(placed, `${weekKey}:${id}`, radius)
    placed.push(bead.position)
    beads.push(bead)
  }
  return beads
}

// Poured spheres in a narrow jar settle at about this fraction of the volume.
const PACKING_DENSITY = 0.47

/**
 * Bead radius for a jar whose pile may be at most `maxHeight` tall: the normal
 * size, shrunk just enough that a very heavy week still fits.
 */
export const beadRadiusFor = (count: number, maxHeight: number, radius = BEAD_RADIUS) => {
  const needed = (count * (4 / 3) * radius ** 3) / PACKING_DENSITY + radius
  if (needed <= maxHeight) return radius
  return radius * Math.cbrt(Math.max(0.05, maxHeight - radius) / (needed - radius))
}

/**
 * Packs a jar whose pile must stay under `maxHeight`: estimate the bead size,
 * pack, and if the pile still overshoots, shrink once more by the measured
 * ratio. Returns the beads and the radius they were packed at.
 */
export const packJarWithin = (weekKey: string, ids: readonly string[], maxHeight: number) => {
  let radius = beadRadiusFor(ids.length, maxHeight)
  let beads = packJar(weekKey, ids, radius)
  const top = pileTop(beads.map((bead) => bead.position), radius)
  if (top > maxHeight && ids.length > 0) {
    radius *= Math.cbrt(maxHeight / top)
    beads = packJar(weekKey, ids, radius)
  }
  return { beads, radius }
}
