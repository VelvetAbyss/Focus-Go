import { db } from '../../data/db'
import { getAuth } from '../../store/auth'
import { fetchApi } from '../../shared/apiBase'
import { assertSymbolicOwner, dirtyRecord, migrateSymbolicRecords, signalSymbolicChange, SYMBOLIC_CHANGED } from './storage'
import { validReading, validSession, validSymbolicRecord } from './validation'
import type { LocalSymbolicRecord, SymbolicMutation, SymbolicWireRow } from '../../data/models/types'
import type { TarotReading } from './types'
import { localDateKey } from './time'

const META = 'sync-meta'
const RESET = 'focusgo:symbolic-reset'
export const symbolicCloudEnabled = () => typeof localStorage === 'undefined' || localStorage.getItem('focusgo:cloud-sync-enabled') !== '0'
type Meta = { generation: string; cursor: number; timeZone: string; clockOffset?: number }
const clockOffsets = new Map<string, number>()
export const symbolicNow = (owner: string) => new Date(Date.now() + (clockOffsets.get(owner) ?? 0))
export type SymbolicSyncStatus = { status: 'local' | 'pending' | 'syncing' | 'synced' | 'error'; message?: string; conflicts: number }
const statuses = new Map<string, SymbolicSyncStatus>()
const listeners = new Set<() => void>()
const initialStatus: SymbolicSyncStatus = { status: 'local', conflicts: 0 }
export const getSymbolicSyncStatus = (owner: string) => statuses.get(owner) ?? initialStatus
export const subscribeSymbolicSync = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const setStatus = (owner: string, value: SymbolicSyncStatus) => { statuses.set(owner, value); listeners.forEach(fn => fn()) }
let epoch = 0
let stopped = false
let resetToken: string | null = null
let dbPausedOwner: string | null = null
const currentOwner = () => getAuth()?.user?.id || 'guest'
let observedOwner = currentOwner()
let observedSession = getAuth()?.accessToken
export function pauseSymbolicSyncForAccountCleanup() {
  epoch++; stopped = true; dbPausedOwner = currentOwner(); observedOwner = dbPausedOwner
  observedSession = getAuth()?.accessToken
}
/** Invalidates old responses even when the same account signs in again without a reload. */
export function handleSymbolicOwnerChange() {
  const owner = currentOwner()
  const session = getAuth()?.accessToken
  const renewedSession = typeof session === 'string' && session.length > 0 && session !== observedSession
  if (owner === observedOwner && !renewedSession) return
  observedOwner = owner; observedSession = session; epoch++; runners.clear()
  if (stopped && resetToken === null && (dbPausedOwner !== owner || renewedSession)) {
    stopped = false; dbPausedOwner = null
  }
}
export function pauseSymbolicSyncForReset() {
  epoch++; stopped = true
  resetToken = crypto.randomUUID()
  if (typeof localStorage !== 'undefined') localStorage.setItem(RESET, JSON.stringify({ token: resetToken, phase: 'pause' }))
}
export const resumeSymbolicSyncAfterResetFailure = () => {
  stopped = false; dbPausedOwner = null; epoch++
  if (resetToken && typeof localStorage !== 'undefined') localStorage.setItem(RESET, JSON.stringify({ token: resetToken, phase: 'resume' }))
  resetToken = null; signalSymbolicChange()
}
export function applySymbolicResetMessage(value: string) {
    try {
      const message = JSON.parse(value)
      if (message.phase === 'pause' && typeof message.token === 'string') { epoch++; stopped = true; resetToken = message.token }
      if (message.phase === 'resume' && message.token === resetToken) { epoch++; stopped = false; resetToken = null; signalSymbolicChange() }
    } catch { /* An older tab can still close its database through the existing reset signal. */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key === RESET && event.newValue) applySymbolicResetMessage(event.newValue)
    if (event.key === 'focusgo:db-reset-requested') pauseSymbolicSyncForAccountCleanup()
    if (event.key === 'auth' || event.key === null) handleSymbolicOwnerChange()
  })
  window.addEventListener('focusgo:db-reset-requested', pauseSymbolicSyncForAccountCleanup)
  window.addEventListener('focusgo:auth-changed', handleSymbolicOwnerChange)
}
const guard = (owner: string, captured: number) => { assertSymbolicOwner(owner); if (stopped || captured !== epoch) throw new Error('Symbolic sync was reset'); if (!symbolicCloudEnabled()) throw new Error('Cloud sync is off') }
const request = async <T>(owner: string, captured: number, path: string, body: unknown): Promise<T> => {
  guard(owner, captured)
  const token = getAuth()?.accessToken
  const response = await fetchApi('/symbolic/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })
  guard(owner, captured)
  const data = await response.json()
  guard(owner, captured)
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Symbolic sync failed')
  return data as T
}
const readMeta = async (owner: string): Promise<Meta | null> => (await db.localSymbolic.get([owner, META]))?.payload as Meta | undefined ?? null
const validWire = (owner: string, row: SymbolicWireRow) => Number.isSafeInteger(row?.revision) && row.revision > 0 && typeof row.operationId === 'string' && validSymbolicRecord({ ...row, ownerId: owner, schemaVersion: 1 })
const clean = (owner: string, row: SymbolicWireRow): LocalSymbolicRecord => ({ ...row, ownerId: owner, schemaVersion: 1, dirty: false })
const immutableReading = (r: TarotReading) => JSON.stringify({ createdAt: r.createdAt, timeZone: r.timeZone, dateKey: r.dateKey, archived: r.archived, sourceId: r.sourceId, spread: r.spread, question: r.question, cards: r.cards.map(c => ({ id: c.id, reversed: c.reversed })), context: r.context, reports: r.reports, contentVersion: r.contentVersion })
async function archiveDaily(owner: string, row: LocalSymbolicRecord) {
  if (!validReading(row.payload)) return
  const id = 'archive:' + crypto.randomUUID()
  const reading = { ...row.payload, id, archived: true, sourceId: row.id, serverConfirmed: false }
  await db.localSymbolic.put(dirtyRecord(owner, id, 'tarot', reading))
}
/** Merge an authenticated server row without discarding later local edits or an in-flight operation. */
async function mergeRemote(owner: string, remote: SymbolicWireRow) {
  if (!validWire(owner, remote)) throw new Error('Invalid symbolic server record')
  const local = await db.localSymbolic.get([owner, remote.id])
  if (!local) { await db.localSymbolic.put(clean(owner, remote)); return }
  if ((local.revision ?? 0) > remote.revision) return
  if (local.kind === 'tarot' && validReading(local.payload) && validReading(remote.payload) && local.payload.spread === 'daily' && !local.payload.archived && !local.revision) {
    const sameReading = immutableReading(local.payload) === immutableReading(remote.payload)
    if (!sameReading) await archiveDaily(owner, local)
    const merged = clean(owner, remote)
    if (sameReading) {
      const next = { ...remote.payload, serverConfirmed: true, reflection: local.payload.reflection || remote.payload.reflection,
        cards: remote.payload.cards.map((c, i) => ({ ...c, revealed: c.revealed || (local.payload as TarotReading).cards[i].revealed })) }
      await db.localSymbolic.put(JSON.stringify(next) === JSON.stringify(remote.payload) ? merged : dirtyRecord(owner, remote.id, 'tarot', next, merged))
    } else await db.localSymbolic.put(merged)
    return
  }
  if (local.pending?.operationId === remote.operationId || local.operationId === remote.operationId) {
    const newer = local.operationId !== remote.operationId
    await db.localSymbolic.put(newer ? { ...local, revision: remote.revision, pending: undefined, conflict: undefined, dirty: true } : clean(owner, remote))
    return
  }
  if (!local.dirty && !local.pending) { await db.localSymbolic.put(clean(owner, remote)); return }
  if ((local.revision ?? 0) !== remote.revision) await db.localSymbolic.put({ ...local, pending: undefined, conflict: remote })
}
const runners = new Map<string, Promise<void>>()
export function syncSymbolicNow(owner: string): Promise<void> {
  if (owner === 'guest' || !symbolicCloudEnabled() || stopped) { setStatus(owner, { status: 'local', conflicts: 0 }); return Promise.resolve() }
  const running = runners.get(owner)
  if (running) return running
  const promise = runSync(owner).finally(() => { if (runners.get(owner) === promise) runners.delete(owner) })
  runners.set(owner, promise)
  return promise
}
async function runSync(owner: string) {
  const captured = epoch
  setStatus(owner, { status: 'syncing', conflicts: 0 })
  try {
    guard(owner, captured)
    await migrateSymbolicRecords(owner)
    let meta = await readMeta(owner)
    let more = true
    while (more) {
      const requestedGeneration = meta?.generation
      const response = await request<{ generation: string; cursor: number; timeZone: string; serverNow?: number; hasMore: boolean; rows: SymbolicWireRow[] }>(owner, captured, 'pull',
        { generation: meta?.generation, cursor: meta?.cursor ?? 0, timeZone: meta?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC', limit: 100 })
      if (!response.generation || !Number.isSafeInteger(response.cursor) || !Array.isArray(response.rows)) throw new Error('Invalid symbolic response')
      await db.transaction('rw', db.localSymbolic, async () => {
        guard(owner, captured)
        const currentMeta = await readMeta(owner)
        if (currentMeta && requestedGeneration && currentMeta.generation !== requestedGeneration) throw new Error('Symbolic generation changed in another tab')
        if (currentMeta && currentMeta.generation !== response.generation) {
          // An explicit account reset changed the dataset generation, including on another device.
          await db.localSymbolic.where('ownerId').equals(owner).delete()
        }
        for (const remote of response.rows) await mergeRemote(owner, remote)
        guard(owner, captured)
        const clockOffset = typeof response.serverNow === 'number' && Number.isFinite(response.serverNow) ? response.serverNow - Date.now() : 0
        clockOffsets.set(owner, clockOffset)
        meta = { generation: response.generation, cursor: response.cursor, timeZone: response.timeZone, clockOffset }
        await db.localSymbolic.put({ ownerId: owner, id: META, kind: 'sync-meta', schemaVersion: 1, updatedAt: Date.now(), payload: meta })
      })
      more = response.hasMore
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('focusgo:symbolic-clock'))
    if (!meta) throw new Error('Symbolic sync metadata missing')
    // Frozen pending snapshots survive reload, retries and edits made while a request is in flight.
    for (;;) {
      guard(owner, captured)
      const pending = await db.transaction('rw', db.localSymbolic, async () => {
        const rows = await db.localSymbolic.where('ownerId').equals(owner).toArray()
        const result: SymbolicMutation[] = []
        for (const row of rows) {
          if (row.kind === 'sync-meta' || row.kind === 'profile' || row.conflict !== undefined || row.dirty === false || result.length >= 50) continue
          const mutation: SymbolicMutation = row.pending ?? { id: row.id, kind: row.kind, payload: row.deleted ? null : row.payload, updatedAt: row.updatedAt,
            deleted: !!row.deleted, operationId: row.operationId ?? crypto.randomUUID(), baseRevision: row.revision ?? 0 }
          await db.localSymbolic.put({ ...row, operationId: row.operationId ?? mutation.operationId, dirty: true, pending: mutation })
          result.push(mutation)
        }
        return result
      })
      if (!pending.length) break
      const daily = pending.filter(r => r.kind === 'tarot' && validReading(r.payload) && r.payload.spread === 'daily' && !r.payload.archived && r.baseRevision === 0 && r.payload.dateKey >= localDateKey(symbolicNow(owner), meta!.timeZone))
      for (const mutation of daily) {
        const reading = mutation.payload as TarotReading
        if (reading.timeZone !== meta.timeZone || reading.dateKey !== localDateKey(symbolicNow(owner), meta.timeZone)) {
          await db.transaction('rw', db.localSymbolic, async () => {
            guard(owner, captured)
            const current = await db.localSymbolic.get([owner, mutation.id])
            if (current) { await archiveDaily(owner, current); await db.localSymbolic.delete([owner, mutation.id]) }
          })
          continue
        }
        const response = await request<{ generation: string; row: SymbolicWireRow }>(owner, captured, 'daily-claim', { generation: meta.generation, operationId: mutation.operationId, reading: { ...reading, cards: reading.cards.map(c => ({ ...c, revealed: false })) } })
        await db.transaction('rw', db.localSymbolic, async () => { guard(owner, captured); if (response.generation !== meta!.generation) throw new Error('Symbolic generation changed'); await mergeRemote(owner, response.row) })
      }
      const regular = pending.filter(r => !daily.includes(r))
      if (regular.length) {
        const response = await request<{ generation: string; accepted: SymbolicWireRow[]; conflicts: { id: string; remote: SymbolicWireRow | null }[] }>(owner, captured, 'push', { generation: meta.generation, rows: regular })
        await db.transaction('rw', db.localSymbolic, async () => {
          guard(owner, captured)
          if (response.generation !== meta!.generation || !Array.isArray(response.accepted) || !Array.isArray(response.conflicts)) throw new Error('Invalid symbolic response')
          for (const row of response.accepted) await mergeRemote(owner, row)
          for (const conflict of response.conflicts) {
            const local = await db.localSymbolic.get([owner, conflict.id])
            if (conflict.remote && !validWire(owner, conflict.remote)) throw new Error('Invalid conflict')
            if (local) await db.localSymbolic.put({ ...local, pending: undefined, conflict: conflict.remote })
          }
        })
      }
    }
    const rows = await db.localSymbolic.where('ownerId').equals(owner).toArray()
    guard(owner, captured)
    const conflicts = rows.filter(r => r.conflict !== undefined).length
    setStatus(owner, { status: conflicts ? 'pending' : 'synced', conflicts })
  } catch (error) {
    if (captured === epoch && !stopped) setStatus(owner, { status: 'error', conflicts: 0, message: error instanceof Error ? error.message : 'Sync failed' })
    throw error
  }
}
export async function claimDailyReading(owner: string, reading: TarotReading): Promise<TarotReading> {
  const captured = epoch
  guard(owner, captured)
  await syncSymbolicNow(owner)
  const meta = await readMeta(owner)
  if (!meta) throw new Error('Connect to sync before drawing')
  if (reading.timeZone !== meta.timeZone) throw new Error('Daily card uses account timezone: ' + meta.timeZone)
  const response = await request<{ generation: string; row: SymbolicWireRow }>(owner, captured, 'daily-claim', { generation: meta.generation, operationId: crypto.randomUUID(), reading })
  if (response.generation !== meta.generation || !validReading(response.row?.payload)) throw new Error('Invalid daily result')
  await db.transaction('rw', db.localSymbolic, async () => { guard(owner, captured); await mergeRemote(owner, response.row) })
  return response.row.payload
}
export async function resolveSymbolicConflict(owner: string, id: string, choice: 'local' | 'remote' | 'keep-both') {
  await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const row = await db.localSymbolic.get([owner, id])
    if (!row || row.conflict === undefined) return
    const remote = row.conflict
    if (row.kind === 'tarot-session' && validSession(row.payload) && choice !== 'remote') {
      // Selection histories are append-only. A divergent local continuation becomes its own session.
      const forkId = 'session:' + crypto.randomUUID()
      await db.localSymbolic.put(dirtyRecord(owner, forkId, 'tarot-session', { ...row.payload, id: forkId }))
      if (remote) await db.localSymbolic.put(clean(owner, remote))
      else await db.localSymbolic.delete([owner, id])
      return
    }
    if (row.kind === 'tarot' && validReading(row.payload) && remote && validReading(remote.payload) && choice === 'local') {
      const localReading = row.payload
      if (immutableReading(localReading) === immutableReading(remote.payload)) {
        const payload = { ...remote.payload, reflection: localReading.reflection, cards: remote.payload.cards.map((card, i) => ({ ...card, revealed: card.revealed || localReading.cards[i].revealed })) }
        await db.localSymbolic.put(dirtyRecord(owner, id, 'tarot', payload, clean(owner, remote)))
      } else {
        const forkId = 'archive:' + crypto.randomUUID()
        await db.localSymbolic.put(dirtyRecord(owner, forkId, 'tarot', { ...localReading, id: forkId, archived: true, sourceId: id, serverConfirmed: false }))
        await db.localSymbolic.put(clean(owner, remote))
      }
      return
    }
    if (choice === 'keep-both' && !row.deleted) {
      if (row.kind === 'birth-profile') {
        const newId = 'birth:' + crypto.randomUUID()
        await db.localSymbolic.put(dirtyRecord(owner, newId, 'birth-profile', { ...(row.payload as object), id: newId }))
      } else if (row.kind === 'tarot' && validReading(row.payload)) {
        const newId = 'archive:' + crypto.randomUUID()
        await db.localSymbolic.put(dirtyRecord(owner, newId, 'tarot', { ...row.payload, id: newId, archived: true, sourceId: id, serverConfirmed: false }))
      } else throw new Error('This conflict supports choosing local or cloud')
    }
    if (choice === 'local') await db.localSymbolic.put({ ...dirtyRecord(owner, id, row.kind, row.payload, row), deleted: row.deleted, revision: remote?.revision ?? 0, conflict: undefined, pending: undefined })
    else if (remote) await db.localSymbolic.put(clean(owner, remote))
    else await db.localSymbolic.delete([owner, id])
  })
  signalSymbolicChange()
}
const services = new Map<string, { users: number; stop: () => void }>()
export function startSymbolicSync(owner: string) {
  assertSymbolicOwner(owner)
  handleSymbolicOwnerChange()
  const existing = services.get(owner)
  if (existing) { existing.users++; return () => stopSymbolicSync(owner) }
  let queued: ReturnType<typeof setTimeout> | undefined
  const schedule = () => { if (queued) return; queued = setTimeout(() => { queued = undefined; void syncSymbolicNow(owner).catch(() => {}) }, 300) }
  const timer = setInterval(schedule, 30000)
  if (typeof window !== 'undefined') {
    window.addEventListener('online', schedule); window.addEventListener('focus', schedule); window.addEventListener('storage', schedule); window.addEventListener(SYMBOLIC_CHANGED, schedule)
  }
  services.set(owner, { users: 1, stop: () => {
    clearInterval(timer); clearTimeout(queued)
    if (typeof window !== 'undefined') { window.removeEventListener('online', schedule); window.removeEventListener('focus', schedule); window.removeEventListener('storage', schedule); window.removeEventListener(SYMBOLIC_CHANGED, schedule) }
  } })
  schedule()
  return () => stopSymbolicSync(owner)
}
function stopSymbolicSync(owner: string) {
  const service = services.get(owner)
  if (service && --service.users === 0) { service.stop(); services.delete(owner) }
}
