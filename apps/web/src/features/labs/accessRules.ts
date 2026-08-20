import type { FeatureState } from './labsModel'
import type { SubscriptionTier } from './labsApi'

export const canAccessHabitTracker = (tier: SubscriptionTier, habitState: FeatureState) =>
  Boolean(tier) && habitState === 'installed'
