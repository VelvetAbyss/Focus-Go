import { useSyncExternalStore } from 'react'

export type AmbientPreferences = {
  /** 0..1 — how much of the underlying scene shows through the dashboard surface.
   * Implemented as the opacity of the surface fill: lower = more scene visible. */
  surfaceOpacity: number
  /** 0..40px — strength of backdrop-filter blur on the active-scene chrome. */
  glassBlur: number
}

const STORAGE_KEY = 'focusgo.ambient.prefs.v1'

const DEFAULTS: AmbientPreferences = {
  surfaceOpacity: 0.78,
  glassBlur: 22,
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const sanitize = (raw: unknown): AmbientPreferences => {
  if (!raw || typeof raw !== 'object') return DEFAULTS
  const next: AmbientPreferences = { ...DEFAULTS }
  const r = raw as Partial<Record<keyof AmbientPreferences, unknown>>
  if (typeof r.surfaceOpacity === 'number' && Number.isFinite(r.surfaceOpacity)) {
    next.surfaceOpacity = clamp(r.surfaceOpacity, 0, 1)
  }
  if (typeof r.glassBlur === 'number' && Number.isFinite(r.glassBlur)) {
    next.glassBlur = clamp(r.glassBlur, 0, 40)
  }
  return next
}

const read = (): AmbientPreferences => {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return sanitize(JSON.parse(raw))
  } catch {
    return DEFAULTS
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

// Eagerly mirror initial prefs to CSS so first paint matches stored values.
applyToDocument()

export const getAmbientPreferences = (): AmbientPreferences => current

export const setAmbientPreferences = (patch: Partial<AmbientPreferences>) => {
  const next = sanitize({ ...current, ...patch })
  const changed =
    next.surfaceOpacity !== current.surfaceOpacity || next.glassBlur !== current.glassBlur
  if (!changed) return
  current = next
  applyToDocument()
  writeStorage()
  notify()
}

export const resetAmbientPreferences = () => {
  setAmbientPreferences(DEFAULTS)
}

export const subscribeAmbientPreferences = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const snapshotForServer = (): AmbientPreferences => DEFAULTS

export const useAmbientPreferences = (): AmbientPreferences =>
  useSyncExternalStore(subscribeAmbientPreferences, getAmbientPreferences, snapshotForServer)

export const AMBIENT_PREFERENCES_DEFAULTS = DEFAULTS
