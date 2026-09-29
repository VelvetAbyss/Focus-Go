import { WebGLRenderer } from 'three'
import { isMotionReduced, type SceneFactory, type SurfaceHandle, type SurfaceOptions, type SurfaceScene } from './surface'

/**
 * Drives one three.js scene on a canvas: sizing, a capped frame loop, sleeping
 * while the tab is hidden or the canvas is scrolled away, a single still frame
 * when motion is reduced, and a full teardown (including the GL context) on
 * dispose. Only lazily loaded scene modules import this file.
 */
export function runSurface<P>(
  canvas: HTMLCanvasElement,
  factory: SceneFactory<P>,
  params: P,
  options: SurfaceOptions = {},
): SurfaceHandle<P> {
  const { maxDpr = 2, renderScale = 1, stillTime = 12.5, onDemand = false } = options
  let fps = options.fps ?? 30

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true })
  } catch {
    return { ok: false, setParams() {}, setFps() {}, dispose() {} }
  }
  renderer.setClearColor(0x000000, 0)

  const measure = () => ({ width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight) })
  let { width, height } = measure()
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr) * renderScale
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height, false)

  const still = isMotionReduced()
  let scene: SurfaceScene<P>
  try {
    scene = factory({ renderer, width, height, dpr, still }, params)
  } catch (error) {
    renderer.dispose()
    renderer.forceContextLoss()
    console.error('[three] scene failed to build', error)
    return { ok: false, setParams() {}, setFps() {}, dispose() {} }
  }

  let raf = 0
  let last = 0
  let elapsed = 0
  let accumulator = 0
  let visible = !document.hidden
  let onScreen = true
  let disposed = false

  const drawStill = () => {
    if (disposed) return
    scene.frame(0, stillTime)
  }

  // On demand: one frame per request, then more only while the scene reports
  // that it is still moving. Nothing runs while the picture is at rest.
  let pending = false
  const demandLoop = (ts: number) => {
    raf = 0
    const delta = last ? Math.min(0.1, (ts - last) / 1000) : 0
    last = ts
    elapsed += delta
    const again = scene.frame(delta, elapsed) === true
    if (again && visible && onScreen && !disposed) raf = requestAnimationFrame(demandLoop)
    else last = 0
  }
  const requestFrame = () => {
    if (disposed) return
    if (!visible || !onScreen) {
      pending = true
      return
    }
    pending = false
    if (!raf) raf = requestAnimationFrame(demandLoop)
  }

  const loop = (ts: number) => {
    raf = requestAnimationFrame(loop)
    const delta = last ? Math.min(0.1, (ts - last) / 1000) : 0
    last = ts
    accumulator += delta
    if (accumulator < 1 / fps) return
    const dt = accumulator
    accumulator = 0
    elapsed += dt
    scene.frame(dt, elapsed)
  }

  const start = () => {
    if (onDemand) {
      if (pending) requestFrame()
      return
    }
    if (disposed || raf || still || !visible || !onScreen) return
    last = 0
    raf = requestAnimationFrame(loop)
  }
  const stop = () => {
    if (raf) {
      cancelAnimationFrame(raf)
      // An animation cut short by a hidden tab resumes when it comes back.
      if (onDemand) pending = true
    }
    raf = 0
  }

  const onVisibility = () => {
    visible = !document.hidden
    if (visible) start()
    else stop()
  }
  document.addEventListener('visibilitychange', onVisibility)

  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([entry]) => {
        onScreen = entry ? entry.isIntersecting : true
        if (onScreen) start()
        else stop()
      })
    : null
  io?.observe(canvas)

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        const next = measure()
        if (next.width === width && next.height === height) return
        width = next.width
        height = next.height
        renderer.setSize(width, height, false)
        scene.resize(width, height)
        if (onDemand) requestFrame()
        else if (still) drawStill()
      })
    : null
  ro?.observe(canvas)

  if (onDemand) requestFrame()
  else if (still) drawStill()
  else start()

  return {
    ok: true,
    setParams(next) {
      scene.update(next)
      if (onDemand) requestFrame()
      else if (still) drawStill()
    },
    setFps(next) {
      fps = Math.max(1, next)
    },
    dispose() {
      if (disposed) return
      disposed = true
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      io?.disconnect()
      ro?.disconnect()
      scene.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
