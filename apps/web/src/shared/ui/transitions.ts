import type { Transition, Variants } from 'motion/react'

export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.995 },
}

export const pageTransitionTiming: Transition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
}

export const microInteractionSpring: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 30,
  mass: 0.62,
}
