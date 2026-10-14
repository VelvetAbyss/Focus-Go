// Type-only contract between the dashboard header and the lazily loaded desk
// scene, so the header never pulls three.js into its own chunk.
import type { Rgb } from '../../../shared/three/surface'
import type { LampPose } from './lampKinematics'

export type DeskPropId = 'book' | 'laptop' | 'typewriter' | 'record' | 'coffee' | 'cola' | 'plant' | 'timer' | 'candle' | 'cat'

export const DESK_PROPS: DeskPropId[] = ['book', 'laptop', 'typewriter', 'record', 'coffee', 'cola', 'plant', 'timer', 'candle', 'cat']

/**
 * One thing on the desk. `x` is in world units from the middle of the
 * masthead (over the middle column of cards), so it keeps its place against
 * the cards as the window resizes. The kitchen timer keeps its ring time
 * (epoch ms) on itself.
 */
export type DeskItem = { id: string; kind: DeskPropId; x: number; endsAt?: number }

/** Display-space colours read from the design tokens. */
export type DeskColors = {
  paper: Rgb
  ink: Rgb
  ink3: Rgb
  ink4: Rgb
  pencil: Rgb
  pen: Rgb
  dark: boolean
}

/**
 * The lamp's light as the page overlay draws it, in the canvas's own CSS px
 * (layout px, before any shell zoom). `light` is the bulb (it flickers on),
 * `dim` how far the rest of the page has gone down; both run 0..1.
 */
export type LampBeam = {
  mouth: [number, number]
  /** Unit vector along the shade's axis, on screen. */
  dir: [number, number]
  /** Half the mouth's width. */
  radius: number
  bulb: [number, number]
  light: number
  dim: number
  /** Other lights on the desk (lit candles): spots the dimming leaves bright. */
  glows: { at: [number, number]; radius: number; strength: number }[]
}

export type DeskParams = {
  colors: DeskColors
  /** CSS px per world unit. */
  unit: number
  /** Where the masthead's middle (world x = 0) falls on the canvas, in CSS px from its left edge. */
  origin: number
  lampOn: boolean
  /** Where the lamp's base stands (world x). */
  lampX: number
  /** The pose to rest in; a new object (after a reset) eases the lamp there. */
  pose: LampPose
  /** Back to front: a prop drawn later stands in front. */
  items: DeskItem[]
  /** The sticky note on the lamp: null when it's off; its text (the task in progress) may be empty. */
  note: { text: string } | null
  /** A prop to point out (its chip in the picker is pointed at): it hops. */
  highlight: string | null
  onToggleLamp: () => void
  /** The user let go of the lamp in a new pose. */
  onPose: (pose: LampPose) => void
  /** The user let go of the lamp somewhere else on the desk. */
  onLampMove: (x: number) => void
  /** The user put a prop down at x; it comes to the front. */
  onItemMove: (id: string, x: number) => void
  /** The user lifted a prop off the desk. */
  onItemRemove: (id: string) => void
  onItemTimer: (id: string, endsAt: number | null) => void
  /** Every change to the light; null once it is fully off. */
  onBeam: (beam: LampBeam | null) => void
}
