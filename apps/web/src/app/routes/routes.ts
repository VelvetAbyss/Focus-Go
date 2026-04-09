export const ROUTES = {
  DASHBOARD: '/',
  HABITS: '/habits',
  TASKS: '/tasks',
  NOTE: '/note',
  CALENDAR: '/calendar',
  TRIPS: '/trips',
  TRIP_DETAIL: '/trips/:tripId',
  FOCUS: '/focus',
  REVIEW: '/review',
  DIARY: '/diary',
  SETTINGS: '/workspace/settings',
  SETTINGS_LEGAL_PRIVACY: '/workspace/settings/legal/privacy-policy',
  SETTINGS_LEGAL_TERMS: '/workspace/settings/legal/terms-of-service',
  LABS: '/labs',
  PREMIUM: '/premium',
  PREMIUM_SUCCESS: '/premium/success',
} as const

export const buildTripDetailRoute = (tripId: string) => `${ROUTES.TRIPS}/${tripId}`

export const LEGACY_ROUTES = {
  KNOWLEDGE: '/knowledge',
} as const

export type RouteKey = 'dashboard' | 'tasks' | 'note' | 'calendar' | 'trips' | 'focus' | 'diary' | 'settings' | 'labs'

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
  { key: 'trips', label: 'Trips', to: ROUTES.TRIPS },
  { key: 'focus', label: 'Focus', to: ROUTES.FOCUS },
  { key: 'diary', label: 'Diary', to: ROUTES.DIARY },
  { key: 'settings', label: 'Settings', to: ROUTES.SETTINGS },
]

export const BASE_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.DASHBOARD },
  { key: 'tasks', label: 'Tasks', to: ROUTES.TASKS },
  { key: 'note', label: 'Note', to: ROUTES.NOTE },
  { key: 'calendar', label: 'Calendar', to: ROUTES.CALENDAR },
  { key: 'trips', label: 'Trips', to: ROUTES.TRIPS },
  { key: 'focus', label: 'Focus', to: ROUTES.FOCUS },
  { key: 'diary', label: 'Diary', to: ROUTES.DIARY },
  { key: 'settings', label: 'Settings', to: ROUTES.SETTINGS },
]
