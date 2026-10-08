// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_BEFORE_MODE_TOGGLE_EVENT } from './themePack'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  localStorage.clear()
  document.documentElement.dataset.theme = 'light'
  delete document.documentElement.dataset.motion
  delete document.documentElement.dataset.themeTransition
  document.documentElement.classList.remove('dark')
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('quick theme transition', () => {
  it('clears preview before applying and persists a working fallback without snapshot support', async () => {
    const { setThemeWithTransition } = await import('./themeTransition')
    document.documentElement.dataset.themePackPreview = 'theme-b'
    document.documentElement.style.setProperty('--bg', '#fff')
    const previous: string[] = []
    const listener = () => previous.push(document.documentElement.dataset.theme!)
    window.addEventListener(THEME_BEFORE_MODE_TOGGLE_EVENT, listener)
    setThemeWithTransition('dark')
    expect(previous).toEqual(['light'])
    expect(localStorage.getItem('focusgo.theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.themePackPreview).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
    vi.runAllTimers()
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()
    window.removeEventListener(THEME_BEFORE_MODE_TOGGLE_EVENT, listener)
  })

  it.each(['app', 'os'])('respects %s reduced motion without a snapshot or temporary transition state', async (source) => {
    const start = vi.fn()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    if (source === 'app') document.documentElement.dataset.motion = 'reduce'
    else vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { setThemeWithTransition } = await import('./themeTransition')
    setThemeWithTransition('dark')
    expect(start).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()
  })

  it('keeps the latest intent when older native snapshot callbacks finish out of order', async () => {
    const jobs: { update: () => void; finish: ReturnType<typeof deferred>; skipTransition: ReturnType<typeof vi.fn> }[] = []
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (update: () => void) => {
      const finish = deferred()
      const skipTransition = vi.fn()
      jobs.push({ update, finish, skipTransition })
      return { ready: Promise.resolve(), finished: finish.promise, skipTransition }
    } })
    const { setThemeWithTransition } = await import('./themeTransition')
    setThemeWithTransition('dark')
    setThemeWithTransition('light')
    setThemeWithTransition('dark')
    expect(jobs[0].skipTransition).toHaveBeenCalledOnce()
    expect(jobs[1].skipTransition).toHaveBeenCalledOnce()
    jobs[2].update(); jobs[0].update(); jobs[1].update()
    expect(document.documentElement.dataset.theme).toBe('dark')
    jobs[0].finish.resolve(); await Promise.resolve()
    expect(document.documentElement.dataset.themeTransition).toBe('crossfade')
    jobs[1].finish.resolve(); jobs[2].finish.resolve(); await Promise.resolve()
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()
    expect(localStorage.getItem('focusgo.theme')).toBe('dark')
  })

  it('still switches if the native snapshot API throws', async () => {
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: () => { throw new Error('Snapshot unavailable') } })
    const { setThemeWithTransition } = await import('./themeTransition')
    setThemeWithTransition('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    vi.runAllTimers()
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()
  })

  it('does not overwrite a newer selection from another theme entry point', async () => {
    let update!: () => void
    const finish = deferred()
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (callback: () => void) => {
      update = callback
      return { ready: Promise.resolve(), finished: finish.promise, skipTransition: vi.fn() }
    } })
    const { setThemeWithTransition } = await import('./themeTransition')
    setThemeWithTransition('dark')
    localStorage.setItem('focusgo.theme', 'system')
    update()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('focusgo.theme')).toBe('system')
    finish.resolve(); await Promise.resolve()
    expect(document.documentElement.dataset.themeTransition).toBeUndefined()
  })
})
