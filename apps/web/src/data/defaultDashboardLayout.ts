import type { DashboardLayoutItem } from './models/types'

// Bump this number to mark stored layouts as stale; all clients will re-seed
// from the constants below on the next load.
export const CURRENT_DASHBOARD_LAYOUT_VERSION = 1

export const DEFAULT_DASHBOARD_LAYOUT_ITEMS: DashboardLayoutItem[] = [
  { key: 'task-progress-summary', x: 0, y: 0, w: 3, h: 5 },
  { key: 'tasks', x: 3, y: 0, w: 6, h: 10 },
  { key: 'weather', x: 9, y: 0, w: 3, h: 3 },
  { key: 'widget-todos', x: 9, y: 3, w: 3, h: 7 },
  { key: 'world_clock', x: 0, y: 5, w: 3, h: 5 },
]

export const DEFAULT_DASHBOARD_HIDDEN_CARD_IDS: string[] = ['spend']
export const DEFAULT_DASHBOARD_THEME_OVERRIDE = 'light' as const
