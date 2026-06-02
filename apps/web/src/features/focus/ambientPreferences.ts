import { useSyncExternalStore } from 'react'

export type AmbientFrameRate = 24 | 30 | 60

export type RainyCafeEffects = {
  condensationDrops: boolean
  steamFog: boolean
  passerbySilhouettes: boolean
}

export type StormyNightEffects = {
  lightningFlashOnRain: boolean
  thunderShake: boolean
  afterFlashPurple: boolean
  wetGroundReflection: boolean
}

export type OceanBreezeEffects = {
  parallaxLayers: boolean
  surfaceCaustics: boolean
  sunMoonHighlight: boolean
}

export type CozyFiresideEffects = {
  globalWarmFlicker: boolean
  logSilhouette: boolean
  smokeWisps: boolean
  crackleSparkSync: boolean
}

export type IdleEffects = {
  timeOfDayPalette: boolean
  slowBreath: boolean
}

export type AmbientPreferences = {
  /** 0..1 — surface opacity over the scene. Lower = scene shows through more. */
  surfaceOpacity: number
  /** 0..40px — frosted-glass backdrop-filter blur. */
  glassBlur: number
  /** Canvas FPS cap. 24 = cinematic, 30 = default, 60 = max smoothness. */
  frameRate: AmbientFrameRate

  // Global cross-scene behaviours
  audioReactivity: boolean
  intensityRamp: boolean
  cursorReactivity: boolean
  sessionVariation: boolean

  // Per-scene effect toggles
  effects: {
    rainyCafe: RainyCafeEffects
    stormyNight: StormyNightEffects
    oceanBreeze: OceanBreezeEffects
    cozyFireside: CozyFiresideEffects
    idle: IdleEffects
  }
}

const STORAGE_KEY = 'focusgo.ambient.prefs.v2'
const LEGACY_KEY = 'focusgo.ambient.prefs.v1'

export const AMBIENT_PREFERENCES_DEFAULTS: AmbientPreferences = {
  surfaceOpacity: 0.78,
  glassBlur: 22,
  frameRate: 30,
  audioReactivity: true,
  intensityRamp: true,
  cursorReactivity: true,
  sessionVariation: true,
  effects: {
    rainyCafe: {
      condensationDrops: true,
      steamFog: false,
      passerbySilhouettes: false,
    },
    stormyNight: {
      lightningFlashOnRain: true,
      thunderShake: true,
      afterFlashPurple: true,
      wetGroundReflection: false,
    },
    oceanBreeze: {
      parallaxLayers: true,
      surfaceCaustics: false,
      sunMoonHighlight: true,
    },
    cozyFireside: {
      globalWarmFlicker: true,
      logSilhouette: true,
      smokeWisps: false,
      crackleSparkSync: true,
    },
    idle: {
      timeOfDayPalette: true,
      slowBreath: true,
    },
  },
}

const ALLOWED_FRAME_RATES: readonly AmbientFrameRate[] = [24, 30, 60]

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const sanitizeBoolean = (raw: unknown, fallback: boolean): boolean =>
  typeof raw === 'boolean' ? raw : fallback

const mergeEffects = <T extends Record<string, boolean>>(raw: unknown, fallback: T): T => {
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const out = { ...fallback }
  for (const key of Object.keys(fallback) as Array<keyof T>) {
    const value = (raw as Record<string, unknown>)[key as string]
    if (typeof value === 'boolean') out[key] = value as T[keyof T]
  }
  return out
}

