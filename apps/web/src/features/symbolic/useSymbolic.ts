import { useEffect, useState, useSyncExternalStore } from 'react'
import { liveQuery } from 'dexie'
import { getAuth, subscribeAuth } from '../../store/auth'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { migrateSymbolicRecords, querySymbolicState } from './storage'
import { EMPTY_SYMBOLIC_STATE } from './types'
import type { SymbolicState } from './types'
import { db } from '../../data/db'
import type { LocalSymbolicRecord } from '../../data/models/types'
import { getSymbolicSyncStatus, startSymbolicSync, subscribeSymbolicSync, symbolicNow } from './sync'
export const currentSymbolicOwner = (): string => {
  const id: unknown = getAuth()?.user?.id
  return typeof id === 'string' && id ? id : 'guest'
}
export const useSymbolicOwner = () => useSyncExternalStore(subscribeAuth, currentSymbolicOwner, () => 'guest')
export const useSymbolicCopy = () => {
  const { language } = usePreferences()
  return { language, zh: language === 'zh', text: (zh: string, en: string) => language === 'zh' ? zh : en }
}
export function useSymbolic() {
  const owner = useSymbolicOwner()
  const sync = useSyncExternalStore(subscribeSymbolicSync, () => getSymbolicSyncStatus(owner), () => getSymbolicSyncStatus(owner))
  const [conflictSnapshot, setConflictSnapshot] = useState<{ owner: string; rows: LocalSymbolicRecord[] }>({ owner: '', rows: [] })
  useEffect(() => startSymbolicSync(owner), [owner])
  useEffect(() => {
    const subscription = liveQuery(() => db.localSymbolic.where('ownerId').equals(owner).filter(row => row.conflict !== undefined).toArray()).subscribe(rows => setConflictSnapshot({ owner, rows }))
    return () => subscription.unsubscribe()
  }, [owner])
  const [snapshot, setSnapshot] = useState<{ owner: string; data: SymbolicState; error: boolean } | null>(null)
  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    const fail = () => { if (active) setSnapshot({ owner, data: EMPTY_SYMBOLIC_STATE, error: true }) }
    void migrateSymbolicRecords(owner).then(() => {
      if (!active) return
      const subscription = liveQuery(() => querySymbolicState(owner)).subscribe({ next: data => { if (active) setSnapshot({ owner, data, error: false }) }, error: fail })
      unsubscribe = () => subscription.unsubscribe()
    }).catch(fail)
    return () => { active = false; unsubscribe?.() }
  }, [owner])
  const current = snapshot?.owner === owner ? snapshot : null
  return { owner, data: current?.data ?? EMPTY_SYMBOLIC_STATE, ready: !!current, error: current?.error ?? false, sync, conflicts: conflictSnapshot.owner === owner ? conflictSnapshot.rows : [] }
}
/** Refresh at minute boundaries and on return, never draw cards in the timer. */
export function useSymbolicNow() {
  const owner = useSymbolicOwner()
  const [clock, setClock] = useState(() => ({ owner, now: symbolicNow(owner) }))
  useEffect(() => {
    const update = () => setClock({ owner, now: symbolicNow(owner) })
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    window.addEventListener('focusgo:symbolic-clock', update)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('focusgo:symbolic-clock', update); document.removeEventListener('visibilitychange', update) }
  }, [owner])
  return clock.owner === owner ? clock.now : symbolicNow(owner)
}
