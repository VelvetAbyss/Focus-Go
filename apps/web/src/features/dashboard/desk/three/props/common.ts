import type { Group, Vector3 } from 'three'
import type { Kit } from '../kit'

/** What a prop sees each frame. */
export type PropEnv = {
  t: number
  dt: number
  /** Reduced motion: settle at once, no idle motion. */
  still: boolean
  /** The pointer is over this prop. */
  hovered: boolean
  /** The lamp's light, 0..1, and its bulb in world space. */
  light: number
  bulb: Vector3
  /** Keys pressed anywhere in the app since the last frame (the typewriter types along). */
  keys: number
  /** Epoch ms, for the kitchen timer. */
  now: number
}

/**
 * One prop on the desk, built around its own x = 0 on the desk line; the scene
 * moves `root` to its place and scales it in and out.
 */
export type DeskProp = {
  root: Group
  click: () => void
  /** The wheel turned over the prop (the kitchen timer's dial), in CSS px of scroll. */
  wheel?: (delta: number) => void
  frame: (env: PropEnv) => void
  /** A light it gives off (the candle), for the paper around it. */
  emitter?: () => { position: Vector3; strength: number } | null
  /** Wall-clock changes still need occasional redraws with reduced motion. */
  needsTick?: () => boolean
  dispose?: () => void
}

export type PropOptions = {
  kit: Kit
  /** This kitchen timer's ring time, kept by the host so it survives a reload. */
  timer: { get: () => number | null; set: (endsAt: number | null) => void }
}
