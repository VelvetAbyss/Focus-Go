// Where things stand on the masthead desk (world units, the desk at y = 0,
// x = 0 under the middle of the masthead) and how big the scene may be drawn.
// Shared by the host, which sizes the canvas and places new props, and the
// scene, which builds them; no three.js here.
import type { DeskFloor } from './lampKinematics'
import type { DeskPropId } from './deskTypes'

/** Where the lamp's base stood when it couldn't move; its rig is built around it. */
export const LAMP_X = 1.95
export const LAMP_BASE = { half: 0.45, top: 0.16 }

/** Half its width and its height, for the lamp's limits and for finding room. */
export const PROP_FOOTPRINT: Record<DeskPropId, { half: number; top: number }> = {
  book: { half: 1.0, top: 1.06 },
  laptop: { half: 1.01, top: 1.12 },
  typewriter: { half: 0.98, top: 0.84 },
  record: { half: 0.72, top: 1.04 },
  coffee: { half: 0.5, top: 0.62 },
  cola: { half: 0.3, top: 0.89 },
  plant: { half: 0.43, top: 1.03 },
  timer: { half: 0.33, top: 0.50 },
  candle: { half: 0.25, top: 0.94 },
  window: { half: 1.8, top: 0 },
  frame: { half: 0.7, top: 0 },
}

export const DESK_LAYOUT = {
  /** Room above the desk: the lamp's elbow stands about 1.6 high. */
  height: 2.45,
  /** The desk shows only when it is at least this wide (the lamp and a prop or two). */
  minWidth: 6.5,
} as const

/** CSS px between the canvas bottom and the desk line, so outlines resting
 *  on the toolbar rule aren't clipped. */
export const DESK_LINE_INSET = 3.5

/** CSS px per world unit: at most this, and the desk hides below the minimum. */
export const DESK_UNIT_MAX = 60
export const DESK_UNIT_MIN = 42

/** The stretch of desk a prop may stand on (world x). */
export type DeskSpan = { left: number; right: number }

/** Where a prop stored at x stands on a desk this wide: kept on it, the stored x untouched. */
export const onDesk = (x: number, half: number, span: DeskSpan) => {
  const lo = span.left + half
  const hi = span.right - half
  return lo > hi ? (span.left + span.right) / 2 : Math.min(hi, Math.max(lo, x))
}

type Standing = { kind: DeskPropId; x: number }

/** The height of whatever stands on the desk at x, so the lamp's shade can't sink into it. */
export const deskFloor = (items: Standing[], lampX: number): DeskFloor => {
  const standing = items.filter(item => item.kind !== 'window' && item.kind !== 'frame').map((item) => ({ x: item.x, ...PROP_FOOTPRINT[item.kind] }))
  standing.push({ x: lampX, ...LAMP_BASE })
  return (x) => {
    let top = 0.04
    for (const s of standing) if (Math.abs(x - s.x) < s.half && s.top > top) top = s.top
    return top
  }
}

/** Room kept around a new prop, and the step its spot is searched in. */
const ROOM = 0.12
const SEARCH_STEP = 0.05

/**
 * Where a new prop goes: the free spot nearest the middle of the masthead
 * (over the task card), keeping a little room from everything else on the
 * desk; when the desk is full, the spot that overlaps least.
 */
export const findFreeSpot = (kind: DeskPropId, items: Standing[], lampX: number, span: DeskSpan): number => {
  const half = PROP_FOOTPRINT[kind].half
  const taken = items.map((item) => {
    const h = PROP_FOOTPRINT[item.kind].half
    const x = onDesk(item.x, h, span)
    return [x - h, x + h] as const
  })
  taken.push([lampX - LAMP_BASE.half, lampX + LAMP_BASE.half])
  const lo = span.left + half
  const hi = span.right - half
  if (lo > hi) return (span.left + span.right) / 2
  let best = Math.min(hi, Math.max(lo, 0))
  let bestRoom = -Infinity
  for (let x = lo; x <= hi + 1e-9; x += SEARCH_STEP) {
    let room = Infinity
    for (const [a, b] of taken) room = Math.min(room, Math.max(a - (x + half), x - half - b))
    // Any spot with enough room beats a cramped one; among those, the nearest the middle.
    if (room >= ROOM) {
      if (bestRoom < ROOM || Math.abs(x) < Math.abs(best)) {
        best = x
        bestRoom = room
      }
    } else if (bestRoom < ROOM && room > bestRoom) {
      best = x
      bestRoom = room
    }
  }
  return Math.round(best * 100) / 100 || 0
}
