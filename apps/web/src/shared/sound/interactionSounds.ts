import woodUrl from './assets/wood.wav?url'
import grainUrl from './assets/grain.wav?url'
import softUrl from './assets/soft.wav?url'
import sprite from './assets/sprite.json'
import woodSprite from './assets/wood-sprite.json'
import {
  getSoundPreferences, refreshSoundPreferences, SOUND_PREFERENCES_KEY,
  subscribeSoundPreferences, type SoundTheme,
} from './soundPreferences'

export type InteractionSound = 'tap' | Exclude<keyof typeof sprite, `tap-${number}`>
const urls = { wood: woodUrl, grain: grainUrl, soft: softUrl }
const sprites: Record<SoundTheme, Record<string, { offset: number; duration: number }>> = {
  wood: woodSprite, grain: sprite, soft: sprite,
}
const woodTapKeys = Object.keys(woodSprite).filter((key) => key.startsWith('tap-'))
let woodTapBag: string[] = []
let lastWoodTap: string | undefined
const files = new Map<SoundTheme, Promise<ArrayBuffer>>()
const buffers = new Map<SoundTheme, Promise<AudioBuffer>>()
const retryAfter = new Map<SoundTheme, number>()
let context: AudioContext | undefined
let master: GainNode | undefined
let generation = 0
let request = 0
let lastPlayedAt = -Infinity
let lastSubtleAt = -Infinity
let tapVariant = 0
type Voice = { source: AudioBufferSourceNode; gain: GainNode }
const voices = new Set<Voice>()

const nextWoodTap = () => {
  if (woodTapBag.length === 0) {
    woodTapBag = [...woodTapKeys]
    for (let i = woodTapBag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[woodTapBag[i], woodTapBag[j]] = [woodTapBag[j], woodTapBag[i]]
    }
    if (woodTapBag.at(-1) === lastWoodTap) {
      const last = woodTapBag.length - 1
      ;[woodTapBag[0], woodTapBag[last]] = [woodTapBag[last], woodTapBag[0]]
    }
  }
  return woodTapBag.pop()!
}

const loadFile = (theme: SoundTheme) => {
  let pending = files.get(theme)
  if (!pending) {
    if (performance.now() < (retryAfter.get(theme) ?? 0)) return Promise.reject(new Error('Sound retry deferred'))
    pending = fetch(urls[theme]).then((response) => {
      if (!response.ok) throw new Error('Sound unavailable')
      return response.arrayBuffer()
    }).catch((error: unknown) => {
      files.delete(theme)
      retryAfter.set(theme, performance.now() + 10_000)
      throw error
    })
    files.set(theme, pending)
  }
  return pending
}

const loadBuffer = (theme: SoundTheme, audio: AudioContext) => {
  let pending = buffers.get(theme)
  if (!pending) {
    if (performance.now() < (retryAfter.get(theme) ?? 0)) return Promise.reject(new Error('Sound retry deferred'))
    pending = loadFile(theme).then((file) => audio.decodeAudioData(file.slice(0)))
      .catch((error: unknown) => {
        buffers.delete(theme)
        retryAfter.set(theme, performance.now() + 10_000)
        throw error
      })
    buffers.set(theme, pending)
  }
  return pending
}

// Called within the original pointer/key gesture, before any local persistence awaits.
export const prepareInteractionAudio = () => {
  try {
    const prefs = getSoundPreferences()
    if (!prefs.enabled || prefs.volume === 0) return
    if (context?.state === 'closed') {
      stopInteractionSounds()
      context = undefined
      buffers.clear()
    }
    if (!context) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = prefs.volume * 0.72
      master.connect(context.destination)
    }
    const ready = context.state !== 'running' ? context.resume().catch(() => {}) : Promise.resolve()
    void loadBuffer(prefs.theme, context).catch(() => {})
    return ready
  } catch { /* Audio is optional; unsupported devices keep working silently. */ }
}

const endVoice = (voice: Voice) => {
  voices.delete(voice)
  if (!context) return
  try {
    voice.gain.gain.cancelScheduledValues(context.currentTime)
    voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.002)
    voice.source.stop(context.currentTime + 0.012)
  } catch { /* An already ended voice needs no cleanup. */ }
}

