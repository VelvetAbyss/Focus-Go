import { useMemo } from 'react'
import { usePreferences } from './usePreferences'

export const useMotionPreference = () => {
  const { uiAnimationsEnabled } = usePreferences()

  return useMemo(
    () => ({
      uiAnimationsEnabled,
      reduceMotion: !uiAnimationsEnabled,
    }),
    [uiAnimationsEnabled]
  )
}
