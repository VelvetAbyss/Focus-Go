import type { ModuleGuideKey, ModuleGuideRuntimeState, ModuleGuideState } from './moduleGuide.types'
import { MODULE_GUIDE_KEYS } from './moduleGuide.types'

// ─── Storage keys ─────────────────────────────────────────────────────────────

const MODULES_KEY = 'focusgo.module-guide'
const SESSION_DISMISSED_KEY = 'focusgo.module-guide.session-dismissed'
export const MODULE_GUIDE_RUNTIME_EVENT = 'focusgo:module-guide-change'

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultModuleState = (): ModuleGuideState => ({
  seen: false,
  completed: false,
})

const defaultRuntimeState = (): ModuleGuideRuntimeState => ({
  modules: Object.fromEntries(MODULE_GUIDE_KEYS.map((k) => [k, defaultModuleState()])) as Record<
    ModuleGuideKey,
    ModuleGuideState
  >,
})

// ─── Cache ────────────────────────────────────────────────────────────────────

let cachedString = ''
let cachedState: ModuleGuideRuntimeState | null = null

// ─── Emit ─────────────────────────────────────────────────────────────────────

const emit = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MODULE_GUIDE_RUNTIME_EVENT))
}

// ─── Low-level storage helpers ────────────────────────────────────────────────

const readModules = (): Record<ModuleGuideKey, ModuleGuideState> => {
  if (typeof window === 'undefined') return defaultRuntimeState().modules
  const raw = window.localStorage.getItem(MODULES_KEY)
  if (!raw) return defaultRuntimeState().modules
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ModuleGuideKey, Partial<ModuleGuideState>>>
    const base = defaultRuntimeState().modules
    for (const key of MODULE_GUIDE_KEYS) {
      const saved = parsed[key]
      if (saved) {
        base[key] = { ...defaultModuleState(), ...saved }
      }
    }
    return base
  } catch {
    return defaultRuntimeState().modules
  }
}

const writeModules = (modules: Record<ModuleGuideKey, ModuleGuideState>) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MODULES_KEY, JSON.stringify(modules))
  cachedState = null
  emit()
}

// ─── Session dismissed ───────────────────────────────────────────────────────

const getSessionDismissed = (): Set<ModuleGuideKey> => {
  if (typeof window === 'undefined') return new Set()
  const raw = window.sessionStorage.getItem(SESSION_DISMISSED_KEY)
  if (!raw) return new Set()
  try {
    return new Set(JSON.parse(raw) as ModuleGuideKey[])
  } catch {
    return new Set()
  }
}

const setSessionDismissed = (keys: Set<ModuleGuideKey>) => {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(SESSION_DISMISSED_KEY, JSON.stringify([...keys]))
}

// ─── Migration from old onboarding state ─────────────────────────────────────

/**
 * If this is the first time the new module guide system runs:
 * - If old onboarding was completed/skipped → mark all modules completed (avoid re-annoying existing users).
 * - Otherwise start fresh.
 *
 * Only runs once per install; after that the MODULES_KEY key exists.
 */
const runMigrationIfNeeded = () => {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(MODULES_KEY) !== null) return // already initialized

  const oldStatus = window.localStorage.getItem('focusgo.onboarding.status')
  if (oldStatus === 'completed' || oldStatus === 'skipped') {
    // Returning user — skip all guides silently
    const modules = defaultRuntimeState().modules
    for (const key of MODULE_GUIDE_KEYS) {
      modules[key] = { seen: true, completed: true }
    }
    window.localStorage.setItem(MODULES_KEY, JSON.stringify(modules))
  }
  // else: new user — leave MODULES_KEY absent so readModules() returns fresh defaults
}

// ─── Public read API ─────────────────────────────────────────────────────────

export const getModuleGuideState = (): ModuleGuideRuntimeState => {
  runMigrationIfNeeded()
  return { modules: readModules() }
}

export const getModuleGuideSnapshot = (): ModuleGuideRuntimeState => {
  const next = getModuleGuideState()
  const nextString = JSON.stringify(next)
  if (cachedState && cachedString === nextString) return cachedState
  cachedString = nextString
  cachedState = next
  return next
}

export const subscribeModuleGuideRuntime = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback()
  window.addEventListener('storage', handler)
  window.addEventListener(MODULE_GUIDE_RUNTIME_EVENT, handler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener(MODULE_GUIDE_RUNTIME_EVENT, handler)
  }
}

// ─── Public write API ────────────────────────────────────────────────────────

/** Should a guide hint be visible right now for this module? */
export const shouldShowModuleGuide = (module: ModuleGuideKey): boolean => {
  const { modules } = getModuleGuideState()
  const state = modules[module]
  if (state.completed) return false
  if (getSessionDismissed().has(module)) return false
  return true
}

/** Mark the module as "seen" (hint was shown) — does NOT complete it. */
export const markModuleGuideSeen = (module: ModuleGuideKey) => {
  const { modules } = getModuleGuideState()
  modules[module] = { ...modules[module], seen: true, lastShownAt: Date.now() }
  writeModules(modules)
}

/** User clicked dismiss — hide for this session, but don't complete. */
export const dismissModuleGuide = (module: ModuleGuideKey) => {
  const dismissed = getSessionDismissed()
  dismissed.add(module)
  setSessionDismissed(dismissed)
  emit()
}

/** User completed the key action — permanently end the guide for this module. */
export const completeModuleGuide = (module: ModuleGuideKey) => {
  const { modules } = getModuleGuideState()
  modules[module] = { ...modules[module], seen: true, completed: true }
  writeModules(modules)
}

/** Mark all modules as completed (e.g. for power-user reset escape hatch). */
export const completeAllModuleGuides = () => {
  const { modules } = getModuleGuideState()
  for (const key of MODULE_GUIDE_KEYS) {
    modules[key] = { seen: true, completed: true }
  }
  writeModules(modules)
}

/** Reset all guides (dev / testing). */
export const resetAllModuleGuides = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(MODULES_KEY)
  window.sessionStorage.removeItem(SESSION_DISMISSED_KEY)
  cachedState = null
  emit()
}