const sanitize = (raw: unknown): AmbientPreferences => {
  if (!raw || typeof raw !== 'object') return { ...AMBIENT_PREFERENCES_DEFAULTS }
  const r = raw as Partial<Record<keyof AmbientPreferences, unknown>>
  const next: AmbientPreferences = {
    ...AMBIENT_PREFERENCES_DEFAULTS,
    effects: {
      rainyCafe: { ...AMBIENT_PREFERENCES_DEFAULTS.effects.rainyCafe },
      stormyNight: { ...AMBIENT_PREFERENCES_DEFAULTS.effects.stormyNight },
      oceanBreeze: { ...AMBIENT_PREFERENCES_DEFAULTS.effects.oceanBreeze },
      cozyFireside: { ...AMBIENT_PREFERENCES_DEFAULTS.effects.cozyFireside },
      idle: { ...AMBIENT_PREFERENCES_DEFAULTS.effects.idle },
    },
  }

  if (typeof r.surfaceOpacity === 'number' && Number.isFinite(r.surfaceOpacity)) {
    next.surfaceOpacity = clamp(r.surfaceOpacity, 0, 1)
  }
  if (typeof r.glassBlur === 'number' && Number.isFinite(r.glassBlur)) {
    next.glassBlur = clamp(r.glassBlur, 0, 40)
  }
  if (ALLOWED_FRAME_RATES.includes(r.frameRate as AmbientFrameRate)) {
    next.frameRate = r.frameRate as AmbientFrameRate
  }

  next.audioReactivity = sanitizeBoolean(r.audioReactivity, next.audioReactivity)
  next.intensityRamp = sanitizeBoolean(r.intensityRamp, next.intensityRamp)
  next.cursorReactivity = sanitizeBoolean(r.cursorReactivity, next.cursorReactivity)
  next.sessionVariation = sanitizeBoolean(r.sessionVariation, next.sessionVariation)

  const rawEffects = r.effects as Partial<AmbientPreferences['effects']> | undefined
  if (rawEffects) {
    next.effects.rainyCafe = mergeEffects(rawEffects.rainyCafe, next.effects.rainyCafe)
    next.effects.stormyNight = mergeEffects(rawEffects.stormyNight, next.effects.stormyNight)
    next.effects.oceanBreeze = mergeEffects(rawEffects.oceanBreeze, next.effects.oceanBreeze)
    next.effects.cozyFireside = mergeEffects(rawEffects.cozyFireside, next.effects.cozyFireside)
    next.effects.idle = mergeEffects(rawEffects.idle, next.effects.idle)
  }

  return next
}

const read = (): AmbientPreferences => {
  if (typeof window === 'undefined') return { ...AMBIENT_PREFERENCES_DEFAULTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return sanitize(JSON.parse(raw))
    // Migrate v1 — only had surfaceOpacity + glassBlur.
    const legacy = window.localStorage.getItem(LEGACY_KEY)
    if (legacy) return sanitize(JSON.parse(legacy))
    return { ...AMBIENT_PREFERENCES_DEFAULTS }
  } catch {
    return { ...AMBIENT_PREFERENCES_DEFAULTS }
  }
}

let current: AmbientPreferences = read()
const listeners = new Set<() => void>()

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // listeners must not break the store
    }
  })
}

const writeStorage = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // quota / private mode — silently ignore
  }
}

const applyToDocument = () => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--ambient-surface-opacity', String(current.surfaceOpacity))
  root.style.setProperty('--ambient-surface-mix-pct', `${Math.round(current.surfaceOpacity * 100)}%`)
  root.style.setProperty('--ambient-blur', `${current.glassBlur}px`)
}

applyToDocument()

export const getAmbientPreferences = (): AmbientPreferences => current

type AmbientPreferencesPatch = Omit<Partial<AmbientPreferences>, 'effects'> & {
  effects?: {
    rainyCafe?: Partial<RainyCafeEffects>
    stormyNight?: Partial<StormyNightEffects>
    oceanBreeze?: Partial<OceanBreezeEffects>
    cozyFireside?: Partial<CozyFiresideEffects>
    idle?: Partial<IdleEffects>
  }
}

export const setAmbientPreferences = (patch: AmbientPreferencesPatch) => {
  // Shallow merge with sanitization — effects subtree needs special handling.
  const merged: AmbientPreferences = {
    ...current,
    ...patch,
    effects: patch.effects
      ? {
          rainyCafe: { ...current.effects.rainyCafe, ...patch.effects.rainyCafe },
          stormyNight: { ...current.effects.stormyNight, ...patch.effects.stormyNight },
          oceanBreeze: { ...current.effects.oceanBreeze, ...patch.effects.oceanBreeze },
          cozyFireside: { ...current.effects.cozyFireside, ...patch.effects.cozyFireside },
          idle: { ...current.effects.idle, ...patch.effects.idle },
        }
      : current.effects,
  }
  const next = sanitize(merged)
  if (JSON.stringify(next) === JSON.stringify(current)) return
  current = next
  applyToDocument()
  writeStorage()
  notify()
}

export const setSceneEffect = <S extends keyof AmbientPreferences['effects']>(
  scene: S,
  patch: Partial<AmbientPreferences['effects'][S]>,
) => {
  setAmbientPreferences({ effects: { [scene]: patch } } as AmbientPreferencesPatch)
}

export const resetAmbientPreferences = () => {
  current = { ...AMBIENT_PREFERENCES_DEFAULTS, effects: structuredClone(AMBIENT_PREFERENCES_DEFAULTS.effects) }
  applyToDocument()
  writeStorage()
  notify()
}

export const subscribeAmbientPreferences = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const snapshotForServer = (): AmbientPreferences => AMBIENT_PREFERENCES_DEFAULTS

export const useAmbientPreferences = (): AmbientPreferences =>
  useSyncExternalStore(subscribeAmbientPreferences, getAmbientPreferences, snapshotForServer)
