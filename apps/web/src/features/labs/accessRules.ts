import type { AccountRole } from '../../data/models/types'
import type { FeatureState } from './labsModel'
import type { SubscriptionTier } from './labsApi'

export const canAccessHabitTracker = (tier: SubscriptionTier, habitState: FeatureState) =>
  tier === 'premium' && habitState === 'installed'

export const canAccessMindMapFeature = (role: AccountRole) => role === 'admin'
