export type ModuleGuideKey = 'dashboard' | 'tasks' | 'focus' | 'diary' | 'calendar' | 'habits' | 'notes'

export type ModuleGuideState = {
  seen: boolean
  completed: boolean
  lastShownAt?: number
}

export type ModuleGuideRuntimeState = {
  modules: Record<ModuleGuideKey, ModuleGuideState>
}

export const MODULE_GUIDE_KEYS: ModuleGuideKey[] = [
  'dashboard',
  'tasks',
  'focus',
  'diary',
  'calendar',
  'habits',
  'notes',
]
