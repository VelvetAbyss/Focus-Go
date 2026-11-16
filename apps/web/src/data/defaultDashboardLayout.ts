import type { DashboardLayoutItem } from './models/types'

// Bump this number to mark stored layouts as stale; all clients will re-seed
// from the constants below on the next load.
export const CURRENT_DASHBOARD_LAYOUT_VERSION = 1

export const DEFAULT_DASHBOARD_LAYOUT_ITEMS: DashboardLayoutItem[] = [
  { key: 'tasks', x: 0, y: 0, w: 8, h: 8 },
  { key: 'weather', x: 8, y: 0, w: 4, h: 3 },
  { key: 'world_clock', x: 8, y: 3, w: 4, h: 5 },
  { key: 'widget-todos', x: 8, y: 8, w: 4, h: 5 },
  { key: 'task-progress-summary', x: 0, y: 8, w: 8, h: 5 },
]

export const DEFAULT_DASHBOARD_HIDDEN_CARD_IDS: string[] = ['spend']
export const DEFAULT_DASHBOARD_THEME_OVERRIDE = 'light' as const
