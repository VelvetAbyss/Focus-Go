import type { Transition } from 'motion/react'

type Bezier = [number, number, number, number]

/**
 * JS mirror of the motion vocabulary in shared/theme/tokens.css. motion/react
 * components use these so JS-driven and CSS-driven motion feel identical.
 */
export const EASE = {
  /** State changes that stay in place (colour, size, toggles). */
  standard: [0.2, 0, 0, 1] as Bezier,
  /** Things arriving: overlays, cards, list items. */
  emphasized: [0.22, 1, 0.36, 1] as Bezier,
  /** Long, soft landings (progress rings, hero reveals). */
  outExpo: [0.16, 1, 0.3, 1] as Bezier,
  /** Things leaving. */
  accelerate: [0.4, 0, 1, 1] as Bezier,
  inOut: [0.65, 0, 0.35, 1] as Bezier,
  /** Drawers and sheets. */
  sheet: [0.32, 0.72, 0, 1] as Bezier,
  /** Small pops with a hint of overshoot (badges, checkmarks). */
  bounce: [0.34, 1.56, 0.64, 1] as Bezier,
}

/** Seconds, matching --motion-duration-* in tokens.css. */
export const DURATION = {
  instant: 0.09,
  fast: 0.14,
  base: 0.2,
  medium: 0.28,
  slow: 0.36,
  slower: 0.56,
}

export const SPRING = {
  /** Indicators, toggles, anything that tracks the pointer or selection. */
  snappy: { type: 'spring', stiffness: 520, damping: 40, mass: 0.7 } satisfies Transition,
  /** Panels and cards settling into place. */
  gentle: { type: 'spring', stiffness: 280, damping: 30, mass: 0.9 } satisfies Transition,
  /** Small celebratory pops. */
  bouncy: { type: 'spring', stiffness: 460, damping: 22, mass: 0.6 } satisfies Transition,
  /** List reflow when items are added, removed or reordered. */
  layout: { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 } satisfies Transition,
}

/** Stagger between siblings in an entering list (seconds). */
export const STAGGER_FAST = 0.04
export const STAGGER_SLOW = 0.06

/** @deprecated use EASE.outExpo */
export const EASE_OUT = EASE.outExpo
/** @deprecated use EASE.bounce */
export const EASE_OVERSHOOT = [0.2, 1.1, 0.2, 1] as Bezier

/** Default transition for motion components that don't specify one. */
export const DEFAULT_TRANSITION: Transition = {
  duration: DURATION.medium,
  ease: EASE.emphasized,
  layout: SPRING.layout,
}
