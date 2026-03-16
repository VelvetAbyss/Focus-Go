import { useEffect, useState } from 'react'

export type TasksViewportBand = 'compact' | 'regular' | 'tall'
export type TasksViewportRatioBand = 'regular' | 'ultrawide'

export type TasksViewportProfile = {
  heightBand: TasksViewportBand
  ratioBand: TasksViewportRatioBand
  viewportHeight: number
}

type ViewportSize = {
  width: number
  height: number
}

const COMPACT_HEIGHT_MAX = 920
const TALL_HEIGHT_MIN = 1180
const ULTRAWIDE_RATIO_MIN = 1.78

export const resolveTasksViewportProfile = ({ width, height }: ViewportSize): TasksViewportProfile => {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const ratio = safeWidth / safeHeight

  const heightBand: TasksViewportBand =
    safeHeight <= COMPACT_HEIGHT_MAX ? 'compact' : safeHeight >= TALL_HEIGHT_MIN ? 'tall' : 'regular'

  return {
    heightBand,
    ratioBand: ratio >= ULTRAWIDE_RATIO_MIN ? 'ultrawide' : 'regular',
    viewportHeight: safeHeight,
  }
}

const readViewportProfile = () => {
  if (typeof window === 'undefined') {
    return { heightBand: 'regular', ratioBand: 'regular', viewportHeight: 0 } satisfies TasksViewportProfile
  }

  return resolveTasksViewportProfile({
    width: window.innerWidth,
    height: window.innerHeight,
  })
}

export const useTasksViewportProfile = () => {
  const [profile, setProfile] = useState<TasksViewportProfile>(() => readViewportProfile())

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncProfile = () => {
      setProfile((prev) => {
        const next = readViewportProfile()
        if (prev.heightBand === next.heightBand && prev.ratioBand === next.ratioBand && prev.viewportHeight === next.viewportHeight) return prev
        return next
      })
    }

    syncProfile()
    window.addEventListener('resize', syncProfile)
    return () => window.removeEventListener('resize', syncProfile)
  }, [])

  return profile
}
