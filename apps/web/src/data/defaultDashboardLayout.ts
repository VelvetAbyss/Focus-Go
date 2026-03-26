import type { DashboardLayoutItem } from './models/types'

export const DEFAULT_DASHBOARD_LAYOUT_ITEMS: DashboardLayoutItem[] = [
  { key: 'tasks', x: 3, y: 0, w: 6, h: 9 },
  { key: 'focus', x: 0, y: 0, w: 3, h: 6 },
  { key: 'weather', x: 9, y: 0, w: 3, h: 3 },
  { key: 'widget-todos', x: 9, y: 3, w: 3, h: 6 },
  { key: 'diary', x: 0, y: 6, w: 3, h: 3 },
]

export const DEFAULT_DASHBOARD_HIDDEN_CARD_IDS: string[] = ['spend']
export const DEFAULT_DASHBOARD_THEME_OVERRIDE = 'light' as const
