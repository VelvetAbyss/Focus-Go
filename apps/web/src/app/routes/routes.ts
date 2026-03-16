export const ROUTES = {
  DASHBOARD: '/',
  HABITS: '/habits',
  TASKS: '/tasks',
  NOTE: '/note',
  CALENDAR: '/calendar',
  FOCUS: '/focus',
  REVIEW: '/review',
  SETTINGS: '/workspace/settings',
  LABS: '/labs',
} as const

export const LEGACY_ROUTES = {
  KNOWLEDGE: '/knowledge',
} as const

export type RouteKey = 'dashboard' | 'tasks' | 'note' | 'calendar' | 'focus' | 'review' | 'settings' | 'labs'

export type NavItem = {
  key: RouteKey
  label: string
  to: (typeof ROUTES)[keyof typeof ROUTES] | string
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.DASHBOARD },
  { key: 'tasks', label: 'Tasks', to: ROUTES.TASKS },
  { key: 'note', label: 'Note', to: ROUTES.NOTE },
  { key: 'calendar', label: 'Calendar', to: ROUTES.CALENDAR },
  { key: 'focus', label: 'Focus', to: ROUTES.FOCUS },
  { key: 'review', label: 'Review', to: ROUTES.REVIEW },
  { key: 'settings', label: 'Settings', to: ROUTES.SETTINGS },
]

export const BASE_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.DASHBOARD },
  { key: 'tasks', label: 'Tasks', to: ROUTES.TASKS },
  { key: 'note', label: 'Note', to: ROUTES.NOTE },
  { key: 'calendar', label: 'Calendar', to: ROUTES.CALENDAR },
  { key: 'focus', label: 'Focus', to: ROUTES.FOCUS },
  { key: 'review', label: 'Review', to: ROUTES.REVIEW },
  { key: 'settings', label: 'Settings', to: ROUTES.SETTINGS },
]
