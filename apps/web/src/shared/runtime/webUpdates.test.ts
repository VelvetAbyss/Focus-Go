// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startWebUpdates } from './webUpdates'
import { onPrepareAppUpdate, prepareAppUpdate } from './updateLifecycle'

const oldRelease = 'aaaaaaa'
const newRelease = 'bbbbbbb'
let dispose = () => {}
let reload: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>
const tick = async (ms: number) => { await vi.advanceTimersByTimeAsync(ms) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T08:00:00Z'))
  sessionStorage.clear()
  document.body.innerHTML = ''
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
  reload = vi.fn()
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: newRelease }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { dispose(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('web release updates', () => {
  it('checks without browser cache and reloads once after an idle period, preserving stored data', async () => {
    localStorage.setItem('update-test-local-draft', 'keep')
    dispose = startWebUpdates(oldRelease, reload)
    await tick(29_000)
    expect(reload).not.toHaveBeenCalled()
    await tick(1000)
    expect(reload).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/release.json\?check=/), expect.objectContaining({ cache: 'no-store' }))
    await tick(120_000)
    expect(reload).toHaveBeenCalledOnce()
    expect(localStorage.getItem('update-test-local-draft')).toBe('keep')
    localStorage.removeItem('update-test-local-draft')
  })

  it('downloads a versioned worker and waits for it to control the page before reloading', async () => {
    const workers = Object.assign(new EventTarget(), {
      controller: { scriptURL: `http://localhost/sw.js?v=${oldRelease}` },
      register: vi.fn().mockResolvedValue({ update: vi.fn().mockResolvedValue(undefined) }),
    })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: workers })
    dispose = startWebUpdates(oldRelease, reload)
    await tick(30_000)
    expect(workers.register).toHaveBeenCalledWith(`/sw.js?v=${newRelease}`, { scope: '/', updateViaCache: 'none' })
    expect(reload).not.toHaveBeenCalled()
    workers.controller.scriptURL = `http://localhost/sw.js?v=${newRelease}`
    workers.dispatchEvent(new Event('controllerchange'))
    await tick(0)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('waits for typing, Chinese composition, focused inputs and dialogs to finish', async () => {
    dispose = startWebUpdates(oldRelease, reload)
    document.body.innerHTML = '<input /><div role="dialog"></div>'
    const input = document.querySelector('input')!
    input.focus()
    window.dispatchEvent(new Event('compositionstart'))
    await tick(31_000)
    expect(reload).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('compositionend'))
    input.blur()
    await tick(31_000)
    expect(reload).not.toHaveBeenCalled()
    document.querySelector('[role="dialog"]')!.remove()
    window.dispatchEvent(new Event('input'))
    await tick(29_000)
    expect(reload).not.toHaveBeenCalled()
    await tick(1000)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload until local saves have committed', async () => {
    let finish!: () => void
    const stopSave = onPrepareAppUpdate(() => new Promise<void>(resolve => { finish = resolve }))
    dispose = startWebUpdates(oldRelease, reload)
    await tick(30_000)
    expect(reload).not.toHaveBeenCalled()
    finish()
    await tick(0)
    expect(reload).toHaveBeenCalledOnce()
    stopSave()
  })

  it('retries after a failed save and cancels a reload if interaction resumes during saving', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let stopSave = onPrepareAppUpdate(() => Promise.reject(new Error('disk unavailable')))
    dispose = startWebUpdates(oldRelease, reload)
    await tick(30_000)
    expect(reload).not.toHaveBeenCalled()
    stopSave()
    let finish!: () => void
    stopSave = onPrepareAppUpdate(() => new Promise<void>(resolve => { finish = resolve }))
    await tick(1000)
    window.dispatchEvent(new Event('pointerdown'))
    finish()
    await tick(0)
    expect(reload).not.toHaveBeenCalled()
    stopSave()
    await tick(30_000)
    expect(reload).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('keeps the current app when offline and checks again on reconnect', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    dispose = startWebUpdates(oldRelease, reload)
    await tick(120_000)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    window.dispatchEvent(new Event('online'))
    await tick(1000)
    expect(reload).toHaveBeenCalledOnce()
  })

  it.each([oldRelease, 'local', '<html>not a release</html>'])('ignores unchanged or invalid release %s', async version => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ version }) })
    dispose = startWebUpdates(oldRelease, reload)
    await tick(120_000)
    expect(reload).not.toHaveBeenCalled()
  })

  it('keeps the current app on network failures and cleans up polling', async () => {
    fetchMock.mockRejectedValue(new Error('server unavailable'))
    dispose = startWebUpdates(oldRelease, reload)
    await tick(30_000)
    dispose()
    const checks = fetchMock.mock.calls.length
    window.dispatchEvent(new Event('online'))
    await tick(120_000)
    expect(fetchMock).toHaveBeenCalledTimes(checks)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not update hidden tabs until they become visible', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    dispose = startWebUpdates(oldRelease, reload)
    await tick(30_000)
    expect(reload).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await tick(1000)
    expect(reload).toHaveBeenCalledOnce()
  })
})

it('defers repository preparation until all editor listeners have handed over keystrokes', async () => {
  const order: string[] = []
  const stopPage = onPrepareAppUpdate(async () => { await Promise.resolve(); order.push('saved') })
  const stopEditor = onPrepareAppUpdate(() => { order.push('flushed') })
  await prepareAppUpdate()
  expect(order).toEqual(['flushed', 'saved'])
  stopPage(); stopEditor()
})
