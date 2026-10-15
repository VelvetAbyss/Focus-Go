export type SoundTheme = 'wood' | 'grain' | 'soft'
export type SoundPreferences = { enabled: boolean; theme: SoundTheme; volume: number }

// Listening level belongs to this device, independently of ambient music and synced preferences.
export const SOUND_PREFERENCES_KEY = 'focusgo.interaction-sounds.v1'
export const SOUND_DEFAULTS: SoundPreferences = { enabled: true, theme: 'wood', volume: 0.45 }

export const sanitizeSoundPreferences = (raw: unknown): SoundPreferences => {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<SoundPreferences>
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : SOUND_DEFAULTS.enabled,
    theme: value.theme === 'wood' || value.theme === 'grain' || value.theme === 'soft' ? value.theme : SOUND_DEFAULTS.theme,
    volume: typeof value.volume === 'number' && Number.isFinite(value.volume)
      ? Math.max(0, Math.min(1, value.volume)) : SOUND_DEFAULTS.volume,
  }
}

const read = (): SoundPreferences => {
  try { return sanitizeSoundPreferences(JSON.parse(localStorage.getItem(SOUND_PREFERENCES_KEY) ?? 'null')) }
  catch { return { ...SOUND_DEFAULTS } }
}

let current = read()
const listeners = new Set<() => void>()
export const getSoundPreferences = () => current
export const subscribeSoundPreferences = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const publish = (next: SoundPreferences) => {
  if (JSON.stringify(current) === JSON.stringify(next)) return
  current = next
  listeners.forEach((listener) => listener())
}

export const setSoundPreferences = (patch: Partial<SoundPreferences>) => {
  const next = sanitizeSoundPreferences({ ...current, ...patch })
  try { localStorage.setItem(SOUND_PREFERENCES_KEY, JSON.stringify(next)) } catch { /* Private mode: keep session settings. */ }
  publish(next)
}

export const refreshSoundPreferences = () => publish(read())
