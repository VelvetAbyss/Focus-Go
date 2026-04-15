import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsLoggedIn } from '../../store/auth'
import { SYNC_DATA_UPDATED_EVENT, SYNC_STATUS_CHANGED_EVENT } from './constants'
import { syncStateRepo } from './repository'
import { ensureRxdbSyncReady, runRxdbSyncCycle } from './rxdb'
import type { SyncState } from './types'

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
  const [state, setState] = useState<SyncState | null>(null)
  const runningRef = useRef(false)

  const refreshState = useCallback(async () => {
    await readSyncState(setState)
  }, [])

  const syncNow = useCallback(async () => {
    if (!isLoggedIn || runningRef.current) return
    runningRef.current = true
    try {
      await runRxdbSyncCycle()
    } finally {
      runningRef.current = false
      await refreshState()
    }
  }, [isLoggedIn, refreshState])

  const initialize = useCallback(async () => {
    if (!isLoggedIn || runningRef.current) return
    runningRef.current = true
    try {
      await ensureRxdbSyncReady()
    } finally {
      runningRef.current = false
      await refreshState()
    }
    await syncNow()
  }, [isLoggedIn, refreshState, syncNow])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  useEffect(() => {
    if (!isLoggedIn) return
    void initialize()
  }, [initialize, isLoggedIn])

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
    if (!isLoggedIn) return
    const intervalId = window.setInterval(() => {
      void syncNow()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [isLoggedIn, syncNow])

  useEffect(() => {
    if (!isLoggedIn) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    const handleOnline = () => void syncNow()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [isLoggedIn, syncNow])

  const value = useMemo<SyncContextValue>(
    () => ({
      state,
      syncNow,
    }),
    [state, syncNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export const useSyncDataRefresh = (callback: () => void) => {
  useEffect(() => {
    const handler = () => callback()
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, handler)
    return () => window.removeEventListener(SYNC_DATA_UPDATED_EVENT, handler)
  }, [callback])
}

export const useSyncStatus = () => {
  const context = useContext(SyncContext)
  return context?.state ?? null
}

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
