// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FocusTimerSnapshot } from '../../data/models/types'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), start: vi.fn(), complete: vi.fn(), play: vi.fn(),
  soundEnabled: vi.fn(), ticks: new Set<() => void>(),
}))
vi.mock('../../data/repositories/focusRepo', () => ({ focusRepo: {
  get: mocks.get, updateTimer: mocks.update, startSession: mocks.start, completeSession: mocks.complete,
} }))
vi.mock('../../shared/sound/interactionSounds', () => ({ playInteractionSound: mocks.play }))
vi.mock('../../shared/prefs/preferences', () => ({ readFocusCompletionSoundEnabled: mocks.soundEnabled, readLanguage: () => 'en' }))
vi.mock('../../shared/i18n/translator', () => ({ t: () => 'Finished' }))
vi.mock('../../platform', () => ({ getPlatform: () => ({ notify: vi.fn(), setFocusTimer: vi.fn() }) }))
vi.mock('./focusTask', () => ({ readFocusTaskId: () => undefined }))
vi.mock('../../shared/hooks/usePageActivity', async () => {
  const { useEffect } = await import('react')
  return {
    usePageActivity: () => 'visible',
    useVisibleInterval: (tick: () => void, _interval: number, options: { enabled: boolean }) => {
      useEffect(() => {
        if (!options.enabled) return
        mocks.ticks.add(tick)
        return () => { mocks.ticks.delete(tick) }
      }, [tick, options.enabled])
    },
  }
})
import { useSharedFocusTimer } from './useSharedFocusTimer'

let timer: FocusTimerSnapshot | undefined
let date = 1_800_000_000_000
beforeEach(() => {
  vi.clearAllMocks()
  mocks.ticks.clear()
  sessionStorage.clear()
  timer = undefined
  date += 10_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => date)
  mocks.get.mockImplementation(async () => ({ focusMinutes: 25, timer }))
  mocks.update.mockImplementation(async (next: FocusTimerSnapshot) => { timer = next })
  mocks.start.mockResolvedValue({ id: 'session-1' })
  mocks.complete.mockResolvedValue(undefined)
  mocks.soundEnabled.mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())
const mount = async () => {
  const hook = renderHook(() => useSharedFocusTimer({ defaultDurationMinutes: 25 }))
  await act(async () => {})
  return hook
}
const finish = async () => {
  date += 25 * 60 * 1000 + 1
  await act(async () => { for (const tick of mocks.ticks) tick() })
}

describe('shared focus audio', () => {
  it('keeps initialization and external refresh silent; actions each sound once', async () => {
    const { result } = await mount()
    expect(mocks.play).not.toHaveBeenCalled()
    await act(async () => { window.dispatchEvent(new Event('focus:timer-updated')) })
    expect(mocks.play).not.toHaveBeenCalled()
    await act(() => result.current.start(25))
    await act(() => result.current.pause())
    await act(() => result.current.resume())
    await act(() => result.current.reset())
    await act(() => result.current.reset())
    expect(mocks.play.mock.calls.map(([cue]) => cue)).toEqual(['start', 'pause', 'resume', 'reset'])
  })
  it('announces completion only once with two mounted timers', async () => {
    const first = await mount()
    await mount()
    await act(() => first.result.current.start(25))
    mocks.play.mockClear()
    await finish()
    expect(mocks.play).toHaveBeenCalledExactlyOnceWith('finish')
  })
  it('honors the separate completion sound preference', async () => {
    const { result } = await mount()
    mocks.soundEnabled.mockReturnValue(false)
    await act(() => result.current.start(25))
    mocks.play.mockClear()
    await finish()
    expect(mocks.play).not.toHaveBeenCalled()
  })
  it('does not replay a long expired session', async () => {
    const { result } = await mount()
    await act(() => result.current.start(25))
    mocks.play.mockClear()
    date += 3 * 60 * 1000
    await finish()
    expect(mocks.play).not.toHaveBeenCalled()
  })
  it('does not sound a successful start when local persistence fails', async () => {
    const { result } = await mount()
    mocks.update.mockRejectedValueOnce(new Error('storage unavailable'))
    await act(async () => { await expect(result.current.start(25)).rejects.toThrow('storage unavailable') })
    expect(mocks.play).not.toHaveBeenCalled()
  })
})
