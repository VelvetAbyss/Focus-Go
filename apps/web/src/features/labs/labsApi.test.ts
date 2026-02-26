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

const getRss = async () => (await getFeatureCatalog()).find((item) => item.featureKey === 'rss')
const getHabits = async () => (await getFeatureCatalog()).find((item) => item.featureKey === 'habit-tracker')

describe('labsApi', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('seeds free subscription and rss available by default', async () => {
    await ensureLabsSeed()

    const subscription = await getSubscription()
    const rss = await getRss()
    const habits = await getHabits()

    expect(subscription.userId).toBe(CURRENT_USER_ID)
    expect(subscription.tier).toBe('free')
    expect(rss?.state).toBe('available')
    expect(rss?.requiresPremium).toBe(true)
    expect(habits?.state).toBe('available')
    expect(habits?.requiresPremium).toBe(true)
  })

  it('upgrades to premium mock', async () => {
    await ensureLabsSeed()
    const next = await upgradeToPremiumMock()
    expect(next.tier).toBe('premium')
  })

  it('runs install/remove/restore transitions', async () => {
    await ensureLabsSeed()
    await upgradeToPremiumMock()

    await installFeature('rss')
    expect((await getRss())?.state).toBe('installed')

    await removeFeature('rss')
    expect((await getRss())?.state).toBe('removed')

    await restoreFeature('rss')
    expect((await getRss())?.state).toBe('installed')

    await installFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('installed')

    await removeFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('removed')

    await restoreFeature('habit-tracker')
    expect((await getHabits())?.state).toBe('installed')
  })
})
