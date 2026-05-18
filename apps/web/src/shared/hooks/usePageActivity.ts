import { useEffect, useRef, useSyncExternalStore } from 'react'

export type PageActivity = 'visible' | 'hidden' | 'background'

let pageHiddenByLifecycle = false

export const getPageActivity = (): PageActivity => {
  if (typeof document === 'undefined') return 'visible'
  if (pageHiddenByLifecycle || document.visibilityState !== 'visible') return 'hidden'
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return 'background'
  return 'visible'
}

export const isPageActive = () => getPageActivity() === 'visible'

export const subscribePageActivity = (listener: () => void) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  const emit = () => listener()
  const handlePageHide = () => {
    pageHiddenByLifecycle = true
    emit()
  }
  const handlePageShow = () => {
    pageHiddenByLifecycle = false
    emit()
  }

  document.addEventListener('visibilitychange', emit)
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
  window.addEventListener('focus', emit)
  window.addEventListener('blur', emit)

  return () => {
    document.removeEventListener('visibilitychange', emit)
    window.removeEventListener('pagehide', handlePageHide)
    window.removeEventListener('pageshow', handlePageShow)
    window.removeEventListener('focus', emit)
    window.removeEventListener('blur', emit)
  }
}

export const usePageActivity = () =>
  useSyncExternalStore(subscribePageActivity, getPageActivity, () => 'visible')

type VisibleIntervalOptions = {
  enabled?: boolean
  runOnVisible?: boolean
}

export const useVisibleInterval = (
  callback: () => void,
  delayMs: number | null,
  options: VisibleIntervalOptions = {},
) => {
  const { enabled = true, runOnVisible = false } = options
  const activity = usePageActivity()
  const callbackRef = useRef(callback)
  const wasActiveRef = useRef(activity === 'visible')

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const active = enabled && delayMs !== null && activity === 'visible'
    if (active && runOnVisible && !wasActiveRef.current) callbackRef.current()
    wasActiveRef.current = active

    if (!active || delayMs === null) return
    const id = window.setInterval(() => callbackRef.current(), delayMs)
    return () => window.clearInterval(id)
  }, [activity, delayMs, enabled, runOnVisible])
}

type VisibleRafOptions = {
  enabled?: boolean
  drawOnPause?: boolean
}

export const useVisibleRaf = (
  callback: (time: number) => void,
  options: VisibleRafOptions = {},
) => {
  const { enabled = true, drawOnPause = false } = options
  const activity = usePageActivity()
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || activity !== 'visible') {
      if (drawOnPause) callbackRef.current(performance.now())
      return
    }

    let rafId = 0
    const loop = (time: number) => {
      callbackRef.current(time)
      rafId = window.requestAnimationFrame(loop)
    }
    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [activity, drawOnPause, enabled])
}
