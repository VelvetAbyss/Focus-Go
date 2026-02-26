export const ROUTES = {
  DASHBOARD: '/',
  RSS: '/rss',
  HABITS: '/habits',
  TASKS: '/tasks',
  CALENDAR: '/calendar',
  FOCUS: '/focus',
  NOTES: '/note',
  REVIEW: '/review',
  SETTINGS: '/workspace/settings',
  LABS: '/labs',
} as const

export const LEGACY_ROUTES = {
  KNOWLEDGE: '/knowledge',
} as const

export type RouteKey = 'dashboard' | 'rss' | 'tasks' | 'calendar' | 'focus' | 'notes' | 'review' | 'settings' | 'labs'

export type NavItem = {
  key: RouteKey
  label: string
  to: (typeof ROUTES)[keyof typeof ROUTES] | string
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.DASHBOARD },
  { key: 'rss', label: 'RSS', to: ROUTES.RSS },
  { key: 'tasks', label: 'Tasks', to: ROUTES.TASKS },
  { key: 'calendar', label: 'Calendar', to: ROUTES.CALENDAR },
  { key: 'focus', label: 'Focus', to: ROUTES.FOCUS },
  { key: 'notes', label: 'Notes', to: ROUTES.NOTES },
  { key: 'review', label: 'Review', to: ROUTES.REVIEW },
  { key: 'settings', label: 'Settings', to: ROUTES.SETTINGS },
]

export const BASE_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.DASHBOARD },
  { key: 'tasks', label: 'Tasks', to: ROUTES.TASKS },
  { key: 'calendar', label: 'Calendar', to: ROUTES.CALENDAR },
  { key: 'focus', label: 'Focus', to: ROUTES.FOCUS },
  { key: 'notes', label: 'Notes', to: ROUTES.NOTES },
  { key: 'review', label: 'Review', to: ROUTES.REVIEW },
  { key: 'settings', label: 'Settings', to: ROUTES.SETTINGS },
]
