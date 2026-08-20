export type PremiumGateKey =
  | 'dashboard.custom-layout'
  | 'dashboard.extra-widgets'
  | 'tasks.subtasks'
  | 'notes.max-count'
  | 'focus.white-noise'
  | 'project.workspace'
  | 'system.cloud-sync'

export type GateCheckResult = {
  allowed: boolean
  reason: 'premium_required' | 'limit_reached' | null
}

export type GateSource = 'button' | 'route' | 'create-action' | 'limit-reached'

export type PremiumGateDefinition = {
  key: PremiumGateKey
  kind: 'feature' | 'limit'
  title: string
  description: string
  limit?: number
}

export const PREMIUM_GATES: Record<PremiumGateKey, PremiumGateDefinition> = {
  'dashboard.custom-layout': {
    key: 'dashboard.custom-layout',
    kind: 'feature',
    title: 'Custom dashboard layout',
    description: 'Unlock layout editing and dashboard personalization.',
  },
  'dashboard.extra-widgets': {
    key: 'dashboard.extra-widgets',
    kind: 'feature',
    title: 'More dashboard widgets',
    description: 'Unlock widget management and future premium widgets.',
  },
  'tasks.subtasks': {
    key: 'tasks.subtasks',
    kind: 'feature',
    title: 'Task subtasks',
    description: 'Break tasks into smaller checklist items.',
  },
  'notes.max-count': {
    key: 'notes.max-count',
    kind: 'limit',
    title: 'Unlimited notes',
    description: 'Free plan includes up to 20 notes.',
    limit: 20,
  },
  'focus.white-noise': {
    key: 'focus.white-noise',
    kind: 'feature',
    title: 'White noise',
    description: 'Play ambient sound while focusing.',
  },
  'project.workspace': {
    key: 'project.workspace',
    kind: 'feature',
    title: 'Project workspace',
    description: 'Unlock the project workspace for large goals, timelines, people, and notes.',
  },
  'system.cloud-sync': {
    key: 'system.cloud-sync',
    kind: 'feature',
    title: 'Cloud sync',
    description: 'Sync your workspace across devices.',
  },
}

export const canUsePremiumFeature = (
  gateKey: PremiumGateKey,
  payload: { isPremium: boolean; noteCount?: number },
): GateCheckResult => {
  void gateKey
  void payload
  return { allowed: true, reason: null }
}
