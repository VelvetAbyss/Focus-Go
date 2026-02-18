import type { DashboardLayoutItem } from './models/types'

export const DEFAULT_DASHBOARD_LAYOUT_ITEMS: DashboardLayoutItem[] = [
  { key: 'tasks', x: 3, y: 0, w: 6, h: 9 },
  { key: 'focus', x: 9, y: 3, w: 3, h: 4 },
  { key: 'spend', x: 0, y: 5, w: 3, h: 4 },
  { key: 'weather', x: 9, y: 0, w: 3, h: 3 },
  { key: 'widget-todos', x: 0, y: 0, w: 3, h: 5 },
  { key: 'diary', x: 9, y: 7, w: 3, h: 2 },
]

export const DEFAULT_DASHBOARD_HIDDEN_CARD_IDS: string[] = []
export const DEFAULT_DASHBOARD_THEME_OVERRIDE = 'light' as const