export const stopInteractionSounds = () => {
  generation += 1
  voices.forEach(endVoice)
}

/** Fire-and-forget: never await audio from a task, timer, or settings mutation. */
export const playInteractionSound = (event: InteractionSound, { subtle = false }: { subtle?: boolean } = {}) => {
  const prefs = getSoundPreferences()
  if (!prefs.enabled || prefs.volume === 0) return
  if (typeof document === 'undefined' || (document.hidden && event !== 'finish')) return
  const now = performance.now()
  if (subtle) {
    // Routine navigation never masks a pending task/timer acknowledgement.
    if (now - lastSubtleAt < 100 || now - lastPlayedAt < 300) return
    lastSubtleAt = now
  } else {
    if (event !== 'finish' && now - lastPlayedAt < 75) return
    lastPlayedAt = now
  }
  const token = ++request
  const ready = prepareInteractionAudio()
  const epoch = generation
  const audio = context
  if (!audio || !master) return
  void Promise.all([loadBuffer(prefs.theme, audio), ready]).then(([buffer]) => {
    const current = getSoundPreferences()
    // Drop stale feedback rather than replaying a queue after download, unlock, or theme change.
    if (token !== request || epoch !== generation || audio.state !== 'running' ||
        !current.enabled || current.volume === 0 || current.theme !== prefs.theme ||
        performance.now() - now > 300 || (document.hidden && event !== 'finish')) return
    if (event === 'finish') voices.forEach(endVoice)
    while (voices.size >= 3) endVoice(voices.values().next().value!)
    const source = audio.createBufferSource()
    const gain = audio.createGain()
    source.buffer = buffer
    // A small voice budget keeps rapid actions from becoming louder than an isolated gesture.
    gain.gain.value = (subtle ? 0.55 : 1) / Math.sqrt(voices.size + 1)
    source.connect(gain)
    gain.connect(master!)
    const voice = { source, gain }
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect() }
    voices.add(voice)
    // Pick only after readiness/cancellation guards, so discarded requests do not consume variants.
    const key = event !== 'tap' ? event : prefs.theme === 'wood' ? nextWoodTap() : `tap-${tapVariant++ % 3}`
    const clip = sprites[prefs.theme][key]
    source.start(audio.currentTime, clip.offset, clip.duration)
    if (prefs.theme === 'wood' && event === 'tap') lastWoodTap = key
  }).catch(() => { /* A failed fetch/decode/play must never affect the original interaction. */ })
}

/** Quieter feedback for tabs, navigation, selectors, and disclosure controls. */
export const playInterfaceSound = (event: 'tap' | 'on' | 'off' = 'tap') =>
  playInteractionSound(event, { subtle: true })

export const playTaskStatusSound = (previous: string, next: string) => {
  if (previous === next) return
  playInteractionSound(next === 'done' ? 'complete' : previous === 'done' ? 'undo' : 'place')
}

/** One shell listener; loading files never starts playback. StrictMode cleanup is safe. */
export const installInteractionSounds = () => {
  let previous = getSoundPreferences()
  const sync = () => {
    const next = getSoundPreferences()
    if (!next.enabled || next.volume === 0 || next.theme !== previous.theme) stopInteractionSounds()
    if (master && context) master.gain.setTargetAtTime(next.volume * 0.72, context.currentTime, 0.01)
    if (next.enabled && next.volume > 0) void loadFile(next.theme).catch(() => {})
    previous = next
  }
  const gesture = () => prepareInteractionAudio()
  const storage = (event: StorageEvent) => {
    if (event.key === SOUND_PREFERENCES_KEY || event.key === null) refreshSoundPreferences()
  }
  const hide = () => { if (document.hidden) stopInteractionSounds() }
  const unsubscribe = subscribeSoundPreferences(sync)
  window.addEventListener('pointerdown', gesture, { capture: true, passive: true })
  window.addEventListener('keydown', gesture, { capture: true, passive: true })
  window.addEventListener('storage', storage)
  document.addEventListener('visibilitychange', hide)
  sync()
  return () => {
    unsubscribe()
    window.removeEventListener('pointerdown', gesture, true)
    window.removeEventListener('keydown', gesture, true)
    window.removeEventListener('storage', storage)
    document.removeEventListener('visibilitychange', hide)
    stopInteractionSounds()
  }
}
