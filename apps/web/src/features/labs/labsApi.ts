import { db } from '../../data/db'
import { deriveFeatureState, nextFeatureInstallations, type FeatureState } from './labsModel'
import type { AccountRole, FeatureKey } from '../../data/models/types'

export const CURRENT_USER_ID = 'local-user'
export const CURRENT_ACCOUNT_ROLE: AccountRole = 'admin'

export type SubscriptionTier = 'free' | 'premium'

type FeatureMeta = {
  featureKey: FeatureKey
  title: string
  description: string
  premiumOnly: boolean
  comingSoon: boolean
}

export type FeatureCatalogItem = FeatureMeta & {
  state: FeatureState
  requiresPremium: boolean
}

export type UserSubscriptionRecord = {
  id: string
  userId: string
  tier: SubscriptionTier
  role: AccountRole
  createdAt: number
  updatedAt: number
}

const FEATURE_META: FeatureMeta[] = [
  {
    featureKey: 'ai-digest',
    title: 'AI Digest',
    description: 'Weekly summarization digest for your subscriptions.',
    premiumOnly: false,
    comingSoon: true,
  },
  {
    featureKey: 'automation',
    title: 'Automation Flows',
    description: 'Composable productivity automations and triggers.',
    premiumOnly: false,
    comingSoon: true,
  },
  {
    featureKey: 'habit-tracker',
    title: 'Habit Tracker',
    description: 'Identity-first habit dashboard with streaks, progress ring, and heatmap.',
    premiumOnly: true,
    comingSoon: false,
  },
  {
    featureKey: 'mind-map',
    title: 'Mind Map',
    description: 'Visual note mapping with draggable nodes and connections.',
    premiumOnly: false,
    comingSoon: true,
  },
]

const upsertSubscription = async (tier: SubscriptionTier, role: AccountRole = CURRENT_ACCOUNT_ROLE) => {
  const now = Date.now()
  const existing = await db.userSubscriptions.where('userId').equals(CURRENT_USER_ID).first()
  if (!existing) {
    const created: UserSubscriptionRecord = {
      id: `subscription:${CURRENT_USER_ID}`,
      userId: CURRENT_USER_ID,
      tier,
      role,
      createdAt: now,
      updatedAt: now,
    }
    await db.userSubscriptions.put(created)
    return created
  }

  const next: UserSubscriptionRecord = {
    ...existing,
    tier,
    role: existing.role ?? role,
    updatedAt: now,
  }
  await db.userSubscriptions.put(next)
  return next
}

const removeLegacyRssInstallations = async () => {
  const rows = await db.featureInstallations.where('userId').equals(CURRENT_USER_ID).toArray()
  const rssRows = rows.filter((item) => (item as { featureKey: string }).featureKey === 'rss')
  if (rssRows.length === 0) return
  await db.featureInstallations.bulkDelete(rssRows.map((item) => item.id))
}

const readAuthPlan = (): SubscriptionTier => {
  return 'premium'
}

export const ensureLabsSeed = async () => {
  const existing = await db.userSubscriptions.where('userId').equals(CURRENT_USER_ID).first()
  if (!existing) await upsertSubscription(readAuthPlan())
  await removeLegacyRssInstallations()
}

export const getSubscription = async () => {
  await ensureLabsSeed()
  const current = await db.userSubscriptions.where('userId').equals(CURRENT_USER_ID).first()
  if (!current) {
    return upsertSubscription('premium')
  }
  if (current.tier !== 'premium' || !current.role) {
    return upsertSubscription('premium', CURRENT_ACCOUNT_ROLE)
  }
  return current as UserSubscriptionRecord
}

export const upgradeToPremiumMock = async () => upsertSubscription('premium')

export const downgradeToFreeMock = async () => upsertSubscription('free')

export const getFeatureCatalog = async (): Promise<FeatureCatalogItem[]> => {
  await ensureLabsSeed()
  const [subscription, installations] = await Promise.all([
    getSubscription(),
    db.featureInstallations.where('userId').equals(CURRENT_USER_ID).toArray(),
  ])

  return FEATURE_META.map((meta) => {
    const record = installations.find((item) => item.featureKey === meta.featureKey)
    const state = deriveFeatureState(
      record
        ? {
            id: record.id,
            userId: record.userId,
            featureKey: record.featureKey,
            state: record.state,
            installedAt: record.installedAt,
            removedAt: record.removedAt,
            updatedAt: record.updatedAt,
          }
        : undefined,
    )

    return {
      ...meta,
      state,
      requiresPremium: meta.premiumOnly && subscription.tier !== 'premium',
    }
  })
}

const mutateFeature = async (featureKey: FeatureKey, action: 'install' | 'remove' | 'restore') => {
  const now = Date.now()

  const rows = await db.featureInstallations.where('userId').equals(CURRENT_USER_ID).toArray()
  const records = rows.map((item) => ({
    id: item.id,
    userId: item.userId,
    featureKey: item.featureKey,
    state: item.state,
    installedAt: item.installedAt,
    removedAt: item.removedAt,
    updatedAt: item.updatedAt,
  }))

  const next = nextFeatureInstallations(records, CURRENT_USER_ID, featureKey, action, now).map((item) => ({
    ...item,
    createdAt: rows.find((row) => row.id === item.id)?.createdAt ?? now,
  }))

  await db.featureInstallations.bulkPut(next)
  return getFeatureCatalog()
}

export const installFeature = async (featureKey: FeatureKey) => mutateFeature(featureKey, 'install')
export const removeFeature = async (featureKey: FeatureKey) => mutateFeature(featureKey, 'remove')
export const restoreFeature = async (featureKey: FeatureKey) => mutateFeature(featureKey, 'restore')

export const canAccessFeature = async (featureKey: FeatureKey) => {
  const [subscription, catalog] = await Promise.all([getSubscription(), getFeatureCatalog()])
  const feature = catalog.find((item) => item.featureKey === featureKey)
  if (!feature) return false
  if (feature.premiumOnly && subscription.tier !== 'premium') return false
  return feature.state === 'installed'
}
