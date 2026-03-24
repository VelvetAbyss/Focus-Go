/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  canAccessFeature,
  downgradeToFreeMock,
  ensureLabsSeed,
  getFeatureCatalog,
  getSubscription,
  installFeature,
  removeFeature,
  restoreFeature,
  type FeatureCatalogItem,
  type UserSubscriptionRecord,
  upgradeToPremiumMock,
} from './labsApi'
import { canAccessHabitTracker, canAccessMindMapFeature } from './accessRules'
import type { FeatureKey } from '../../data/models/types'

type LabsContextValue = {
  ready: boolean
  subscription: UserSubscriptionRecord | null
  catalog: FeatureCatalogItem[]
  canAccessHabitFeature: boolean
  canAccessMindMapFeature: boolean
  habitState: 'available' | 'installed' | 'removed'
  mindMapState: 'available' | 'installed' | 'removed'
  refresh: () => Promise<void>
  upgradeMock: () => Promise<void>
  downgradeMock: () => Promise<void>
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

  const refresh = async () => {
    await ensureLabsSeed()
    const [nextSubscription, nextCatalog] = await Promise.all([getSubscription(), getFeatureCatalog()])
    setSubscription(nextSubscription)
    setCatalog(nextCatalog)
  }

  useEffect(() => {
    void refresh().finally(() => setReady(true))
  }, [])

  const habitState = (catalog.find((item) => item.featureKey === 'habit-tracker')?.state ?? defaultHabitState)
  const mindMapState = (catalog.find((item) => item.featureKey === 'mind-map')?.state ?? defaultHabitState)

  const value = useMemo<LabsContextValue>(() => {
    return {
      ready,
      subscription,
      catalog,
      canAccessHabitFeature: canAccessHabitTracker(subscription?.tier ?? 'free', habitState),
      canAccessMindMapFeature: canAccessMindMapFeature(subscription?.role ?? 'member'),
      habitState,
      mindMapState,
      refresh,
      upgradeMock: async () => {
        await upgradeToPremiumMock()
        await refresh()
      },
      downgradeMock: async () => {
        await downgradeToFreeMock()
        await refresh()
      },
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
  }, [catalog, habitState, mindMapState, ready, subscription])

  return <LabsContext.Provider value={value}>{children}</LabsContext.Provider>
}

export const useLabs = () => {
  const ctx = useContext(LabsContext)
  if (!ctx) throw new Error('useLabs must be used within LabsProvider')
  return ctx
}
