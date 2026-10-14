// Type-only contract between the dashboard header and the lazily loaded desk
// scene, so the header never pulls three.js into its own chunk.
import type { Rgb } from '../../../shared/three/surface'
import type { LampPose } from './lampKinematics'

export type DeskItem = 'book' | 'laptop'
export type DeskDrink = 'coffee' | 'cola'

/** Display-space colours read from the design tokens. */
export type DeskColors = {
  paper: Rgb
  ink: Rgb
  ink3: Rgb
  ink4: Rgb
  pencil: Rgb
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
}

export type DeskParams = {
  colors: DeskColors
  /** CSS px per world unit. */
  unit: number
  lampOn: boolean
  item: DeskItem
  drink: DeskDrink
  /** The pose to rest in; a new object (after a reset) eases the lamp there. */
  pose: LampPose
  /** Bumped to turn a page of the book, or open or close the laptop. */
  turn: number
  onToggleLamp: () => void
  onSwapDrink: () => void
  /** The user let go of the lamp in a new pose. */
  onPose: (pose: LampPose) => void
  /** Every change to the light; null once it is fully off. */
  onBeam: (beam: LampBeam | null) => void
}
