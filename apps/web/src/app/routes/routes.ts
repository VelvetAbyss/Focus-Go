export const ROUTES = {
  DASHBOARD: '/',
  RSS: '/rss',
  TASKS: '/tasks',
  CALENDAR: '/calendar',
  FOCUS: '/focus',
  NOTES: '/note',
  REVIEW: '/review',
  SETTINGS: '/workspace/settings',
} as const

export const LEGACY_ROUTES = {
  KNOWLEDGE: '/knowledge',
} as const

export type RouteKey = Lowercase<keyof typeof ROUTES>

export type NavItem = {
  key: RouteKey
  label: string
  to: (typeof ROUTES)[keyof typeof ROUTES]
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
