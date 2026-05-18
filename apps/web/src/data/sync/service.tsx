import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuthPlan, useIsLoggedIn } from '../../store/auth'
import { dispatchSyncDataUpdated, SYNC_DATA_UPDATED_EVENT, SYNC_STATUS_CHANGED_EVENT, type SyncDataUpdatedDetail } from './constants'
import type { SyncEntityType } from './types'
import { syncStateRepo } from './repository'
import { ensureRxdbSyncReady, runRxdbSyncCycle } from './rxdb'
import type { SyncState } from './types'
import { isLocalhostRuntime } from '../../shared/env/localhost'
import { usePageActivity } from '../../shared/hooks/usePageActivity'
import { seedDatabase } from '../seed'

type SyncContextValue = {
  state: SyncState | null
  syncNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

const readSyncState = async (setState: (value: SyncState) => void) => {
  setState(await syncStateRepo.get())
}

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const isLoggedIn = useIsLoggedIn()
  const plan = useAuthPlan()
  const [state, setState] = useState<SyncState | null>(null)
  const runningRef = useRef(false)
  const canUseCloudSync = isLocalhostRuntime() || plan === 'premium'
  const pageActivity = usePageActivity()

  const refreshState = useCallback(async () => {
    await readSyncState(setState)
  }, [])

  const syncNow = useCallback(async () => {
    if (!isLoggedIn || runningRef.current) return
    if (!canUseCloudSync) {
      await syncStateRepo.markStatus('blocked', 'Cloud sync requires Premium')
      const seeded = await seedDatabase()
      if (seeded) dispatchSyncDataUpdated('all')
      await refreshState()
      return
    }
    runningRef.current = true
    try {
      await runRxdbSyncCycle()
    } finally {
      runningRef.current = false
      await refreshState()
    }
  }, [canUseCloudSync, isLoggedIn, refreshState])

  const initialize = useCallback(async () => {
    if (!isLoggedIn || runningRef.current) return
    if (!canUseCloudSync) {
      await syncStateRepo.markStatus('blocked', 'Cloud sync requires Premium')
      const seeded = await seedDatabase()
      if (seeded) dispatchSyncDataUpdated('all')
      await refreshState()
      return
    }
    runningRef.current = true
    try {
      await ensureRxdbSyncReady()
    } finally {
      runningRef.current = false
      await refreshState()
    }
    await syncNow()
    const seeded = await seedDatabase()
    if (seeded) {
      dispatchSyncDataUpdated('all')
      await syncNow()
    }
  }, [canUseCloudSync, isLoggedIn, refreshState, syncNow])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  useEffect(() => {
    if (!isLoggedIn) return
    void initialize()
  }, [initialize, isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn || canUseCloudSync) return
    void syncStateRepo.markStatus('blocked', 'Cloud sync requires Premium')
  }, [canUseCloudSync, isLoggedIn])

  useEffect(() => {
    const statusListener = () => {
      void refreshState()
    }
    window.addEventListener(SYNC_STATUS_CHANGED_EVENT, statusListener)
    return () => {
      window.removeEventListener(SYNC_STATUS_CHANGED_EVENT, statusListener)
    }
  }, [refreshState])

  useEffect(() => {
    if (!isLoggedIn || !canUseCloudSync || pageActivity !== 'visible') return
    const intervalId = window.setInterval(() => {
      void syncNow()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [canUseCloudSync, isLoggedIn, pageActivity, syncNow])

  useEffect(() => {
    if (!isLoggedIn || !canUseCloudSync) return
    const handleOnline = () => void syncNow()
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [canUseCloudSync, isLoggedIn, syncNow])

  useEffect(() => {
    if (!isLoggedIn || !canUseCloudSync || pageActivity !== 'visible') return
    void syncNow()
  }, [canUseCloudSync, isLoggedIn, pageActivity, syncNow])

  const value = useMemo<SyncContextValue>(
    () => ({
      state,
      syncNow,
    }),
    [state, syncNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSyncDataRefresh = (callback: () => void, topics?: SyncEntityType[]) => {
  const callbackRef = useRef(callback)
  useEffect(() => { callbackRef.current = callback })

  // Serialize topics for stable dep comparison (callers may pass inline arrays)
  const topicsKey = topics?.join(',') ?? ''

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SyncDataUpdatedDetail>).detail
      const topic = detail?.topic
      // 'all' (seed/full sync) always triggers everyone; no filter = subscribe to all
      if (!topics?.length || !topic || topic === 'all' || topics.includes(topic as SyncEntityType)) {
        callbackRef.current()
      }
    }
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, handler)
    return () => window.removeEventListener(SYNC_DATA_UPDATED_EVENT, handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey])
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSyncStatus = () => {
  const context = useContext(SyncContext)
  return context?.state ?? null
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSyncActions = () => {
  const context = useContext(SyncContext)
  if (!context) {
    return {
      syncNow: async () => {},
    }
  }
  return {
    syncNow: context.syncNow,
  }
}
