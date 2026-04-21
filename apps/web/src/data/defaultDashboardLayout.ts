import type { DashboardLayoutItem } from './models/types'

export const DEFAULT_DASHBOARD_LAYOUT_ITEMS: DashboardLayoutItem[] = [
  { key: 'tasks', x: 3, y: 2, w: 6, h: 10 },
  { key: 'focus', x: 0, y: 0, w: 3, h: 5 },
  { key: 'widget-todos', x: 9, y: 18, w: 3, h: 7 },
  { key: 'weather', x: 9, y: 14, w: 3, h: 3 },
  { key: 'world_clock', x: 0, y: 24, w: 3, h: 5 },
]

export const DEFAULT_DASHBOARD_HIDDEN_CARD_IDS: string[] = ['spend']
export const DEFAULT_DASHBOARD_THEME_OVERRIDE = 'light' as const
