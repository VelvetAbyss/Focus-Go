import { useEffect, useRef, useState } from 'react'
import { resolveInitialTheme, subscribeTheme, type ThemeMode } from '../../shared/theme/theme'
import { createSceneStrategy, type SceneId, type SceneStrategy } from './ambient/scenes'

type AmbientSceneStageProps = {
  scene: SceneId
}

// The ambient canvas is always viewed through the panels' 22px backdrop blur,
// so sub-pixel detail and high frame rates are imperceptible — but each frame
// forces a full-viewport backdrop-filter re-blur. Keeping FPS/DPR modest here
// is the single biggest CPU/GPU win with no visible change.
const TARGET_FPS = 20
const FRAME_BUDGET = 1000 / TARGET_FPS
const CROSSFADE_MS = 600
const MAX_DPR = 1

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const isSaveData = () => {
  if (typeof navigator === 'undefined') return false
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return Boolean(conn?.saveData)
}

const hudEnabled = () => {
  if (typeof window === 'undefined') return false
  try {
    return new URLSearchParams(window.location.search).get('ambientHud') === '1'
  } catch {
    return false
  }
}

type Layer = {
  canvas: HTMLCanvasElement
  strategy: SceneStrategy | null
  sceneId: SceneId | null
}

const AmbientSceneStage = ({ scene }: AmbientSceneStageProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasARef = useRef<HTMLCanvasElement | null>(null)
  const canvasBRef = useRef<HTMLCanvasElement | null>(null)
  const layersRef = useRef<{ a: Layer; b: Layer } | null>(null)
  const activeKeyRef = useRef<'a' | 'b'>('a')
  const rafRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const accumulatorRef = useRef<number>(0)
  const visibleRef = useRef<boolean>(true)
  const inViewportRef = useRef<boolean>(true)
  const themeRef = useRef<ThemeMode>(resolveInitialTheme())
  const generationRef = useRef<number>(0)
  const fadeTimerRef = useRef<number | null>(null)
  const reducedRef = useRef<boolean>(false)
  const dprRef = useRef<number>(1)

  const [hud, setHud] = useState<{ ms: number; count: number } | null>(null)
  const hudOn = useRef<boolean>(false)
  useEffect(() => {
    hudOn.current = hudEnabled()
    if (hudOn.current) setHud({ ms: 0, count: 0 })
  }, [])

  // Size both canvases to the shell, DPR-aware.
  const sizeCanvases = () => {
    const root = rootRef.current
    const a = canvasARef.current
    const b = canvasBRef.current
    if (!root || !a || !b) return
    const rect = root.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    const dpr = Math.min(MAX_DPR, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    dprRef.current = dpr
    for (const c of [a, b]) {
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      c.width = Math.floor(w * dpr)
      c.height = Math.floor(h * dpr)
      const ctx = c.getContext('2d')
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
  }

  // Initialize layers + theme subscribe + visibility + resize + DPR + reduced-motion.
  useEffect(() => {
    const a = canvasARef.current
    const b = canvasBRef.current
    if (!a || !b) return

    layersRef.current = {
      a: { canvas: a, strategy: null, sceneId: null },
      b: { canvas: b, strategy: null, sceneId: null },
    }

    sizeCanvases()

    reducedRef.current = prefersReducedMotion() || isSaveData()

    const isAwake = () => visibleRef.current && inViewportRef.current

    const sleep = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      // Clear both canvases so any wake-up paints a fresh frame instead of
      // a stale one peeking through during the next opacity transition.
      const layers = layersRef.current
      if (!layers) return
      ;[layers.a.canvas, layers.b.canvas].forEach((canvas) => {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      })
    }

    const wake = () => {
      if (!isAwake()) return
      const layers = layersRef.current
      if (!layers) return
      // Re-size in case the viewport changed while we slept.
      sizeCanvases()
      // Re-init the active strategy so particles spawn fresh, avoiding the
      // visible "snap" of very old positions.
      const active = layers[activeKeyRef.current]
      if (active.strategy && active.sceneId) {
        active.strategy.cleanup()
        active.strategy = createSceneStrategy(active.sceneId)
        active.strategy.init(active.canvas, themeRef.current)
      }
      lastTsRef.current = 0
      accumulatorRef.current = 0
      startLoop()
    }

    // Visibility (document.hidden): tab switch, window minimize.
    const onVisibility = () => {
      visibleRef.current = !document.hidden
      if (visibleRef.current) wake()
      else sleep()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // IntersectionObserver: shell scrolled out of view, route swap, etc.
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined' && rootRef.current) {
      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          const next = entry ? entry.intersectionRatio > 0.02 : true
          if (next === inViewportRef.current) return
          inViewportRef.current = next
          if (next) wake()
          else sleep()
        },
        { threshold: [0, 0.02, 0.2] },
      )
      io.observe(rootRef.current)
    }

    // Resize.
    let resizeFrame = 0
    const onResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        sizeCanvases()
        // Re-init currently-active strategies at new size.
        const layers = layersRef.current
        if (!layers) return
        const reinit = (layer: Layer) => {
          if (layer.strategy && layer.sceneId) {
            layer.strategy.cleanup()
            layer.strategy = createSceneStrategy(layer.sceneId)
            layer.strategy.init(layer.canvas, themeRef.current)
          }
        }
        reinit(layers.a)
        reinit(layers.b)
      })
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    if (ro && rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('resize', onResize)

    // DPR change (external monitor swap, zoom).
    const dprMq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
        : null
    const onDpr = () => onResize()
    dprMq?.addEventListener?.('change', onDpr)

    // Theme subscribe.
    const unsubscribeTheme = subscribeTheme((theme) => {
      themeRef.current = theme
      const layers = layersRef.current
      if (!layers) return
      ;[layers.a, layers.b].forEach((layer) => {
        if (layer.strategy && layer.sceneId) {
          layer.strategy.cleanup()
          layer.strategy = createSceneStrategy(layer.sceneId)
          layer.strategy.init(layer.canvas, theme)
        }
      })
    })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      if (ro) ro.disconnect()
      if (io) io.disconnect()
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      dprMq?.removeEventListener?.('change', onDpr)
      unsubscribeTheme()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = null
      }
      const layers = layersRef.current
      if (layers) {
        layers.a.strategy?.cleanup()
        layers.b.strategy?.cleanup()
      }
      layersRef.current = null
    }
  }, [])

  const startLoop = () => {
    if (rafRef.current) return
    if (reducedRef.current) {
      // Single static frame, no loop.
      const layers = layersRef.current
      if (!layers) return
      const active = layers[activeKeyRef.current]
      active.strategy?.tick(FRAME_BUDGET)
      return
    }

    const step = (ts: number) => {
      rafRef.current = requestAnimationFrame(step)
      if (!visibleRef.current || !inViewportRef.current) return
      const layers = layersRef.current
      if (!layers) return
      const last = lastTsRef.current || ts
      const delta = ts - last
      lastTsRef.current = ts
      accumulatorRef.current += delta
      if (accumulatorRef.current < FRAME_BUDGET) return
      const tickDt = accumulatorRef.current
      accumulatorRef.current = 0

      const t0 = hudOn.current && typeof performance !== 'undefined' ? performance.now() : 0
      const active = layers[activeKeyRef.current]
      const inactive = layers[activeKeyRef.current === 'a' ? 'b' : 'a']
      active.strategy?.tick(tickDt)
      // During crossfade the outgoing layer is still drawing too (so the fade reads smoothly).
      if (inactive.strategy && inactive.canvas.style.opacity !== '' && Number(inactive.canvas.style.opacity) > 0) {
        inactive.strategy.tick(tickDt)
      }
      if (hudOn.current) {
        const ms = performance.now() - t0
        const count = (active.strategy?.particleCount() ?? 0) + (inactive.strategy?.particleCount() ?? 0)
        setHud((prev) => (prev && Math.abs(prev.ms - ms) < 0.05 && prev.count === count ? prev : { ms, count }))
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  // Scene change → crossfade. Each layer owns its strategy/canvas for its lifetime.
  useEffect(() => {
    const layers = layersRef.current
    if (!layers) return

    const activeKey = activeKeyRef.current
    const active = layers[activeKey]

    // First mount: bind the active layer's strategy without a fade.
    if (active.sceneId === null) {
      active.strategy = createSceneStrategy(scene)
      active.sceneId = scene
      active.strategy.init(active.canvas, themeRef.current)
      active.canvas.style.opacity = '1'
      const inactive = layers[activeKey === 'a' ? 'b' : 'a']
      inactive.canvas.style.opacity = '0'
      startLoop()
      return
    }

    if (active.sceneId === scene) return

    // Crossfade: the inactive layer becomes the new active, fades in over CROSSFADE_MS.
    const nextKey = activeKey === 'a' ? 'b' : 'a'
    const next = layers[nextKey]

    const generation = ++generationRef.current
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)

    // Tear down anything stale on the incoming layer (e.g. a fade that didn't finish).
    next.strategy?.cleanup()
    next.strategy = createSceneStrategy(scene)
    next.sceneId = scene
    next.strategy.init(next.canvas, themeRef.current)

    // Trigger fade-in on next; fade-out on current.
    next.canvas.style.transition = `opacity ${CROSSFADE_MS}ms ease`
    active.canvas.style.transition = `opacity ${CROSSFADE_MS}ms ease`
    // Force a layout read so the transition catches.
    void next.canvas.offsetWidth
    next.canvas.style.opacity = '1'
    active.canvas.style.opacity = '0'

    activeKeyRef.current = nextKey
    startLoop()

    fadeTimerRef.current = window.setTimeout(() => {
      if (generation !== generationRef.current) return
      const outgoing = layers[nextKey === 'a' ? 'b' : 'a']
      outgoing.strategy?.cleanup()
      outgoing.strategy = null
      outgoing.sceneId = null
      fadeTimerRef.current = null
    }, CROSSFADE_MS + 50)
  }, [scene])

  return (
    <div
      ref={rootRef}
      className="focus-shell__scene-backdrop is-current"
      data-scene={scene}
      aria-hidden="true"
    >
      <canvas
        ref={canvasARef}
        className="focus-shell__scene-canvas"
        style={{ opacity: 0 }}
      />
      <canvas
        ref={canvasBRef}
        className="focus-shell__scene-canvas"
        style={{ opacity: 0 }}
      />
      <div className="focus-shell__scene-vignette" />
      {hud ? (
        <div className="focus-shell__scene-hud" role="status">
          <span>{hud.ms.toFixed(2)} ms/tick</span>
          <span>{hud.count} particles</span>
          <span>{scene}</span>
        </div>
      ) : null}
    </div>
  )
}

export default AmbientSceneStage
