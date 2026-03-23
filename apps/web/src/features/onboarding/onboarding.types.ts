export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export type OnboardingStep = 'welcome' | 'create_task' | 'done'

export type FeatureSeenKey = 'tasks' | 'focus' | 'diary'

export type PendingCoachmark = 'focus' | 'diary' | null

export type FeatureSeenState = Record<FeatureSeenKey, boolean>

export type OnboardingState = {
  status: OnboardingStatus
  step: OnboardingStep
  featureSeen: FeatureSeenState
  pendingCoachmark: PendingCoachmark
}
