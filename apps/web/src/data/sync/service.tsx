import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useIsLoggedIn } from '../../store/auth'
import { SYNC_OUTBOX_CHANGED_EVENT, SYNC_STATUS_CHANGED_EVENT } from './constants'
import { syncApi } from './client'
import {
  applyRemoteTables,
  getLocalEntityCount,
  getRemoteEntityCount,
  replaceLocalWithRemote,
  seedOutboxFromSnapshot,
  syncOutboxRepo,
  syncStateRepo,
} from './repository'
import type { FirstSyncChoice, SyncBootstrapResponse, SyncState } from './types'

type SyncContextValue = {
  state: SyncState | null
  syncNow: () => Promise<void>
  resolveFirstSync: (choice: FirstSyncChoice) => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

const readSyncState = async (setState: (value: SyncState) => void) => {
  setState(await syncStateRepo.get())
}

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const isLoggedIn = useIsLoggedIn()
  const [state, setState] = useState<SyncState | null>(null)
  const bootstrapRef = useRef<SyncBootstrapResponse | null>(null)
  const flushTimerRef = useRef<number | null>(null)
  const runningRef = useRef(false)

  const refreshState = useCallback(async () => {
    await readSyncState(setState)
  }, [])

  const flushOutbox = useCallback(async () => {
    const operations = await syncOutboxRepo.listReady()
    if (!operations.length) return
    const result = await syncApi.push(operations)
    await syncOutboxRepo.remove(operations.map((item) => item.id))
    await syncStateRepo.patch({ lastPushedAt: result.serverTime, status: 'idle', lastError: null })
  }, [])

  const pullChanges = useCallback(async () => {
    const current = await syncStateRepo.get()
    const response = await syncApi.pull(current.lastPulledAt ?? 0)
    await applyRemoteTables(response.tables)
    await syncStateRepo.patch({ lastPulledAt: response.serverTime, status: 'idle', lastError: null })
  }, [])

  const syncNow = useCallback(async () => {
    if (!isLoggedIn || runningRef.current) return
    const current = await syncStateRepo.get()
    if (current.pendingFirstSync) return
    runningRef.current = true
    await syncStateRepo.markStatus('syncing')
    try {
      await flushOutbox()
      await pullChanges()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed'
      const operations = await syncOutboxRepo.listReady()
      const nextAttempt = Math.max(1, ...operations.map((item) => item.attemptCount + 1))
      await syncOutboxRepo.markRetry(operations.map((item) => item.id), nextAttempt)
      await syncStateRepo.markStatus('error', message)
    } finally {
      runningRef.current = false
      await refreshState()
    }
  }, [flushOutbox, isLoggedIn, pullChanges, refreshState])

  const initialize = useCallback(async () => {
    if (!isLoggedIn || runningRef.current) return
    runningRef.current = true
    await syncStateRepo.markStatus('syncing')
    try {
      const current = await syncStateRepo.get()
      const bootstrap = await syncApi.bootstrap()
      bootstrapRef.current = bootstrap
      const localCount = await getLocalEntityCount()
      const remoteCount = getRemoteEntityCount(bootstrap)

      if (!current.firstSyncResolved) {
        if (localCount === 0) {
          await replaceLocalWithRemote(bootstrap.tables)
          await syncStateRepo.resolveFirstSync()
          await syncStateRepo.patch({ lastPulledAt: bootstrap.serverTime })
        } else {
          await syncStateRepo.markPendingFirstSync(localCount, remoteCount)
          return
        }
      } else {
        await applyRemoteTables(bootstrap.tables)
        await syncStateRepo.patch({ lastPulledAt: bootstrap.serverTime, status: 'idle' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed'
      await syncStateRepo.markStatus('error', message)
    } finally {
      runningRef.current = false
      await refreshState()
    }

    await syncNow()
  }, [isLoggedIn, refreshState, syncNow])

  const resolveFirstSync = useCallback(async (choice: FirstSyncChoice) => {
    const bootstrap = bootstrapRef.current ?? (await syncApi.bootstrap())
    await syncStateRepo.markStatus('syncing')

    if (choice === 'pull-remote') {
      await replaceLocalWithRemote(bootstrap.tables)
      await syncStateRepo.markChoice()
      await syncStateRepo.patch({ lastPulledAt: bootstrap.serverTime })
    } else {
      await seedOutboxFromSnapshot()
      await syncStateRepo.markChoice()
    }

    await refreshState()
    await syncNow()
  }, [refreshState, syncNow])

  useEffect(() => {
    void refreshState()
  }, [refreshState])

  useEffect(() => {
    if (!isLoggedIn) return
    void initialize()
  }, [initialize, isLoggedIn])

  useEffect(() => {
    const listener = () => {
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = window.setTimeout(() => {
        void syncNow()
      }, 600)
    }
    const statusListener = () => {
      void refreshState()
    }
    window.addEventListener(SYNC_OUTBOX_CHANGED_EVENT, listener)
    window.addEventListener(SYNC_STATUS_CHANGED_EVENT, statusListener)
    return () => {
      window.removeEventListener(SYNC_OUTBOX_CHANGED_EVENT, listener)
      window.removeEventListener(SYNC_STATUS_CHANGED_EVENT, statusListener)
      if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current)
    }
  }, [isLoggedIn, refreshState, syncNow])

  const value = useMemo<SyncContextValue>(
    () => ({
      state,
      syncNow,
      resolveFirstSync,
    }),
    [resolveFirstSync, state, syncNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
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
      resolveFirstSync: async () => {},
    }
  }
  return {
    syncNow: context.syncNow,
    resolveFirstSync: context.resolveFirstSync,
  }
}
