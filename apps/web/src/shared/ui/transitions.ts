import type { Transition, Variants } from 'motion/react'

export const pageTransitionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const pageTransitionTiming: Transition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
}

export const habitPageTransitionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const habitPageTransitionTiming: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
}

export const microInteractionSpring: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 30,
  mass: 0.62,
}
