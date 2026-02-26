import { useEffect, useMemo, useRef, useState } from 'react'

type NoiseVisualizerBarsProps = {
  playing: boolean
}

const MOBILE_QUERY = '(max-width: 760px)'
const REDUCE_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const DESKTOP_BAR_COUNT = 20
const MOBILE_BAR_COUNT = 12
const MAX_HEIGHT_PX = 72
const HEIGHT_RATIO = 0.22
const WAVE_TIME_DIVISOR = 360

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const NoiseVisualizerBars = ({ playing }: NoiseVisualizerBarsProps) => {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const barsRef = useRef<HTMLSpanElement[]>([])
  const rafRef = useRef<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  })
  const [heightPx, setHeightPx] = useState(MAX_HEIGHT_PX)

  const barCount = useMemo(() => (isMobile ? MOBILE_BAR_COUNT : DESKTOP_BAR_COUNT), [isMobile])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia(MOBILE_QUERY)
    const sync = () => setIsMobile(media.matches)
    sync()
    if ('addEventListener' in media) {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia(REDUCE_MOTION_QUERY)
    const sync = () => setReduceMotion(media.matches)
    sync()
    if ('addEventListener' in media) {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibilityChange = () => setIsVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    barsRef.current = barsRef.current.slice(0, barCount)
  }, [barCount])

  useEffect(() => {
    const node = wrapRef.current
    if (!node || typeof ResizeObserver === 'undefined') return

    const updateHeight = () => {
      const width = node.clientWidth
      if (!width) return
      setHeightPx(clamp(width * HEIGHT_RATIO, 0, MAX_HEIGHT_PX))
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const phase = Date.now() / WAVE_TIME_DIVISOR
    for (let index = 0; index < barCount; index++) {
      const bar = barsRef.current[index]
      if (!bar) continue
      const x = index / 5
      const wave1 = Math.sin(x + phase) * 30
      const wave2 = Math.sin(x * 2 - phase * 1.5) * 20
      const height = Math.abs(wave1 + wave2) + 10
      const finalHeight = clamp(height, 5, 90)
      bar.style.height = `${finalHeight}%`
    }
  }, [barCount])

  useEffect(() => {
    const shouldAnimate = playing && isVisible && !reduceMotion
    if (!shouldAnimate) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    const animate = () => {
      const phase = Date.now() / WAVE_TIME_DIVISOR
      for (let index = 0; index < barCount; index++) {
        const bar = barsRef.current[index]
        if (!bar) continue
        const x = index / 5
        const wave1 = Math.sin(x + phase) * 30
        const wave2 = Math.sin(x * 2 - phase * 1.5) * 20
        const height = Math.abs(wave1 + wave2) + 10
        const finalHeight = clamp(height, 5, 90)
        bar.style.height = `${finalHeight}%`
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [barCount, isVisible, playing, reduceMotion])

  return (
    <div className="focus-noise-bars-wrap" ref={wrapRef} aria-hidden="true">
      <div className="focus-noise-bars" style={{ height: `${heightPx}px` }}>
        {Array.from({ length: barCount }).map((_, index) => (
          <span
            key={index}
            className="focus-noise-bars__bar"
            ref={(node) => {
              if (node) barsRef.current[index] = node
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default NoiseVisualizerBars
