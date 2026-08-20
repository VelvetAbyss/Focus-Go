import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import {
  CURRENT_USER_ID,
  ensureLabsSeed,
  getFeatureCatalog,
  getSubscription,
  installFeature,
  removeFeature,
  restoreFeature,
} from './labsApi'

const createStorage = () => {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
  }
}

const getHabits = async () => (await getFeatureCatalog()).find((item) => item.featureKey === 'habit-tracker')
const getAiDigest = async () => (await getFeatureCatalog()).find((item) => item.featureKey === 'ai-digest')

describe('labsApi', () => {
  beforeEach(async () => {
    vi.stubGlobal('localStorage', createStorage())
    await db.delete()
    await db.open()
    localStorage.clear()
  })

  it('seeds a free subscription and leaves all available features unlocked', async () => {
    await ensureLabsSeed()

    const subscription = await getSubscription()
    const habits = await getHabits()
    const aiDigest = await getAiDigest()
    expect(subscription.userId).toBe(CURRENT_USER_ID)
    expect(subscription.tier).toBe('free')
    expect(subscription.role).toBe('admin')
    expect(habits?.state).toBe('available')
    expect(habits?.requiresPremium).toBe(false)
    expect(aiDigest?.state).toBe('available')
    expect(aiDigest?.requiresPremium).toBe(false)
  })

  it('ignores legacy premium hints', async () => {
    await ensureLabsSeed()
    localStorage.setItem('auth', JSON.stringify({ plan: 'premium' }))
    const next = await getSubscription()
    expect(next.tier).toBe('free')
  })

  it('runs install/remove/restore transitions', async () => {
    await ensureLabsSeed()
    localStorage.setItem('auth', JSON.stringify({ plan: 'premium' }))
    await getSubscription()

    await installFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('installed')

    await removeFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('removed')

    await restoreFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('installed')
  })

  it('keeps all installs available without a plan switch', async () => {
    await ensureLabsSeed()

    const subscription = await getSubscription()
    const habits = await getHabits()

    expect(subscription.tier).toBe('free')
    expect(habits?.requiresPremium).toBe(false)
  })
})
