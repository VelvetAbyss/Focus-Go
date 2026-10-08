// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  delete document.documentElement.dataset.sidebarTransition
  delete document.documentElement.dataset.motion
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = '' })

describe('sidebar layout transition', () => {
  it.each(['unsupported', 'app', 'os', 'hidden'])('applies immediately for %s', async (condition) => {
    const start = vi.fn()
    if (condition !== 'unsupported') Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start })
    if (condition === 'app') document.documentElement.dataset.motion = 'reduce'
    if (condition === 'os') vi.stubGlobal('matchMedia', () => ({ matches: true }))
    if (condition === 'hidden') Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    const { transitionSidebar } = await import('./sidebarTransition')
    const toggle = vi.fn()
    transitionSidebar(toggle)
    expect(toggle).toHaveBeenCalledOnce()
    expect(start).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.sidebarTransition).toBeUndefined()
  })

  it('counts every rapid click once even if old callbacks resolve late', async () => {
    const jobs: { update: () => void; finish: () => void; skip: ReturnType<typeof vi.fn> }[] = []
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (update: () => void) => {
      let finish!: () => void
      const finished = new Promise<void>((resolve) => { finish = resolve })
      const skip = vi.fn()
      jobs.push({ update, finish, skip })
      return { ready: Promise.resolve(), finished, skipTransition: skip }
    } })
    const { transitionSidebar } = await import('./sidebarTransition')
    let collapsed = false
    for (let i = 0; i < 3; i++) transitionSidebar(() => { collapsed = !collapsed })
    expect(jobs[0].skip).toHaveBeenCalledOnce()
    jobs[1].update()
    jobs[0].update()
    jobs[0].finish()
    await Promise.resolve()
    expect(document.documentElement.dataset.sidebarTransition).toBe('true')
    jobs[2].update()
    jobs[2].update()
    jobs[2].finish()
    await Promise.resolve()
    expect(collapsed).toBe(true)
    expect(document.documentElement.dataset.sidebarTransition).toBeUndefined()
  })

  it('uses only transform and opacity for fallback movement at a scaled workspace', async () => {
    document.body.innerHTML = '<aside class="focus-sidebar"></aside><main class="focus-shell__main"></main>'
    const main = document.querySelector<HTMLElement>('main')!
    const rail = document.querySelector<HTMLElement>('aside')!
    const cancel = vi.fn()
    const animation = { finished: new Promise<void>(() => {}), cancel }
    main.animate = vi.fn(() => animation as unknown as Animation)
    rail.animate = vi.fn(() => animation as unknown as Animation)
    Object.defineProperty(main, 'offsetWidth', { configurable: true, value: 500 })
    vi.spyOn(main, 'getBoundingClientRect')
      .mockReturnValueOnce({ left: 160, top: 20, width: 400 } as DOMRect)
      .mockReturnValue({ left: 48, top: 20, width: 400 } as DOMRect)
    const { transitionSidebar } = await import('./sidebarTransition')
    const toggle = vi.fn()
    transitionSidebar(toggle)
    expect(toggle).toHaveBeenCalledOnce()
    expect(main.animate).toHaveBeenCalledWith([
      { transform: 'translate(140px, 0px)', opacity: .7 },
      { transform: 'translate(0, 0)', opacity: 1 },
    ], { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    transitionSidebar(toggle)
    expect(cancel).toHaveBeenCalledTimes(2)
  })

  it('applies the click once and cleans up when snapshot capture fails', async () => {
    let update!: () => void
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (callback: () => void) => {
      update = callback
      return { ready: Promise.reject(new Error('skipped')), finished: Promise.reject(new Error('skipped')), skipTransition: vi.fn() }
    } })
    const { transitionSidebar } = await import('./sidebarTransition')
    const toggle = vi.fn()
    transitionSidebar(toggle)
    await Promise.resolve()
    update()
    expect(toggle).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.sidebarTransition).toBeUndefined()
  })
})
