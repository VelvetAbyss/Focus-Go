/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import {
  canAccessFeature,
  ensureLabsSeed,
  getFeatureCatalog,
  getSubscription,
  installFeature,
  removeFeature,
  restoreFeature,
  type FeatureCatalogItem,
  type UserSubscriptionRecord,
} from './labsApi'
import { canAccessHabitTracker } from './accessRules'
import type { FeatureKey } from '../../data/models/types'
import { liveQuery } from 'dexie'
import { db } from '../../data/db'
import { subscribeAuth } from '../../store/auth'

type LabsContextValue = {
  ready: boolean
  subscription: UserSubscriptionRecord | null
  catalog: FeatureCatalogItem[]
  canAccessHabitFeature: boolean
  habitState: 'available' | 'installed' | 'removed'
  refresh: () => Promise<void>
  install: (featureKey: FeatureKey) => Promise<void>
  remove: (featureKey: FeatureKey) => Promise<void>
  restore: (featureKey: FeatureKey) => Promise<void>
  canAccessFeature: (featureKey: FeatureKey) => Promise<boolean>
}

const LabsContext = createContext<LabsContextValue | null>(null)

const defaultHabitState = 'available' as const

export const LabsProvider = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false)
  const [subscription, setSubscription] = useState<UserSubscriptionRecord | null>(null)
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([])

  const refresh = useCallback(async () => {
    await ensureLabsSeed()
    const [nextSubscription, nextCatalog] = await Promise.all([getSubscription(), getFeatureCatalog()])
    setSubscription(nextSubscription)
    setCatalog(nextCatalog)
  }, [])

  useEffect(() => {
    void refresh().finally(() => setReady(true))
  }, [refresh])

  useEffect(() => subscribeAuth(() => void refresh()), [refresh])

  useEffect(() => {
    const subscription = liveQuery(() => db.featureInstallations.toArray()).subscribe({
      next: () => { void refresh() },
    })
    return () => subscription.unsubscribe()
  }, [refresh])

  const habitState = (catalog.find((item) => item.featureKey === 'habit-tracker')?.state ?? defaultHabitState)

  const value = useMemo<LabsContextValue>(() => {
    return {
      ready,
      subscription,
      catalog,
      canAccessHabitFeature: canAccessHabitTracker(subscription?.tier ?? 'free', habitState),
      habitState,
      refresh,
      install: async (featureKey) => {
        await installFeature(featureKey)
        await refresh()
      },
      remove: async (featureKey) => {
        await removeFeature(featureKey)
        await refresh()
      },
      restore: async (featureKey) => {
        await restoreFeature(featureKey)
        await refresh()
      },
      canAccessFeature: async (featureKey) => canAccessFeature(featureKey),
    }
  }, [catalog, habitState, ready, subscription, refresh])

  return <LabsContext.Provider value={value}>{children}</LabsContext.Provider>
}

export const useLabs = () => {
  const ctx = useContext(LabsContext)
  if (!ctx) throw new Error('useLabs must be used within LabsProvider')
  return ctx
}
