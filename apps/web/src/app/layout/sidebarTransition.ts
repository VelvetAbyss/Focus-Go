import { flushSync } from 'react-dom'

type Transition = { ready?: Promise<void>; finished: Promise<void>; skipTransition: () => void }
let active: Transition | undefined
let revision = 0
let fallbackAnimations: Animation[] = []

/** Snapshot the finite layout change instead of repainting every width step. */
export const transitionSidebar = (toggle: () => void) => {
  const root = document.documentElement
  const request = ++revision
  active?.skipTransition()
  fallbackAnimations.forEach((animation) => animation.cancel())
  fallbackAnimations = []
  active = undefined
  delete root.dataset.sidebarTransition
  let applied = false
  const update = () => {
    if (applied) return
    applied = true
    flushSync(toggle)
  }
  const reduced = root.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const browser = document as Document & { startViewTransition?: (update: () => void) => Transition }
  if (reduced || document.hidden) {
    update()
    return
  }
  const fallback = () => {
    const main = document.querySelector<HTMLElement>('.focus-shell__main')
    const previous = main?.getBoundingClientRect()
    update()
    if (!main?.animate || !previous) return
    const next = main.getBoundingClientRect()
    const scale = main.offsetWidth ? next.width / main.offsetWidth : 1
    const timing = { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    const rail = document.querySelector<HTMLElement>('.focus-sidebar')
    fallbackAnimations = [main.animate([
      { transform: `translate(${(previous.left - next.left) / scale}px, ${(previous.top - next.top) / scale}px)`, opacity: .7 },
      { transform: 'translate(0, 0)', opacity: 1 },
    ], timing)]
    if (rail?.animate) fallbackAnimations.push(rail.animate([{ opacity: .7 }, { opacity: 1 }], timing))
    void Promise.allSettled(fallbackAnimations.map((animation) => animation.finished)).then(() => {
      if (request === revision) fallbackAnimations = []
    })
  }
  if (!browser.startViewTransition) {
    fallback()
    return
  }
  const cleanup = () => {
    if (request !== revision) return
    delete root.dataset.sidebarTransition
    active = undefined
  }
  try {
    root.dataset.sidebarTransition = 'true'
    active = browser.startViewTransition(update)
    void active.ready?.catch(() => {})
    void active.finished.then(cleanup, () => { update(); cleanup() })
  } catch {
    fallback()
    cleanup()
  }
}
