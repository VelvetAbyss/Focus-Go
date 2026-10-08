import { flushSync } from 'react-dom'
import { applyTheme, readStoredThemePreference, writeStoredThemePreference, type ThemeMode } from './theme'
import { clearThemePackPreview, THEME_BEFORE_MODE_TOGGLE_EVENT } from './themePack'

type ThemeTransition = {
  ready: Promise<void>
  finished: Promise<void>
  skipTransition: () => void
}

let revision = 0
let active: ThemeTransition | undefined
let cleanupTimer: ReturnType<typeof setTimeout> | undefined

/** Finite, user-triggered transition. A later click always wins, even while
 * the browser is still capturing the previous view-transition snapshot. */
export const setThemeWithTransition = (theme: ThemeMode) => {
  const request = ++revision
  active?.skipTransition()
  active = undefined
  clearTimeout(cleanupTimer)
  const root = document.documentElement
  delete root.dataset.themeTransition
  // Store intent immediately so rapid clicks toggle the pending selection too.
  writeStoredThemePreference(theme)
  let applied = false
  const update = () => {
    if (request !== revision || applied || readStoredThemePreference() !== theme) return
    applied = true
    flushSync(() => {
      window.dispatchEvent(new Event(THEME_BEFORE_MODE_TOGGLE_EVENT))
      clearThemePackPreview()
      applyTheme(theme)
    })
  }
  const cleanup = () => {
    if (request !== revision) return
    delete root.dataset.themeTransition
    active = undefined
  }
  const reduced = root.dataset.motion === 'reduce' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || document.hidden) {
    update()
    return
  }

  const browser = document as Document & { startViewTransition?: (callback: () => void) => ThemeTransition }
  if (browser.startViewTransition) {
    try {
      root.dataset.themeTransition = 'crossfade'
      const transition = browser.startViewTransition(update)
      active = transition
      // Snapshot failure skips the animation, not the user's theme choice.
      void transition.ready.catch(() => {})
      void transition.finished.then(cleanup, () => { update(); cleanup() })
      return
    } catch {
      // Older webviews can expose the API but reject a snapshot.
      delete root.dataset.themeTransition
    }
  }

  root.dataset.themeTransition = 'fallback'
  // Establish the old surface colours before applying the new variables.
  void getComputedStyle(root).color
  update()
  cleanupTimer = setTimeout(cleanup, 320)
}
