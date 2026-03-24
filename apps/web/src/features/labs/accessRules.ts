import type { FeatureState } from './labsModel'
import type { SubscriptionTier } from './labsApi'

export const canAccessHabitTracker = (tier: SubscriptionTier, habitState: FeatureState) =>
  tier === 'premium' && habitState === 'installed'
