import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { refreshAuthProfile, useIsLoggedIn } from '../../store/auth'
import { dispatchSyncDataUpdated, SYNC_DATA_UPDATED_EVENT, SYNC_STATUS_CHANGED_EVENT, type SyncDataUpdatedDetail } from './constants'
import type { SyncEntityType } from './types'
import { syncStateRepo } from './repository'
import type { SyncState } from './types'
import { usePageActivity } from '../../shared/hooks/usePageActivity'
import { seedDatabase } from '../seed'
import { SYNC_LOCAL_COMMIT_EVENT } from './capture'
import { subscribeSyncStream } from './stream'
import { db } from '../db'

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
  const [state, setState] = useState<SyncState | null>(null)
  const [enabled, setEnabledState] = useState(readCloudSyncEnabled)
  const runningRef = useRef(false)
  const queuedEntitiesRef = useRef(new Set<SyncEntityType>())
  const fullSyncRequestedRef = useRef(false)
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const syncNowRef = useRef<(trigger: string, entities?: SyncEntityType[]) => Promise<void>>(async () => {})
  const queueSync = useCallback((entities?: SyncEntityType[], delay = 500) => {
    if (!entities) fullSyncRequestedRef.current = true
    else entities.forEach(entity => queuedEntitiesRef.current.add(entity))
    if (changeTimerRef.current) return
    changeTimerRef.current = setTimeout(() => {
      changeTimerRef.current = undefined
      const requested = fullSyncRequestedRef.current ? undefined : [...queuedEntitiesRef.current]
      fullSyncRequestedRef.current = false
      queuedEntitiesRef.current.clear()
      void syncNowRef.current('change', requested)
    }, delay)
  }, [])
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
  const syncNow = useCallback(async (trigger: string = 'manual', entities?: SyncEntityType[]) => {
    if (!enabled || !isLoggedIn) return
    if (runningRef.current) {
      if (trigger === 'change' || trigger === 'manual' || trigger === 'online') {
        if (!entities) fullSyncRequestedRef.current = true
        else entities.forEach(entity => queuedEntitiesRef.current.add(entity))
      }
      return
    }
    // Cycle gate. Manual syncs and reconnects bypass; everything else waits:
    //  - 10s minimum between successful cycles
    //  - exponential backoff after errors (30s, 60s, 120s, ..., capped 5min)
    //    so a 500ing server doesn't get hammered every 30s.
    const sinceLast = Date.now() - lastSyncEndedAtRef.current
    const errorBackoffMs = consecutiveErrorsRef.current === 0
      ? 0
      : Math.min(30_000 * 2 ** (consecutiveErrorsRef.current - 1), 300_000)
    const minGapMs = Math.max(trigger === 'change' ? 1000 : 10_000, errorBackoffMs)
    if (trigger !== 'manual' && trigger !== 'online' && sinceLast < minGapMs) {
      console.info('[sync] skipping', trigger, 'sinceLast', sinceLast, 'ms', 'errors', consecutiveErrorsRef.current, 'gap', minGapMs)
      if (trigger === 'change') queueSync(entities, minGapMs - sinceLast)
      return
    }
    const startedAt = Date.now()
    console.info('[sync] cycle start', { trigger })
    runningRef.current = true
    let cycleError: unknown = null
    try {
      const { runRxdbSyncCycle } = await loadRxdbSync()
      await runRxdbSyncCycle(entities)
      await refreshAuthProfile()
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
      if (fullSyncRequestedRef.current || queuedEntitiesRef.current.size) {
        queueSync(fullSyncRequestedRef.current ? undefined : [...queuedEntitiesRef.current])
      }
    }
  }, [enabled, isLoggedIn, refreshState, queueSync])

  useEffect(() => { syncNowRef.current = syncNow }, [syncNow])

  useEffect(() => {
    if (!enabled || !isLoggedIn) return
    const queuedEntities = queuedEntitiesRef.current
    const onCommit = (event: Event) => {
      const entities = (event as CustomEvent<{ entityTypes: SyncEntityType[] }>).detail?.entityTypes
      queueSync(entities)
      void db.pendingSyncChanges.toArray().then(entries => syncStateRepo.patch({
        pendingEntityPush: entries.length > 0,
        pendingLocalRecordCount: new Set(entries.map(entry => `${entry.entityType}/${entry.entityId}`)).size,
      })).catch(error => console.error('[sync] pending status refresh failed', error))
    }
    window.addEventListener(SYNC_LOCAL_COMMIT_EVENT, onCommit)
    return () => {
      window.removeEventListener(SYNC_LOCAL_COMMIT_EVENT, onCommit)
      clearTimeout(changeTimerRef.current)
      changeTimerRef.current = undefined
      queuedEntities.clear()
      fullSyncRequestedRef.current = false
    }
  }, [enabled, isLoggedIn, queueSync])

  useEffect(() => {
    if (!enabled || !isLoggedIn || pageActivity !== 'visible') return
    return subscribeSyncStream(entities => queueSync(entities))
  }, [enabled, isLoggedIn, pageActivity, queueSync])

  const initialize = useCallback(async () => {
    if (!enabled || !isLoggedIn || runningRef.current) return
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
  }, [enabled, isLoggedIn, refreshState, syncNow])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  useEffect(() => {
    if (!enabled || !isLoggedIn) return
    void initialize()
  }, [enabled, initialize, isLoggedIn])

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
    if (!enabled || !isLoggedIn || pageActivity !== 'visible') return
    const intervalId = window.setInterval(() => {
      void syncNow('interval')
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [enabled, isLoggedIn, pageActivity, syncNow])

  useEffect(() => {
    if (!enabled || !isLoggedIn) return
    const handleOnline = () => void syncNow('online')
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, isLoggedIn, syncNow])

  useEffect(() => {
    if (!enabled || !isLoggedIn || pageActivity !== 'visible') return
    void syncNow('page-visible')
  }, [enabled, isLoggedIn, pageActivity, syncNow])

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
