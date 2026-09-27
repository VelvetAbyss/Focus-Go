/**
 * App-wide press feedback: every button, tab, link-button and switch sinks a
 * little under the pointer and springs back on release, so the ~400
 * hand-written controls share one tactile response without per-component CSS.
 *
 * - The shrink is size-aware: small controls scale to 0.96, wide rows and cards
 *   only move a few pixels (a flat 0.96 on a 900px row would lurch by 36px).
 * - It animates the standalone `scale` property through the Web Animations API,
 *   so it composes with whatever `transform` the component already uses.
 * - Controls that already have their own press style (an :active transform,
 *   whileTap, a hover scale) are detected and left alone.
 * - Opt out with `data-press="off"` on the control or any ancestor.
 */

const PRESSABLE = [
  'button',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  'a[href]',
  'summary',
].join(',')

const SKIP = [
  '[data-press="off"]',
  '[aria-roledescription="sortable"]',
  '[contenteditable="true"]',
  '.react-grid-item.react-draggable-dragging',
].join(',')

const PRESS_IN_MS = 90
const RELEASE_MS = 320
const MAX_WIDTH = 720

const reduceMotion = () =>
  document.documentElement.getAttribute('data-motion') === 'reduce' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scaleFor = (width: number, height: number) => {
  const size = Math.max(width, height)
  return Math.min(0.992, Math.max(0.96, 1 - 5 / size))
}

type ActivePress = {
  el: HTMLElement
  anim: Animation
  scale: number
  small: boolean
}

export const installPressFeedback = (): (() => void) => {
  if (typeof window === 'undefined' || typeof Element.prototype.animate !== 'function') return () => {}

  let active: ActivePress | null = null

  const release = () => {
    const press = active
    active = null
    if (!press) return
    const { el, anim, scale, small } = press
    if (!el.isConnected) {
      anim.cancel()
      return
    }
    // Start the return trip before cancelling the hold so no frame snaps to 1.
    el.animate([{ scale: String(scale) }, { scale: '1' }], {
      duration: RELEASE_MS,
      easing: small ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' : 'cubic-bezier(0.22, 1, 0.36, 1)',
    })
    anim.cancel()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary) return
    if (active) release()
    if (reduceMotion()) return

    const target = event.target instanceof Element ? event.target : null
    const el = target?.closest<HTMLElement>(PRESSABLE)
    if (!el || el.closest(SKIP)) return
    if (el.matches(':disabled, [aria-disabled="true"]')) return

    const rect = el.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8 || rect.width > MAX_WIDTH) return

    const style = window.getComputedStyle(el)
    if (style.display === 'inline' || (style.scale && style.scale !== 'none')) return
    const transformBefore = style.transform

    const scale = scaleFor(rect.width, rect.height)
    const anim = el.animate([{ scale: '1' }, { scale: String(scale) }], {
      duration: PRESS_IN_MS,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      fill: 'forwards',
    })
    const press: ActivePress = { el, anim, scale, small: Math.max(rect.width, rect.height) <= 160 }
    active = press

    // The element's own :active / whileTap styling lands after pointerdown.
    // If it moves the element itself, step aside instead of double-pressing.
    window.requestAnimationFrame(() => {
      if (active !== press) return
      if (window.getComputedStyle(el).transform !== transformBefore) {
        anim.cancel()
        active = null
      }
    })
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') release()
  }

  window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true })
  window.addEventListener('pointerup', release, { capture: true, passive: true })
  window.addEventListener('pointercancel', release, { capture: true, passive: true })
  window.addEventListener('dragstart', release, { capture: true, passive: true })
  window.addEventListener('blur', release)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    release()
    window.removeEventListener('pointerdown', onPointerDown, { capture: true })
    window.removeEventListener('pointerup', release, { capture: true })
    window.removeEventListener('pointercancel', release, { capture: true })
    window.removeEventListener('dragstart', release, { capture: true })
    window.removeEventListener('blur', release)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
