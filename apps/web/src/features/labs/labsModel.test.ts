import { describe, expect, it } from 'vitest'
import {
  deriveFeatureState,
  nextFeatureInstallations,
  type FeatureInstallationRecord,
  type FeatureTransitionAction,
} from './labsModel'

describe('labsModel', () => {
  it('treats missing record as available', () => {
    expect(deriveFeatureState(undefined)).toBe('available')
  })

  it('runs install/remove/restore transitions in order', () => {
    let records: FeatureInstallationRecord[] = []

    const run = (action: FeatureTransitionAction) => {
      records = nextFeatureInstallations(records, 'local-user', 'rss', action, 1000)
      return records.find((item) => item.userId === 'local-user' && item.featureKey === 'rss')
    }

    const installed = run('install')
    expect(installed?.state).toBe('installed')
    expect(installed?.installedAt).toBe(1000)
    expect(installed?.removedAt ?? null).toBe(null)

    const removed = run('remove')
    expect(removed?.state).toBe('removed')
    expect(removed?.removedAt).toBe(1000)

    const restored = run('restore')
    expect(restored?.state).toBe('installed')
    expect(restored?.removedAt ?? null).toBe(null)
  })
})
