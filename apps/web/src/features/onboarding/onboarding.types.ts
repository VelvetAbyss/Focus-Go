export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export type OnboardingStep = 'welcome' | 'dashboard_overview' | 'tasks' | 'done'

export type FeatureSeenKey = 'dashboard' | 'tasks' | 'focus' | 'diary'

export type PendingCoachmark = 'focus' | 'diary' | null

export type FeatureSeenState = Record<FeatureSeenKey, boolean>

export type OnboardingState = {
  status: OnboardingStatus
  step: OnboardingStep
  featureSeen: FeatureSeenState
  pendingCoachmark: PendingCoachmark
}
