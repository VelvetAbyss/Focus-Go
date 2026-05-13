export type DiscoveryNewTargetKind = 'nav' | 'tab' | 'panel' | 'card'

export type DiscoveryNewTargetDef = {
  readonly id: string
  readonly kind: DiscoveryNewTargetKind
}

export const DISCOVERY_NEW_TARGETS = {
  'nav-labs': { id: 'nav-labs', kind: 'nav' },
  'nav-kb': { id: 'nav-kb', kind: 'nav' },
  'nav-trips': { id: 'nav-trips', kind: 'nav' },
  'nav-habits': { id: 'nav-habits', kind: 'nav' },
  'nav-projects': { id: 'nav-projects', kind: 'nav' },
  'nav-premium': { id: 'nav-premium', kind: 'nav' },
  'dashboard-life-tab': { id: 'dashboard-life-tab', kind: 'tab' },
  'dashboard-news-tab': { id: 'dashboard-news-tab', kind: 'tab' },
  'tasks-analytics-tab': { id: 'tasks-analytics-tab', kind: 'tab' },
  'notes-info-panel': { id: 'notes-info-panel', kind: 'panel' },
  'notes-appearance-panel': { id: 'notes-appearance-panel', kind: 'panel' },
  'notes-export-panel': { id: 'notes-export-panel', kind: 'panel' },
  'notes-import-panel': { id: 'notes-import-panel', kind: 'panel' },
  'card-world-clock': { id: 'card-world-clock', kind: 'card' },
  'card-stocks': { id: 'card-stocks', kind: 'card' },
  'card-trips': { id: 'card-trips', kind: 'card' },
  'card-subscriptions': { id: 'card-subscriptions', kind: 'card' },
} as const satisfies Record<string, DiscoveryNewTargetDef>

export type DiscoveryNewTargetId = keyof typeof DISCOVERY_NEW_TARGETS

export const SIDEBAR_DISCOVERY_TARGET_BY_ITEM_ID: Partial<Record<string, DiscoveryNewTargetId>> = {
  'route:labs': 'nav-labs',
  'route:note': 'nav-kb',
  'route:trips': 'nav-trips',
  'route:membership': 'nav-premium',
  'route:projects': 'nav-projects',
  'route:habits': 'nav-habits',
  'feature:habit-tracker': 'nav-habits',
  'feature:project-workspace': 'nav-projects',
}

export const DASHBOARD_CARD_DISCOVERY_TARGET_BY_ID: Partial<Record<string, DiscoveryNewTargetId>> = {
  world_clock: 'card-world-clock',
}

export const LIFE_CARD_DISCOVERY_TARGET_BY_ID: Partial<Record<string, DiscoveryNewTargetId>> = {
  stocks: 'card-stocks',
  trips_card: 'card-trips',
  subscriptions_card: 'card-subscriptions',
}
