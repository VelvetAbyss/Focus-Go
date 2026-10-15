// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sprite from './assets/sprite.json'
import woodSprite from './assets/wood-sprite.json'

const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve() }
let now = 1000
let audioState = 'suspended'
let engine: typeof import('./interactionSounds')
let prefs: typeof import('./soundPreferences')
let cleanup: (() => void) | undefined
const start = vi.fn()
const stop = vi.fn()
const decode = vi.fn()
const resume = vi.fn()
const gains: Array<{ value: number }> = []

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  localStorage.clear()
  now = 1000
  audioState = 'suspended'
  gains.length = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }))
  decode.mockResolvedValue({ duration: 8 })
  const audio = {
    get state() { return audioState }, currentTime: 0, destination: {}, decodeAudioData: decode, resume,
    createGain: () => {
      const gain = { value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }
      gains.push(gain)
      return { gain, connect: vi.fn(), disconnect: vi.fn() }
    },
    createBufferSource: () => ({ start, stop, connect: vi.fn(), disconnect: vi.fn(), buffer: null, onended: null }),
  }
  resume.mockImplementation(async () => { audioState = 'running' })
  vi.stubGlobal('AudioContext', vi.fn(function () { return audio }))
  prefs = await import('./soundPreferences')
  engine = await import('./interactionSounds')
})
afterEach(() => { cleanup?.(); cleanup = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('optional interaction audio', () => {
  it('defaults to warm wood, preloads silently, and unlocks on a gesture', async () => {
    expect(prefs.getSoundPreferences()).toEqual({ enabled: true, theme: 'wood', volume: 0.45 })
    cleanup = engine.installInteractionSounds()
    await flush()
    expect(AudioContext).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('pointerdown'))
    engine.playInteractionSound('complete')
    await flush()
    expect(resume).toHaveBeenCalled()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('plays all 13 gestures with each theme, with cached decoding', async () => {
    const events = ['tap','on','off','create','place','complete','undo','remove','start','pause','resume','reset','finish'] as const
    for (const theme of ['wood', 'grain', 'soft'] as const) {
      prefs.setSoundPreferences({ theme })
      for (const event of events) {
        now += 500
        engine.playInteractionSound(event)
        await flush()
        const manifest = theme === 'wood' ? woodSprite : sprite
        const call = start.mock.calls.at(-1)!
        if (event === 'tap') {
          expect(Object.entries(manifest).filter(([key]) => key.startsWith('tap-')).some(([, clip]) => call[1] === clip.offset && call[2] === clip.duration)).toBe(true)
        } else {
          expect(call.slice(1)).toEqual([manifest[event].offset, manifest[event].duration])
        }
      }
    }
    expect(start).toHaveBeenCalledTimes(39)
    expect(decode).toHaveBeenCalledTimes(3)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('plays all six approved wood taps per bag without repeating at bag boundaries', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    for (let i = 0; i < 18; i += 1) {
      now += 500
      engine.playInterfaceSound()
      await flush()
    }
    const offsets = start.mock.calls.map((call) => call[1] as number)
    const expected = Object.entries(woodSprite).filter(([key]) => key.startsWith('tap-')).map(([, clip]) => clip.offset).sort((a, b) => a - b)
    for (let i = 0; i < 18; i += 6) expect(offsets.slice(i, i + 6).sort((a, b) => a - b)).toEqual(expected)
    expect(offsets.every((offset, i) => i === 0 || offset !== offsets[i - 1])).toBe(true)
  })

  it.each([false, true])('retains the approved listening level and the quieter interface tier (subtle=%s)', async (subtle) => {
    if (subtle) engine.playInterfaceSound()
    else engine.playInteractionSound('complete')
    await flush()
    expect(start).toHaveBeenCalledTimes(1)
    expect(gains[0].value * gains[1].value).toBeCloseTo(subtle ? .1782 : .324)
  })

  it('does not spend tap variants on cancelled playback requests', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    for (let i = 0; i < 6; i += 1) {
      now += 500
      engine.playInterfaceSound()
      engine.stopInteractionSounds()
      await flush()
      now += 500
      engine.playInterfaceSound()
      await flush()
    }
    expect(start).toHaveBeenCalledTimes(6)
    expect(new Set(start.mock.calls.map((call) => call[1])).size).toBe(6)
  })

  it('waits for the first gesture to unlock audio without losing its quiet cue', async () => {
    let unlock!: () => void
    resume.mockReturnValue(new Promise<void>((resolve) => {
      unlock = () => { audioState = 'running'; resolve() }
    }))
    engine.playInterfaceSound()
    await flush()
    expect(start).not.toHaveBeenCalled()
    now += 50
    unlock()
    await flush()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending decode when muted, with no late playback after unmuting', async () => {
    let resolve!: (value: object) => void
    decode.mockReturnValue(new Promise((done) => { resolve = done }))
    cleanup = engine.installInteractionSounds()
    engine.playInteractionSound('complete')
    await flush()
    prefs.setSoundPreferences({ enabled: false })
    prefs.setSoundPreferences({ enabled: true })
    resolve({ duration: 5 })
    await flush()
    expect(start).not.toHaveBeenCalled()
  })

  it('silences active voices and respects zero volume, including finish', async () => {
    cleanup = engine.installInteractionSounds()
    engine.playInteractionSound('start')
    await flush()
    prefs.setSoundPreferences({ volume: 0 })
    expect(stop).toHaveBeenCalled()
    now += 500
    engine.playInteractionSound('finish')
    await flush()
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('recovers from an interrupted context on the next gesture', async () => {
    engine.playInteractionSound('start')
    await flush()
    audioState = 'interrupted'
    now += 500
    engine.playInteractionSound('pause')
    await flush()
    expect(resume).toHaveBeenCalledTimes(2)
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('does not retry a missing asset for every keystroke', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    cleanup = engine.installInteractionSounds()
    await flush()
    for (let i = 0; i < 10; i += 1) {
      now += 100
      window.dispatchEvent(new Event('keydown'))
      await flush()
    }
    expect(fetch).toHaveBeenCalledTimes(1)
    now += 11_000
    window.dispatchEvent(new Event('pointerdown'))
    await flush()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('drops feedback that became stale while a file was decoding', async () => {
    let resolve!: (value: object) => void
    decode.mockReturnValue(new Promise((done) => { resolve = done }))
    engine.playInteractionSound('complete')
    await flush()
    now += 1000
    resolve({ duration: 5 })
    await flush()
    expect(start).not.toHaveBeenCalled()
  })

  it('limits rapid repeats, but allows the timer completion in the background', async () => {
    engine.playInteractionSound('tap')
    engine.playInteractionSound('tap')
    await flush()
    expect(start).toHaveBeenCalledTimes(1)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    now += 500
    engine.playInteractionSound('create')
    engine.playInteractionSound('finish')
    await flush()
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('prioritizes a completed task over a pending ordinary tap', async () => {
    engine.playInterfaceSound()
    engine.playInteractionSound('complete')
    await flush()
    expect(start).toHaveBeenCalledTimes(1)
    expect(start.mock.calls[0].slice(1)).toEqual([woodSprite.complete.offset, woodSprite.complete.duration])
    now += 100
    engine.playInterfaceSound()
    await flush()
    expect(start).toHaveBeenCalledTimes(1)
    now += 300
    engine.playInterfaceSound()
    await flush()
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('does not surface unavailable audio or failed asset requests to the user action', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    expect(() => engine.playInteractionSound('create')).not.toThrow()
    await flush()
    expect(start).not.toHaveBeenCalled()
    vi.stubGlobal('AudioContext', undefined)
    vi.resetModules()
    const unsupported = await import('./interactionSounds')
    expect(() => unsupported.playInteractionSound('create')).not.toThrow()
    await flush()
  })

  it('persists valid settings and applies another tab’s mute without producing a sound', async () => {
    cleanup = engine.installInteractionSounds()
    prefs.setSoundPreferences({ theme: 'soft', volume: 0.3 })
    expect(JSON.parse(localStorage.getItem(prefs.SOUND_PREFERENCES_KEY)!)).toMatchObject({ theme: 'soft', volume: 0.3 })
    localStorage.setItem(prefs.SOUND_PREFERENCES_KEY, JSON.stringify({ enabled: false, theme: 'grain', volume: 0.4 }))
    window.dispatchEvent(new StorageEvent('storage', { key: prefs.SOUND_PREFERENCES_KEY }))
    engine.playInteractionSound('finish')
    await flush()
    expect(prefs.getSoundPreferences().enabled).toBe(false)
    expect(start).not.toHaveBeenCalled()
    expect(prefs.sanitizeSoundPreferences({ theme: 'invalid', volume: NaN })).toEqual(prefs.SOUND_DEFAULTS)
  })
})
