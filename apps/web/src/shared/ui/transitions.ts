import type { Transition, Variants } from 'motion/react'
import { DURATION, EASE } from '../motion/tokens'

export const pageTransitionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const pageTransitionTiming: Transition = {
  duration: DURATION.base,
  ease: EASE.emphasized,
}

export const habitPageTransitionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const habitPageTransitionTiming: Transition = {
  duration: DURATION.base,
  ease: EASE.emphasized,
}

export const microInteractionSpring: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 30,
  mass: 0.62,
}
