import type { FeatureState } from './labsModel'
import type { SubscriptionTier } from './labsApi'

export const canAccessRss = (tier: SubscriptionTier, rssState: FeatureState) =>
  tier === 'premium' && rssState === 'installed'

export const canAccessHabitTracker = (tier: SubscriptionTier, habitState: FeatureState) =>
  tier === 'premium' && habitState === 'installed'

export const buildNavWithConditionalRss = (baseNav: string[], enableRss: boolean) => {
  const cleaned = baseNav.filter((item) => item !== 'rss')
  if (!enableRss) return cleaned

  const dashboardIndex = cleaned.findIndex((item) => item === 'dashboard')
  if (dashboardIndex < 0) return ['rss', ...cleaned]

  return [...cleaned.slice(0, dashboardIndex + 1), 'rss', ...cleaned.slice(dashboardIndex + 1)]
}
