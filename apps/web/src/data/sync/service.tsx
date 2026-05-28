import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuthPlan, useIsLoggedIn } from '../../store/auth'
import { dispatchSyncDataUpdated, SYNC_DATA_UPDATED_EVENT, SYNC_STATUS_CHANGED_EVENT, type SyncDataUpdatedDetail } from './constants'
import type { SyncEntityType } from './types'
import { syncStateRepo } from './repository'
import type { SyncState } from './types'
import { isLocalhostRuntime } from '../../shared/env/localhost'
import { usePageActivity } from '../../shared/hooks/usePageActivity'
import { seedDatabase } from '../seed'

type SyncContextValue = {
  state: SyncState | null
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  syncNow: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)
const CLOUD_SYNC_ENABLED_KEY = 'focusgo:cloud-sync-enabled'

const readSyncState = async (setState: (value: SyncState) => void) => {
  setState(await syncStateRepo.get())
}

const readCloudSyncEnabled = () => {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(CLOUD_SYNC_ENABLED_KEY) !== '0'
}

const writeCloudSyncEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CLOUD_SYNC_ENABLED_KEY, enabled ? '1' : '0')
}

const loadRxdbSync = () => import('./rxdb')

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const isLoggedIn = useIsLoggedIn()
  const plan = useAuthPlan()
  const [state, setState] = useState<SyncState | null>(null)
  const [enabled, setEnabledState] = useState(readCloudSyncEnabled)
  const runningRef = useRef(false)
  const canUseCloudSync = isLocalhostRuntime() || plan === 'premium'
  const pageActivity = usePageActivity()

  const refreshState = useCallback(async () => {
    await readSyncState(setState)
  }, [])

  const setEnabled = useCallback((nextEnabled: boolean) => {
    writeCloudSyncEnabled(nextEnabled)
    setEnabledState(nextEnabled)
  }, [])

  const lastSyncEndedAtRef = useRef(0)
  const consecutiveErrorsRef = useRef(0)
  const syncNow = useCallback(async (trigger: string = 'manual') => {
    if (!enabled || !isLoggedIn || runningRef.current) return
    if (!canUseCloudSync) {
      await syncStateRepo.markStatus('blocked', 'Cloud sync requires Premium')
      const seeded = await seedDatabase()
      if (seeded) dispatchSyncDataUpdated('all')
      await refreshState()
      return
    }
    // Cycle gate. Manual syncs (button click) bypass; everything else waits:
    //  - 10s minimum between successful cycles
    //  - exponential backoff after errors (30s, 60s, 120s, ..., capped 5min)
    //    so a 500ing server doesn't get hammered every 30s.
    const sinceLast = Date.now() - lastSyncEndedAtRef.current
    const errorBackoffMs = consecutiveErrorsRef.current === 0
      ? 0
      : Math.min(30_000 * 2 ** (consecutiveErrorsRef.current - 1), 300_000)
    const minGapMs = Math.max(10_000, errorBackoffMs)
    if (trigger !== 'manual' && sinceLast < minGapMs) {
      console.info('[sync] skipping', trigger, 'sinceLast', sinceLast, 'ms', 'errors', consecutiveErrorsRef.current, 'gap', minGapMs)
      return
    }
    const startedAt = Date.now()
    console.info('[sync] cycle start', { trigger })
    runningRef.current = true
    let cycleError: unknown = null
    try {
      const { runRxdbSyncCycle } = await loadRxdbSync()
      await runRxdbSyncCycle()
      consecutiveErrorsRef.current = 0
    } catch (error) {
      cycleError = error
      consecutiveErrorsRef.current += 1
    } finally {
      runningRef.current = false
      lastSyncEndedAtRef.current = Date.now()
      console.info('[sync] cycle end', {
        trigger,
        durationMs: Date.now() - startedAt,
        error: cycleError instanceof Error ? cycleError.message : cycleError,
        consecutiveErrors: consecutiveErrorsRef.current,
      })
      await refreshState()
    }
  }, [canUseCloudSync, enabled, isLoggedIn, refreshState])

  const initialize = useCallback(async () => {
    if (!enabled || !isLoggedIn || runningRef.current) return
    if (!canUseCloudSync) {
      await syncStateRepo.markStatus('blocked', 'Cloud sync requires Premium')
      const seeded = await seedDatabase()
      if (seeded) dispatchSyncDataUpdated('all')
      await refreshState()
      return
    }
    runningRef.current = true
    try {
      const { ensureRxdbSyncReady } = await loadRxdbSync()
      await ensureRxdbSyncReady()
    } finally {
      runningRef.current = false
      await refreshState()
    }
    await syncNow('initialize')
    const seeded = await seedDatabase()
    if (seeded) {
      dispatchSyncDataUpdated('all')
      await syncNow('post-seed')
    }
  }, [canUseCloudSync, enabled, isLoggedIn, refreshState, syncNow])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  useEffect(() => {
    if (!enabled || !isLoggedIn) return
    void initialize()
  }, [enabled, initialize, isLoggedIn])

  useEffect(() => {
    if (!enabled || !isLoggedIn || canUseCloudSync) return
    void syncStateRepo.markStatus('blocked', 'Cloud sync requires Premium')
  }, [canUseCloudSync, enabled, isLoggedIn])

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
    if (!enabled || !isLoggedIn || !canUseCloudSync || pageActivity !== 'visible') return
    const intervalId = window.setInterval(() => {
      void syncNow('interval')
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [canUseCloudSync, enabled, isLoggedIn, pageActivity, syncNow])

  useEffect(() => {
    if (!enabled || !isLoggedIn || !canUseCloudSync) return
    const handleOnline = () => void syncNow('online')
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [canUseCloudSync, enabled, isLoggedIn, syncNow])

  useEffect(() => {
    if (!enabled || !isLoggedIn || !canUseCloudSync || pageActivity !== 'visible') return
    void syncNow('page-visible')
  }, [canUseCloudSync, enabled, isLoggedIn, pageActivity, syncNow])

  const value = useMemo<SyncContextValue>(
    () => ({
      state,
      enabled,
      setEnabled,
      syncNow: () => syncNow('manual'),
    }),
    [enabled, setEnabled, state, syncNow],
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
      enabled: true,
      setEnabled: () => {},
      syncNow: async () => {},
    }
  }
  return {
    enabled: context.enabled,
    setEnabled: context.setEnabled,
    syncNow: context.syncNow,
  }
}
