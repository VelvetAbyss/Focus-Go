import type { FeatureKey } from '../../data/models/types'

export type FeatureState = 'available' | 'installed' | 'removed'

export type FeatureInstallationRecord = {
  id: string
  userId: string
  featureKey: FeatureKey
  state: Exclude<FeatureState, 'available'>
  installedAt?: number
  removedAt?: number | null
  updatedAt: number
}

export type FeatureTransitionAction = 'install' | 'remove' | 'restore'

const buildId = (userId: string, featureKey: FeatureKey) => `${userId}:${featureKey}`

export const deriveFeatureState = (record?: FeatureInstallationRecord): FeatureState => {
  if (!record) return 'available'
  return record.state
}

export const nextFeatureInstallations = (
  records: FeatureInstallationRecord[],
  userId: string,
  featureKey: FeatureKey,
  action: FeatureTransitionAction,
  now = Date.now(),
): FeatureInstallationRecord[] => {
  const id = buildId(userId, featureKey)
  const existing = records.find((item) => item.id === id)

  if (!existing) {
    if (action === 'remove') return records
    const created: FeatureInstallationRecord = {
      id,
      userId,
      featureKey,
      state: 'installed',
      installedAt: now,
      removedAt: null,
      updatedAt: now,
    }
    return [...records, created]
  }

  const next: FeatureInstallationRecord = {
    ...existing,
    state: action === 'remove' ? 'removed' : 'installed',
    installedAt: action === 'remove' ? existing.installedAt : (existing.installedAt ?? now),
    removedAt: action === 'remove' ? now : null,
    updatedAt: now,
  }

  return records.map((item) => (item.id === id ? next : item))
}
