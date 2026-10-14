import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { LampLightStore } from './lampLightStore'

/**
 * The desk lamp's light on the page: the whole app (sidebar included) goes a
 * little darker and a cone from the shade cuts through it, warm where it
 * falls. Two fixed 2D canvases above the shell and below menus and dialogs, at
 * half resolution (it is all soft gradients): the shade, with the cone cut out
 * of it, and the warmth, blended so it never washes out text (multiply on
 * light paper, screen on dark). They redraw when the light or the shade moves,
 * or when the page under them scrolls or reflows; the toggle itself animates
 * in the scene, which hands over a new beam each frame.
 */

/** The beam reaches at least this far (CSS px), and always past the bottom of
 *  the window; it spreads as tan(half-angle): full light inside, soft to outer. */
const BEAM_MIN_LENGTH = 640
const SPREAD_INNER = 0.6
const SPREAD_OUTER = 0.9
const RESOLUTION = 0.5

// The warmth is carried by colour at full alpha (white is no change under
// multiply, black none under screen): low alphas band in 8-bit canvas pixels.
type Look = { dim: string; dimAlpha: number; warmNear: string; warmFar: string; glow: string }
const lookFor = (dark: boolean): Look =>
  dark
    ? { dim: '10, 9, 7', dimAlpha: 0.5, warmNear: '74, 52, 24', warmFar: '30, 21, 9', glow: '120, 86, 40' }
    : { dim: '30, 24, 16', dimAlpha: 0.28, warmNear: '255, 230, 194', warmFar: '255, 246, 232', glow: '255, 214, 160' }

type Props = {
  store: LampLightStore
  /** The desk canvas the beam's coordinates belong to. */
  source: RefObject<HTMLCanvasElement | null>
  dark: boolean
}

const LampLight = ({ store, source, dark }: Props) => {
  const active = useSyncExternalStore(store.subscribe, () => store.get() !== null, () => false)
  if (!active || typeof document === 'undefined') return null
  return createPortal(<LampLightCanvases store={store} source={source} dark={dark} />, document.body)
}

