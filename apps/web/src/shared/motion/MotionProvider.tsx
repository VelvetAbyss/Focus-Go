import { useEffect, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { useMotionPreference } from '../prefs/useMotionPreference'
import { DEFAULT_TRANSITION } from './tokens'
import { installPressFeedback } from './pressFeedback'

/**
 * One motion policy for every motion/react component and the global press
 * feedback: the in-app "animations" switch turns JS motion off entirely, and
 * with it on we still follow the OS "reduce motion" setting (the CSS layer
 * already does both).
 */
export const MotionProvider = ({ children }: { children: ReactNode }) => {
  const { uiAnimationsEnabled } = useMotionPreference()

  useEffect(() => installPressFeedback(), [])

  return (
    <MotionConfig reducedMotion={uiAnimationsEnabled ? 'user' : 'always'} transition={DEFAULT_TRANSITION}>
      {children}
    </MotionConfig>
  )
}
