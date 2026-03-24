import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/db'
import {
  CURRENT_USER_ID,
  ensureLabsSeed,
  getFeatureCatalog,
  getSubscription,
  installFeature,
  removeFeature,
  restoreFeature,
  upgradeToPremiumMock,
} from './labsApi'

const getHabits = async () => (await getFeatureCatalog()).find((item) => item.featureKey === 'habit-tracker')
const getAiDigest = async () => (await getFeatureCatalog()).find((item) => item.featureKey === 'ai-digest')
const getMindMap = async () => (await getFeatureCatalog()).find((item) => item.featureKey === 'mind-map')

describe('labsApi', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('seeds free subscription and habits available by default', async () => {
    await ensureLabsSeed()

    const subscription = await getSubscription()
    const habits = await getHabits()
    const aiDigest = await getAiDigest()
    const mindMap = await getMindMap()

    expect(subscription.userId).toBe(CURRENT_USER_ID)
    expect(subscription.tier).toBe('free')
    expect(subscription.role).toBe('admin')
    expect(habits?.state).toBe('available')
    expect(habits?.requiresPremium).toBe(true)
    expect(mindMap?.state).toBe('available')
    expect(mindMap?.requiresPremium).toBe(false)
    expect(aiDigest?.state).toBe('available')
    expect(aiDigest?.requiresPremium).toBe(false)
  })

  it('upgrades to premium mock', async () => {
    await ensureLabsSeed()
    const next = await upgradeToPremiumMock()
    expect(next.tier).toBe('premium')
  })

  it('runs install/remove/restore transitions', async () => {
    await ensureLabsSeed()
    await upgradeToPremiumMock()

    await installFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('installed')

    await removeFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('removed')

    await restoreFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('installed')
  })
})