const LampLightCanvases = ({ store, source, dark }: Props) => {
  const shadeRef = useRef<HTMLCanvasElement | null>(null)
  const warmRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const shadeCanvas = shadeRef.current
    const warmCanvas = warmRef.current
    const shade = shadeCanvas?.getContext('2d')
    const warm = warmCanvas?.getContext('2d')
    const mask = document.createElement('canvas')
    const maskCtx = mask.getContext('2d')
    if (!shadeCanvas || !warmCanvas || !shade || !warm || !maskCtx) return
    const look = lookFor(dark)
    // Multiply's no-op is white, screen's is black.
    const blank = dark ? '0, 0, 0' : '255, 255, 255'

    let lastKey = ''
    const draw = () => {
      const beam = store.get()
      const from = source.current
      if (!beam || !from) return
      const viewW = window.innerWidth
      const viewH = window.innerHeight
      const rect = from.getBoundingClientRect()
      const sx = rect.width / Math.max(1, from.clientWidth)
      const sy = rect.height / Math.max(1, from.clientHeight)
      const key = [viewW, viewH, rect.left, rect.top, rect.width, rect.height, beam.mouth, beam.dir, beam.light, beam.dim].join()
      if (key === lastKey) return
      lastKey = key

      const scale = Math.min(1, window.devicePixelRatio || 1) * RESOLUTION
      const w = Math.max(1, Math.round(viewW * scale))
      const h = Math.max(1, Math.round(viewH * scale))
      for (const c of [shadeCanvas, warmCanvas, mask]) {
        if (c.width !== w || c.height !== h) {
          c.width = w
          c.height = h
        }
      }
      // Screen px, then the buffer's scale.
      const at = (p: [number, number]): [number, number] => [(rect.left + p[0] * sx) * scale, (rect.top + p[1] * sy) * scale]
      const [mx, my] = at(beam.mouth)
      const [bx, by] = at(beam.bulb)
      const unit = sx * scale
      const radius = beam.radius * unit
      const length = Math.max(BEAM_MIN_LENGTH * unit, (h - my) * 1.1 + 40 * scale)
      const [dx, dy] = beam.dir
      // The cone's tip sits behind the mouth, inside the shade.
      const back = radius / SPREAD_OUTER
      const vx = mx - dx * back
      const vy = my - dy * back
      const reachEnd = length + back
      const light = beam.light

      // The cone: full light for most of its reach, then fading; soft at the sides.
      maskCtx.setTransform(1, 0, 0, 1, 0, 0)
      maskCtx.globalCompositeOperation = 'source-over'
      maskCtx.clearRect(0, 0, w, h)
      const reach = maskCtx.createRadialGradient(vx, vy, 0, vx, vy, reachEnd)
      reach.addColorStop(0, `rgba(0,0,0,${light})`)
      reach.addColorStop(0.7, `rgba(0,0,0,${light})`)
      reach.addColorStop(1, 'rgba(0,0,0,0)')
      maskCtx.fillStyle = reach
      maskCtx.fillRect(0, 0, w, h)
      maskCtx.globalCompositeOperation = 'destination-in'
      const axis = Math.atan2(dy, dx)
      const inner = Math.atan(SPREAD_INNER)
      const outer = Math.atan(SPREAD_OUTER)
      if (typeof maskCtx.createConicGradient === 'function') {
        const spread = maskCtx.createConicGradient(axis - Math.PI, vx, vy)
        const turn = (a: number) => 0.5 + a / (Math.PI * 2)
        spread.addColorStop(0, 'rgba(0,0,0,0)')
        spread.addColorStop(turn(-outer), 'rgba(0,0,0,0)')
        spread.addColorStop(turn(-inner), 'rgba(0,0,0,1)')
        spread.addColorStop(turn(inner), 'rgba(0,0,0,1)')
        spread.addColorStop(turn(outer), 'rgba(0,0,0,0)')
        spread.addColorStop(1, 'rgba(0,0,0,0)')
        maskCtx.fillStyle = spread
        maskCtx.fillRect(0, 0, w, h)
      } else {
        // Older WebKit: a plain wedge.
        const half = Math.tan((inner + outer) / 2)
        maskCtx.fillStyle = '#000'
        maskCtx.beginPath()
        maskCtx.moveTo(vx, vy)
        maskCtx.lineTo(vx + (dx - dy * half) * reachEnd, vy + (dy + dx * half) * reachEnd)
        maskCtx.lineTo(vx + (dx + dy * half) * reachEnd, vy + (dy - dx * half) * reachEnd)
        maskCtx.closePath()
        maskCtx.fill()
      }

      // The shade over the page, with the cone and the bulb cut out of it.
      shade.setTransform(1, 0, 0, 1, 0, 0)
      shade.globalCompositeOperation = 'source-over'
      shade.clearRect(0, 0, w, h)
      shade.fillStyle = `rgba(${look.dim}, ${look.dimAlpha * beam.dim})`
      shade.fillRect(0, 0, w, h)
      shade.globalCompositeOperation = 'destination-out'
      shade.drawImage(mask, 0, 0)
      const bulbGlow = shade.createRadialGradient(bx, by, 0, bx, by, 48 * unit)
      bulbGlow.addColorStop(0, `rgba(0,0,0,${0.95 * light})`)
      bulbGlow.addColorStop(1, 'rgba(0,0,0,0)')
      shade.fillStyle = bulbGlow
      shade.fillRect(0, 0, w, h)

      // The warmth: warmest by the lamp, paler where the light spreads, in the
      // cone only, plus a glow at the mouth.
      warm.setTransform(1, 0, 0, 1, 0, 0)
      warm.globalCompositeOperation = 'source-over'
      warm.clearRect(0, 0, w, h)
      const tone = warm.createRadialGradient(vx, vy, 0, vx, vy, reachEnd)
      tone.addColorStop(0, `rgb(${look.warmNear})`)
      tone.addColorStop(1, `rgb(${look.warmFar})`)
      warm.fillStyle = tone
      warm.fillRect(0, 0, w, h)
      warm.globalCompositeOperation = 'destination-in'
      warm.drawImage(mask, 0, 0)
      warm.globalCompositeOperation = 'source-over'
      const mouthGlow = warm.createRadialGradient(mx, my, 0, mx, my, 80 * unit)
      mouthGlow.addColorStop(0, `rgba(${look.glow}, ${light})`)
      mouthGlow.addColorStop(1, `rgba(${blank}, 0)`)
      warm.fillStyle = mouthGlow
      warm.fillRect(0, 0, w, h)
    }

    // The page can move under the light without the light changing (scrolling,
    // the sidebar folding, a card resizing): follow it closely for a moment
    // after anything that may have moved it, and check now and then besides.
    let raf = 0
    let followUntil = 0
    const tick = () => {
      raf = 0
      draw()
      if (performance.now() < followUntil) raf = requestAnimationFrame(tick)
    }
    const follow = () => {
      followUntil = performance.now() + 800
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const unsubscribe = store.subscribe(follow)
    const options = { capture: true, passive: true } as const
    window.addEventListener('resize', follow, options)
    document.addEventListener('scroll', follow, options)
    document.addEventListener('transitionrun', follow, options)
    document.addEventListener('pointerup', follow, options)
    const timer = window.setInterval(draw, 1000)
    follow()
    return () => {
      unsubscribe()
      window.removeEventListener('resize', follow, options)
      document.removeEventListener('scroll', follow, options)
      document.removeEventListener('transitionrun', follow, options)
      document.removeEventListener('pointerup', follow, options)
      window.clearInterval(timer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [store, source, dark])

  return (
    <>
      <canvas ref={shadeRef} className="desk-light" aria-hidden="true" />
      <canvas ref={warmRef} className={`desk-light ${dark ? 'desk-light--screen' : 'desk-light--multiply'}`} aria-hidden="true" />
    </>
  )
}

export default LampLight
