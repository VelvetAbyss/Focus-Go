import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveInitialTheme, subscribeTheme, type ThemeMode } from '../../shared/theme/theme'
import { createSceneStrategy, type SceneId, type SceneStrategy } from './ambient/scenes'
import {
  getAmbientPreferences,
  subscribeAmbientPreferences,
  type AmbientPreferences,
} from '../../features/focus/ambientPreferences'
import { useSharedNoise } from '../../features/focus/SharedNoiseProvider'
import type {
  SceneEmittedSignal,
  SceneNoiseLevels,
  SceneRuntime,
  SceneSignals,
} from './ambient/scenes/types'

type AmbientSceneStageProps = {
  scene: SceneId
}

const CROSSFADE_MS = 600
const MAX_DPR = 1.5
const INTENSITY_RAMP_MS = 3500

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

// Session seed: stable for a tab's lifetime, regenerated on reload.
const SESSION_SEED = Math.random()

type Layer = {
  /** React-owned wrapper; crossfades animate its opacity. */
  host: HTMLDivElement
  /** Stage-owned canvas, replaced with a fresh one for every strategy. */
  canvas: HTMLCanvasElement
  strategy: SceneStrategy | null
  sceneId: SceneId | null
  enteredAt: number | null
}

const AmbientSceneStage = ({ scene }: AmbientSceneStageProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const hostARef = useRef<HTMLDivElement | null>(null)
  const hostBRef = useRef<HTMLDivElement | null>(null)
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

  // Always-current refs read inside the rAF loop.
  const prefsRef = useRef<AmbientPreferences>(getAmbientPreferences())
  const cursorRef = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false })
  const { noise } = useSharedNoise()
  const noiseRef = useRef(noise)
  noiseRef.current = noise

  // Shell-side emitted effects (shake, warm tint, purple flash) — applied as CSS vars
  // on the .focus-shell so cards on top inherit the look too.
  const shellEffectsRef = useRef({
    shakeUntil: 0,
    shakeMagnitude: 0,
    warmTintTargetUntil: 0,
    warmTint: 0,
    purpleUntil: 0,
    purpleAlpha: 0,
  })

  // Reusable signal scaffolding — mutated in place each tick to avoid per-frame
  // allocation (buildSignals is called up to 2×/frame). Strategies read fields
  // synchronously inside tick() and never retain the object, so reuse is safe.
  const reusableTracksRef = useRef<SceneNoiseLevels>({
    cafe: { enabled: false, volume: 0 },
    fireplace: { enabled: false, volume: 0 },
    rain: { enabled: false, volume: 0 },
    wind: { enabled: false, volume: 0 },
    thunder: { enabled: false, volume: 0 },
    ocean: { enabled: false, volume: 0 },
  })
  const reusableCursorRef = useRef({ x: -9999, y: -9999, inside: false })
  const cachedNowRef = useRef<{ date: Date; at: number }>({ date: new Date(), at: 0 })
  const signalsActiveRef = useRef<SceneSignals | null>(null)
  const signalsInactiveRef = useRef<SceneSignals | null>(null)

  // Cached .focus-shell element + last-written values, so applyShellEffects can
  // skip the querySelector and skip redundant style writes / class toggles.
  const shellElRef = useRef<HTMLElement | null>(null)
  const shellFxStateRef = useRef({
    shakeOn: false,
    warmOn: false,
    purpleOn: false,
    lastShakeX: '',
    lastShakeY: '',
    lastWarm: '',
    lastPurple: '',
    idle: true, // true when nothing is active and nothing was active last frame
  })

  const noopEmit: (signal: SceneEmittedSignal) => void = () => {}

  // Reset all pending shell effects + clear their CSS classes/vars. Called when
  // the scene changes so the outgoing scene's warm flicker / shake / purple does
  // not bleed into the next scene.
  const clearShellEffects = () => {
    const e = shellEffectsRef.current
    e.shakeUntil = 0
    e.shakeMagnitude = 0
    e.warmTintTargetUntil = 0
    e.warmTint = 0
    e.purpleUntil = 0
    e.purpleAlpha = 0
    const s = shellFxStateRef.current
    const shell = shellElRef.current
    if (shell) {
      if (s.shakeOn) shell.classList.remove('is-fx-shake')
      if (s.warmOn) shell.classList.remove('is-fx-warm')
      if (s.purpleOn) shell.classList.remove('is-fx-purple')
    }
    s.shakeOn = false
    s.warmOn = false
    s.purpleOn = false
    s.lastShakeX = ''
    s.lastShakeY = ''
    s.lastWarm = ''
    s.lastPurple = ''
    s.idle = true
  }

  const emitSignal = (signal: SceneEmittedSignal) => {
    const e = shellEffectsRef.current
    const now = performance.now()
    switch (signal.type) {
      case 'shell-shake': {
        if (!prefsRef.current.effects.stormyNight.thunderShake) return
        e.shakeUntil = now + signal.durationMs
        e.shakeMagnitude = signal.magnitude
        break
      }
      case 'shell-warm-tint': {
        if (!prefsRef.current.effects.cozyFireside.globalWarmFlicker) return
        e.warmTintTargetUntil = now + 90
        e.warmTint = signal.intensity
        break
      }
      case 'shell-purple-flash': {
        if (!prefsRef.current.effects.stormyNight.afterFlashPurple) return
        e.purpleUntil = now + 900
        e.purpleAlpha = signal.intensity
        break
      }
    }
  }

  const [hud, setHud] = useState<{ ms: number; count: number } | null>(null)
  const hudOn = useRef<boolean>(false)
  useEffect(() => {
    hudOn.current = hudEnabled()
    if (hudOn.current) setHud({ ms: 0, count: 0 })
  }, [])

  // Build a runtime object once per render — strategies receive it by reference.
  // Mutated each tick before being passed to strategies, so deps don't matter here.
  const runtime = useMemo<SceneRuntime>(
    () => ({
      theme: themeRef.current,
      prefs: prefsRef.current,
      seed: SESSION_SEED,
      emit: emitSignal,
    }),
    [],
  )

  const viewportSize = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    return {
      w: Math.max(1, Math.floor(rect?.width ?? 1)),
      h: Math.max(1, Math.floor(rect?.height ?? 1)),
    }
  }

  const sizeCanvas2d = (canvas: HTMLCanvasElement) => {
    const { w, h } = viewportSize()
    const dpr = Math.min(MAX_DPR, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const isWebgl = (layer: Layer) => layer.strategy?.kind === 'webgl'

  // 2D layers are resized here; WebGL layers resize their own GL context.
  const sizeCanvases = () => {
    const layers = layersRef.current
    if (!layers) return
    const { w, h } = viewportSize()
    for (const layer of [layers.a, layers.b]) {
      if (isWebgl(layer)) layer.strategy?.resize?.(w, h)
      else sizeCanvas2d(layer.canvas)
    }
  }

  // Every strategy gets a fresh canvas: a canvas's context type is fixed once
  // taken, and 2D and WebGL scenes take turns on the same layer.
  const initLayer = (layer: Layer, sceneId: SceneId) => {
    layer.strategy?.cleanup()
    const strategy = createSceneStrategy(sceneId)
    const canvas = document.createElement('canvas')
    canvas.className = 'focus-shell__scene-canvas'
    layer.canvas.replaceWith(canvas)
    layer.canvas = canvas
    layer.strategy = strategy
    layer.sceneId = sceneId
    runtime.theme = themeRef.current
    runtime.prefs = prefsRef.current
    if (strategy.kind !== 'webgl') sizeCanvas2d(canvas)
    strategy.init(canvas, runtime)
    if (strategy.kind === 'webgl') {
      const { w, h } = viewportSize()
      strategy.resize?.(w, h)
    }
  }

  // Prefs subscription — keep the local ref hot.
  useEffect(() => {
    prefsRef.current = getAmbientPreferences()
    return subscribeAmbientPreferences(() => {
      prefsRef.current = getAmbientPreferences()
    })
  }, [])

  // Shell-effect tick: drives shake / warm / purple via CSS vars + state classes.
  // Hot path — must do nothing when no effect is active.
  const applyShellEffects = (now: number) => {
    const e = shellEffectsRef.current
    const s = shellFxStateRef.current

    // Compute active state cheaply first.
    const shakeActive = now < e.shakeUntil && e.shakeMagnitude > 0
    const warmActive = now < e.warmTintTargetUntil || e.warmTint > 0.002
    const purpleActive = now < e.purpleUntil

    // Fast exit: nothing active now and nothing was active last frame → no DOM work.
    if (!shakeActive && !warmActive && !purpleActive && s.idle) return

    let shell = shellElRef.current
    if (!shell) {
      shell = document.querySelector('.focus-shell') as HTMLElement | null
      shellElRef.current = shell
      if (!shell) return
    }

    // ── Shake ──
    let shakeX = 0
    let shakeY = 0
    if (shakeActive) {
      const remaining = (e.shakeUntil - now) / 280
      const m = e.shakeMagnitude * Math.max(0, Math.min(1, remaining))
      shakeX = (Math.random() - 0.5) * m * 1.2
      shakeY = (Math.random() - 0.5) * m
    }
    if (shakeActive !== s.shakeOn) {
      shell.classList.toggle('is-fx-shake', shakeActive)
      s.shakeOn = shakeActive
    }
    if (shakeActive || s.lastShakeX !== '0.00px') {
      const sx = `${shakeX.toFixed(2)}px`
      const sy = `${shakeY.toFixed(2)}px`
      if (sx !== s.lastShakeX) { shell.style.setProperty('--shell-shake-x', sx); s.lastShakeX = sx }
      if (sy !== s.lastShakeY) { shell.style.setProperty('--shell-shake-y', sy); s.lastShakeY = sy }
    }

    // ── Warm flicker ──
    let warm = 0
    if (now < e.warmTintTargetUntil) {
      warm = e.warmTint
    } else if (e.warmTint > 0.001) {
      e.warmTint *= 0.92
      warm = e.warmTint
    }
    if (warmActive !== s.warmOn) {
      shell.classList.toggle('is-fx-warm', warmActive)
      s.warmOn = warmActive
    }
    {
      const w = warm.toFixed(3)
      if (w !== s.lastWarm) { shell.style.setProperty('--shell-warm-flicker', w); s.lastWarm = w }
    }

    // ── Purple after-flash ──
    let purple = 0
    if (purpleActive) {
      const t = 1 - (e.purpleUntil - now) / 900
      purple = e.purpleAlpha * (1 - t)
    }
    if (purpleActive !== s.purpleOn) {
      shell.classList.toggle('is-fx-purple', purpleActive)
      s.purpleOn = purpleActive
    }
    {
      const p = purple.toFixed(3)
      if (p !== s.lastPurple) { shell.style.setProperty('--shell-purple-flash', p); s.lastPurple = p }
    }

    // Mark idle when everything settled, so the next frame can fast-exit.
    s.idle = !shakeActive && !warmActive && !purpleActive
  }

  // ---- mount-side: visibility, intersection, resize, cursor, theme ----
  useEffect(() => {
    const hostA = hostARef.current
    const hostB = hostBRef.current
    if (!hostA || !hostB) return

    const blankCanvas = (host: HTMLDivElement) => {
      const canvas = document.createElement('canvas')
      canvas.className = 'focus-shell__scene-canvas'
      host.appendChild(canvas)
      return canvas
    }
    layersRef.current = {
      a: { host: hostA, canvas: blankCanvas(hostA), strategy: null, sceneId: null, enteredAt: null },
      b: { host: hostB, canvas: blankCanvas(hostB), strategy: null, sceneId: null, enteredAt: null },
    }

    sizeCanvases()
    reducedRef.current = prefersReducedMotion() || isSaveData()

    const isAwake = () => visibleRef.current && inViewportRef.current

    const sleep = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      const layers = layersRef.current
      if (!layers) return
      ;[layers.a, layers.b].forEach((layer) => {
        if (isWebgl(layer)) return
        const ctx = layer.canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
      })
    }

    const wake = () => {
      if (!isAwake()) return
      const layers = layersRef.current
      if (!layers) return
      sizeCanvases()
      const active = layers[activeKeyRef.current]
      // WebGL scenes keep their context through a sleep; rebuilding would
      // recompile shaders (a visible hitch) every time the tab comes back.
      if (active.strategy && active.sceneId && !isWebgl(active)) {
        initLayer(active, active.sceneId)
        active.enteredAt = performance.now()
      }
      lastTsRef.current = 0
      accumulatorRef.current = 0
      startLoop()
    }

    const onVisibility = () => {
      visibleRef.current = !document.hidden
      if (visibleRef.current) wake()
      else sleep()
    }
    document.addEventListener('visibilitychange', onVisibility)

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

    let resizeFrame = 0
    const onResize = () => {
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        sizeCanvases()
        const layers = layersRef.current
        if (!layers) return
        const reinit = (layer: Layer) => {
          if (layer.strategy && layer.sceneId && !isWebgl(layer)) initLayer(layer, layer.sceneId)
        }
        reinit(layers.a)
        reinit(layers.b)
      })
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    if (ro && rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('resize', onResize)

    const dprMq =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
        : null
    const onDpr = () => onResize()
    dprMq?.addEventListener?.('change', onDpr)

    // Cursor tracking — pointermove on the shell (covers entire window).
    let cursorFrame = 0
    const shellEl = document.querySelector('.focus-shell') as HTMLElement | null
    const pendingCursor = { x: 0, y: 0, inside: false }
    const onPointerMove = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      const r = root.getBoundingClientRect()
      pendingCursor.x = event.clientX - r.left
      pendingCursor.y = event.clientY - r.top
      pendingCursor.inside =
        pendingCursor.x >= 0 && pendingCursor.x <= r.width && pendingCursor.y >= 0 && pendingCursor.y <= r.height
      if (!cursorFrame) {
        cursorFrame = requestAnimationFrame(() => {
          cursorFrame = 0
          cursorRef.current.x = pendingCursor.x
          cursorRef.current.y = pendingCursor.y
          cursorRef.current.inside = pendingCursor.inside
        })
      }
    }
    const onPointerLeave = () => {
      cursorRef.current.inside = false
    }
    shellEl?.addEventListener('pointermove', onPointerMove, { passive: true })
    shellEl?.addEventListener('pointerleave', onPointerLeave, { passive: true })

    const unsubscribeTheme = subscribeTheme((theme) => {
      themeRef.current = theme
      const layers = layersRef.current
      if (!layers) return
      ;[layers.a, layers.b].forEach((layer) => {
        if (!layer.strategy || !layer.sceneId) return
        if (isWebgl(layer)) layer.strategy.setTheme?.(theme)
        else initLayer(layer, layer.sceneId)
      })
    })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      if (ro) ro.disconnect()
      if (io) io.disconnect()
      if (resizeFrame) cancelAnimationFrame(resizeFrame)
      if (cursorFrame) cancelAnimationFrame(cursorFrame)
      shellEl?.removeEventListener('pointermove', onPointerMove)
      shellEl?.removeEventListener('pointerleave', onPointerLeave)
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
      // Clear shell vars + fx classes on unmount
      const shell = shellElRef.current ?? (document.querySelector('.focus-shell') as HTMLElement | null)
      if (shell) {
        shell.style.removeProperty('--shell-shake-x')
        shell.style.removeProperty('--shell-shake-y')
        shell.style.removeProperty('--shell-warm-flicker')
        shell.style.removeProperty('--shell-purple-flash')
        shell.classList.remove('is-fx-shake', 'is-fx-warm', 'is-fx-purple')
      }
      shellElRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Returns a Date refreshed at most every ~500ms. Hour/minute granularity is all
  // any scene reads (palette every 5s, sun moves over an hour), so this is
  // imperceptible and avoids a `new Date()` allocation every frame.
  const getCachedNow = (ts: number): Date => {
    const cache = cachedNowRef.current
    if (ts - cache.at >= 500) {
      cache.date = new Date()
      cache.at = ts
    }
    return cache.date
  }

  const buildSignals = (ts: number, layer: Layer, slot: 'active' | 'inactive'): SceneSignals => {
    const enteredAt = layer.enteredAt ?? ts
    const elapsed = ts - enteredAt
    // rAF timestamps can land a hair *before* enteredAt on a layer's first
    // frame; a negative ramp gave scenes negative particle counts (RangeError).
    // With motion reduced only one frame is ever drawn, so it has to be the
    // settled scene, not the first instant of the fade-in ramp.
    const ramped = prefsRef.current.intensityRamp && !reducedRef.current
    const intensity = ramped ? Math.min(1, Math.max(0, elapsed / INTENSITY_RAMP_MS)) : 1
    const audio = prefsRef.current.audioReactivity

    // Cursor: reuse a stable object; mirror the live cursor or park it off-screen.
    const cursor = reusableCursorRef.current
    if (prefsRef.current.cursorReactivity) {
      cursor.x = cursorRef.current.x
      cursor.y = cursorRef.current.y
      cursor.inside = cursorRef.current.inside
    } else {
      cursor.x = -9999
      cursor.y = -9999
      cursor.inside = false
    }

    // Noise tracks: reuse one object. Pre-multiply each track by master volume so
    // `signals.noise[id].volume` is the *effective audible* loudness — scenes couple
    // their density/frequency to what the user actually hears, not the raw slider.
    // (When the master volume is lowered or muted, the visuals quiet down with it.)
    const rt = reusableTracksRef.current
    const tracks = noiseRef.current.tracks
    const trackIds = ['cafe', 'fireplace', 'rain', 'wind', 'thunder', 'ocean'] as const
    const masterVolume = audio ? noiseRef.current.masterVolume : 0
    for (const id of trackIds) {
      if (audio) {
        rt[id].enabled = tracks[id].enabled
        rt[id].volume = tracks[id].volume * masterVolume
      } else {
        rt[id].enabled = false
        rt[id].volume = 0
      }
    }

    // Reuse one signals object per slot.
    const ref = slot === 'active' ? signalsActiveRef : signalsInactiveRef
    let signals = ref.current
    if (!signals) {
      signals = { noise: rt, masterVolume, cursor, intensity, now: getCachedNow(ts) }
      ref.current = signals
    } else {
      signals.noise = rt
      signals.masterVolume = masterVolume
      signals.cursor = cursor
      signals.intensity = intensity
      signals.now = getCachedNow(ts)
    }
    return signals
  }

  const startLoop = () => {
    if (rafRef.current) return
    if (reducedRef.current) {
      const layers = layersRef.current
      if (!layers) return
      const active = layers[activeKeyRef.current]
      runtime.theme = themeRef.current
      runtime.prefs = prefsRef.current
      const signals = buildSignals(performance.now(), active, 'active')
      active.strategy?.tick(1000 / 30, runtime, signals)
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
      const frameBudget = 1000 / prefsRef.current.frameRate
      if (accumulatorRef.current < frameBudget) return
      const tickDt = accumulatorRef.current
      accumulatorRef.current = 0

      const t0 = hudOn.current && typeof performance !== 'undefined' ? performance.now() : 0
      const active = layers[activeKeyRef.current]
      const inactive = layers[activeKeyRef.current === 'a' ? 'b' : 'a']

      runtime.theme = themeRef.current
      runtime.prefs = prefsRef.current

      if (active.strategy) {
        runtime.emit = emitSignal // only the active scene drives shell-wide effects
        const sig = buildSignals(ts, active, 'active')
        active.strategy.tick(tickDt, runtime, sig)
      }
      if (inactive.strategy && Number(inactive.host.style.opacity || '0') > 0) {
        runtime.emit = noopEmit // outgoing (fading) scene must not emit
        const sig = buildSignals(ts, inactive, 'inactive')
        inactive.strategy.tick(tickDt, runtime, sig)
      }
      applyShellEffects(ts)

      if (hudOn.current) {
        const ms = performance.now() - t0
        const count = (active.strategy?.particleCount() ?? 0) + (inactive.strategy?.particleCount() ?? 0)
        setHud((prev) => (prev && Math.abs(prev.ms - ms) < 0.05 && prev.count === count ? prev : { ms, count }))
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }

  // Scene change → crossfade.
  useEffect(() => {
    const layers = layersRef.current
    if (!layers) return

    const activeKey = activeKeyRef.current
    const active = layers[activeKey]

    if (active.sceneId === null) {
      initLayer(active, scene)
      active.enteredAt = performance.now()
      active.host.style.opacity = '1'
      const inactive = layers[activeKey === 'a' ? 'b' : 'a']
      inactive.host.style.opacity = '0'
      startLoop()
      return
    }

    if (active.sceneId === scene) return

    // Leaving a scene: drop its pending shell effects so warm/shake/purple don't
    // bleed into the next scene.
    clearShellEffects()

    const nextKey = activeKey === 'a' ? 'b' : 'a'
    const next = layers[nextKey]

    const generation = ++generationRef.current
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)

    initLayer(next, scene)
    next.enteredAt = performance.now()

    next.host.style.transition = `opacity ${CROSSFADE_MS}ms ease`
    active.host.style.transition = `opacity ${CROSSFADE_MS}ms ease`
    void next.host.offsetWidth
    next.host.style.opacity = '1'
    active.host.style.opacity = '0'

    activeKeyRef.current = nextKey
    startLoop()

    fadeTimerRef.current = window.setTimeout(() => {
      if (generation !== generationRef.current) return
      const outgoing = layers[nextKey === 'a' ? 'b' : 'a']
      outgoing.strategy?.cleanup()
      outgoing.strategy = null
      outgoing.sceneId = null
      outgoing.enteredAt = null
      fadeTimerRef.current = null
    }, CROSSFADE_MS + 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  return (
    <div
      ref={rootRef}
      className="focus-shell__scene-backdrop is-current"
      data-scene={scene}
      aria-hidden="true"
    >
      <div ref={hostARef} className="focus-shell__scene-layer" style={{ opacity: 0 }} />
      <div ref={hostBRef} className="focus-shell__scene-layer" style={{ opacity: 0 }} />
      <div className="focus-shell__scene-vignette" />
      {hud ? (
        <div className="focus-shell__scene-hud" role="status">
          <span>{hud.ms.toFixed(2)} ms/tick</span>
          <span>{hud.count} particles</span>
          <span>{scene}</span>
          <span>{prefsRef.current.frameRate}fps</span>
        </div>
      ) : null}
    </div>
  )
}

export default AmbientSceneStage
