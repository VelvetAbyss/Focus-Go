import 'fake-indexeddb/auto'
import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
const auth = vi.hoisted(() => ({ owner: 'guest', session: 'test' }))
const fetchApi = vi.hoisted(() => vi.fn())
vi.mock('../../store/auth', () => ({ getAuth: () => auth.owner === 'guest' ? null : { user: { id: auth.owner }, accessToken: auth.session } }))
vi.mock('../../shared/apiBase', () => ({ fetchApi }))
import { db } from '../../data/db'
import { emptyBirthInput } from './types'
import { saveBirthProfile, selectBirthProfile, readSymbolicState, startTarotSession, selectTarotCard, finishTarotSession, updateReading, prepareSymbolicRestore } from './storage'
import { syncSymbolicNow, pauseSymbolicSyncForReset, resumeSymbolicSyncAfterResetFailure, resolveSymbolicConflict, applySymbolicResetMessage, symbolicNow, startSymbolicSync, pauseSymbolicSyncForAccountCleanup, handleSymbolicOwnerChange } from './sync'
import type { SymbolicMutation, SymbolicWireRow } from '../../data/models/types'
import type { BirthProfile, TarotReading } from './types'
const context = { topic: 'general' as const, intent: 'action' as const, question: '', optionA: '', optionB: '' }
const report = { id: 'r', version: '2', title: 'Report', summary: 'Summary', sections: [], dos: [], donts: [], method: [], limitations: [] }
const reports = { zh: report, en: report }
const birth = { ...emptyBirthInput(), date: '2000-01-02', time: '12:00', timeZone: 'UTC' }
let remote: Map<string, SymbolicWireRow>, revision: number, generation: string
function useServer() {
  remote = new Map(); revision = 0; generation = 'gen-a'
  fetchApi.mockImplementation(async (path: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    if (path.endsWith('/pull')) return Response.json({ generation, cursor: revision, hasMore: false, timeZone: 'UTC', rows: [...remote.values()].filter(r => r.revision > (body.generation === generation ? body.cursor : 0)) })
    if (body.generation !== generation) return Response.json({ error: 'symbolic_generation_changed' }, { status: 409 })
    if (path.endsWith('/daily-claim')) {
      const reading = body.reading
      const existing = remote.get(reading.id)
      const row = existing ?? { id: reading.id, kind: 'tarot', payload: { ...reading, serverConfirmed: true }, revision: ++revision, operationId: body.operationId, updatedAt: Date.now(), deleted: false }
      remote.set(row.id, row); return Response.json({ generation, row })
    }
    const accepted: SymbolicWireRow[] = [], conflicts: { id: string; remote: SymbolicWireRow | null }[] = []
    for (const mutation of body.rows as SymbolicMutation[]) {
      const prior = remote.get(mutation.id)
      if (prior?.operationId === mutation.operationId) { accepted.push(prior); continue }
      if ((prior?.revision ?? 0) !== mutation.baseRevision) { conflicts.push({ id: mutation.id, remote: prior ?? null }); continue }
      const row = { id: mutation.id, kind: mutation.kind, payload: mutation.payload, operationId: mutation.operationId, updatedAt: mutation.updatedAt, deleted: mutation.deleted, revision: ++revision }
      remote.set(row.id, row); accepted.push(row)
    }
    return Response.json({ generation, accepted, conflicts })
  })
}
const browserStorage = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (key: string) => browserStorage.get(key) ?? null, setItem: (key: string, value: string) => browserStorage.set(key, value), clear: () => browserStorage.clear() })
beforeEach(async () => {
  auth.owner = 'guest'; auth.session = 'test'; localStorage.clear(); resumeSymbolicSyncAfterResetFailure(); await db.localSymbolic.clear(); fetchApi.mockReset(); useServer()
})
afterAll(() => db.close())
describe('symbolic rebuild persistence and sync', () => {
  it('resumes after switching accounts but keeps explicit resets paused', async () => {
    auth.owner = 'owner-a'; pauseSymbolicSyncForAccountCleanup()
    const same = startSymbolicSync('owner-a'); same()
    await syncSymbolicNow('owner-a'); expect(fetchApi).not.toHaveBeenCalled()
    auth.owner = 'guest'; handleSymbolicOwnerChange()
    auth.owner = 'owner-a'
    const reopened = startSymbolicSync('owner-a'); reopened()
    await syncSymbolicNow('owner-a'); expect(fetchApi).toHaveBeenCalled()
    fetchApi.mockClear(); pauseSymbolicSyncForReset()
    auth.owner = 'owner-b'
    const other = startSymbolicSync('owner-b'); other()
    await syncSymbolicNow('owner-b'); expect(fetchApi).not.toHaveBeenCalled()
  })
  it('resumes same-account reauthentication after another tab requested cleanup', async () => {
    auth.owner = 'owner'; pauseSymbolicSyncForAccountCleanup()
    handleSymbolicOwnerChange()
    await syncSymbolicNow('owner'); expect(fetchApi).not.toHaveBeenCalled()
    auth.session = 'new-test-session'; handleSymbolicOwnerChange()
    await syncSymbolicNow('owner'); expect(fetchApi).toHaveBeenCalled()
    fetchApi.mockClear(); pauseSymbolicSyncForReset()
    auth.session = 'another-test-session'; handleSymbolicOwnerChange()
    await syncSymbolicNow('owner'); expect(fetchApi).not.toHaveBeenCalled()
  })
  it('rejects an old response after cleanup even when the same owner signs in again', async () => {
    auth.owner = 'owner'
    let release!: (response: Response) => void
    let began!: () => void
    const started = new Promise<void>(resolve => { began = resolve })
    fetchApi.mockImplementationOnce(() => { began(); return new Promise<Response>(resolve => { release = resolve }) })
    const pending = syncSymbolicNow('owner')
    const rejected = expect(pending).rejects.toThrow('Symbolic sync was reset')
    await started
    pauseSymbolicSyncForAccountCleanup()
    auth.owner = 'guest'; handleSymbolicOwnerChange()
    auth.owner = 'owner'; handleSymbolicOwnerChange()
    await syncSymbolicNow('owner')
    release(Response.json({ generation:'obsolete', cursor:999, hasMore:false, timeZone:'UTC', rows:[] }))
    await rejected
    expect((await db.localSymbolic.get(['owner', 'sync-meta']))?.payload).toMatchObject({generation:'gen-a'})
  })
  it('resumes other tabs after a failed reset only for the matching pause token', async () => {
    auth.owner = 'owner'
    applySymbolicResetMessage(JSON.stringify({ token: 'reset-a', phase: 'pause' }))
    await syncSymbolicNow('owner'); expect(fetchApi).not.toHaveBeenCalled()
    applySymbolicResetMessage(JSON.stringify({ token: 'reset-b', phase: 'resume' }))
    await syncSymbolicNow('owner'); expect(fetchApi).not.toHaveBeenCalled()
    applySymbolicResetMessage(JSON.stringify({ token: 'reset-a', phase: 'resume' }))
    await syncSymbolicNow('owner'); expect(fetchApi).toHaveBeenCalled()
  })
  it('uses server clock for a new daily session even if this device is a day behind', async () => {
    auth.owner = 'owner'
    const real = fetchApi.getMockImplementation()!
    const serverTime = Date.now() + 86400000
    fetchApi.mockImplementation(async (path: string, init: RequestInit) => {
      const response = await real(path, init)
      return path.endsWith('/pull') ? Response.json({ ...await response.json(), serverNow: serverTime }) : response
    })
    await syncSymbolicNow('owner')
    expect(Math.abs(symbolicNow('owner').getTime() - serverTime)).toBeLessThan(1000)
    const session = await startTarotSession('owner', { spread: 'daily', timeZone: 'UTC', reverse: false, question: '', context })
    expect(session.dateKey).toBe(new Date(serverTime).toISOString().slice(0,10))
  })
  it('local reflection conflict resolution preserves server reveals and forks divergent draw progress', async () => {
    auth.owner = 'owner'
    const session = await startTarotSession('owner', { spread: 'three', timeZone: 'UTC', reverse: false, question: '', context })
    await selectTarotCard('owner', session.id, 0); await selectTarotCard('owner', session.id, 1); await selectTarotCard('owner', session.id, 2)
    const reading = await finishTarotSession('owner', session.id, reports); await syncSymbolicNow('owner')
    await updateReading('owner', reading.id, { reflection: 'Local reflection' })
    const serverReading = remote.get(reading.id)!
    const serverPayload = serverReading.payload as TarotReading
    remote.set(reading.id, { ...serverReading, revision: ++revision, operationId: 'cloud-reveal', payload: { ...serverPayload, cards: serverPayload.cards.map(c => ({ ...c, revealed: true })) } })
    await syncSymbolicNow('owner'); await resolveSymbolicConflict('owner', reading.id, 'local')
    const resolved = (await db.localSymbolic.get(['owner', reading.id]))!.payload as TarotReading
    expect(resolved.reflection).toBe('Local reflection'); expect(resolved.cards.every(c => c.revealed)).toBe(true)
    const draw = (await db.localSymbolic.get(['owner', session.id]))!
    await db.localSymbolic.put({ ...draw, conflict: { ...remote.get(session.id)!, payload: { ...session, selected: [4] } } })
    await resolveSymbolicConflict('owner', session.id, 'local')
    expect((await readSymbolicState('owner')).sessions).toHaveLength(2)
  })
  it('keeps multiple profiles, active selection and legacy migration isolated per account', async () => {
    const a = await saveBirthProfile('guest', { ...birth, name: 'A' }, null, null)
    const b = await saveBirthProfile('guest', { ...birth, name: 'B' }, null, null)
    await selectBirthProfile('guest', a.id!)
    expect((await readSymbolicState('guest')).profile?.name).toBe('A')
    expect((await readSymbolicState('guest')).profiles).toHaveLength(2)
    const old: BirthProfile = { ...birth, name: 'Legacy', savedAt: 10, version: 'old' }
    auth.owner = 'old-owner'
    await db.localSymbolic.put({ ownerId: 'old-owner', id: 'profile', kind: 'profile', schemaVersion: 1, updatedAt: 10, payload: old })
    expect((await readSymbolicState('old-owner')).profiles).toHaveLength(1)
    expect((await readSymbolicState('old-owner')).profiles).toHaveLength(1)
    expect(await db.localSymbolic.get(['guest', b.id!])).toBeDefined()
  })
  it('persists all 78 shuffled cards and the irreversible selection across reopening', async () => {
    const first = await startTarotSession('guest', { spread: 'three', timeZone: 'UTC', reverse: true, question: 'Test', context })
    const picked = await selectTarotCard('guest', first.id, 7)
    const reopened = (await readSymbolicState('guest')).sessions[0]
    expect(reopened.deck).toEqual(first.deck); expect(reopened.selected).toEqual([7])
    expect(new Set(reopened.deck.map(c => c.id)).size).toBe(78)
    await expect(selectTarotCard('guest', first.id, 7)).rejects.toThrow()
    await expect(finishTarotSession('guest', first.id, reports)).rejects.toThrow('Select all')
    await selectTarotCard('guest', first.id, 0); await selectTarotCard('guest', first.id, 77)
    const reading = await finishTarotSession('guest', first.id, reports)
    expect(reading.cards[0].id).toBe(picked.deck[7].id); expect(reading.reports).toEqual(reports)
    expect(reading.cards.every(c => !c.revealed)).toBe(true)
    await expect(selectTarotCard('guest', first.id, 9)).rejects.toThrow('complete')
    expect((await finishTarotSession('guest', first.id, reports)).id).toBe(reading.id)
  })
  it('does not let an ACK for a frozen request erase an edit made while that request is in flight', async () => {
    auth.owner = 'owner'
    const first = await saveBirthProfile('owner', { ...birth, name: 'Before' }, null, null)
    const real = fetchApi.getMockImplementation()!
    let release!: (response: Response) => void
    let started!: () => void
    const began = new Promise<void>(resolve => { started = resolve })
    let delayed = false
    fetchApi.mockImplementation(async (path: string, init: RequestInit) => {
      const response = await real(path, init)
      if (path.endsWith('/push') && !delayed) { delayed = true; started(); return new Promise<Response>(resolve => { release = () => resolve(response) }) }
      return response
    })
    const running = syncSymbolicNow('owner')
    await began
    await saveBirthProfile('owner', { ...birth, name: 'After' }, first.version, first.id)
    release(Response.json({}))
    await running
    expect((remote.get(first.id!)?.payload as BirthProfile).name).toBe('After')
    const saved = await db.localSymbolic.get(['owner', first.id!])
    expect(saved?.dirty).toBe(false); expect(saved?.pending).toBeUndefined()
  })
  it('retains pending operation after connection loss, then safely retries the same operation', async () => {
    auth.owner = 'owner'; const first = await saveBirthProfile('owner', birth, null, null)
    const real = fetchApi.getMockImplementation()!
    let lost = false
    fetchApi.mockImplementation(async (path: string, init: RequestInit) => {
      const response = await real(path, init)
      if (path.endsWith('/push') && !lost) { lost = true; throw new Error('Connection lost after commit') }
      return response
    })
    await expect(syncSymbolicNow('owner')).rejects.toThrow('Connection lost')
    expect((await db.localSymbolic.get(['owner', first.id!]))?.pending).toBeDefined()
    await syncSymbolicNow('owner')
    expect((await db.localSymbolic.get(['owner', first.id!]))?.dirty).toBe(false)
    expect([...remote.values()].filter(r => r.kind === 'birth-profile')).toHaveLength(1)
  })
  it('keeps both sides of an offline conflict until the user resolves it', async () => {
    auth.owner = 'owner'; const first = await saveBirthProfile('owner', { ...birth, name: 'Initial' }, null, null)
    await syncSymbolicNow('owner')
    await saveBirthProfile('owner', { ...birth, name: 'Local' }, first.version, first.id)
    const original = remote.get(first.id!)!
    remote.set(first.id!, { ...original, operationId: 'remote-change', revision: ++revision, payload: { ...(original.payload as BirthProfile), name: 'Cloud' } })
    await syncSymbolicNow('owner')
    const conflict = await db.localSymbolic.get(['owner', first.id!])
    expect((conflict?.payload as BirthProfile).name).toBe('Local')
    expect((conflict?.conflict?.payload as BirthProfile).name).toBe('Cloud')
    await resolveSymbolicConflict('owner', first.id!, 'keep-both')
    expect((await readSymbolicState('owner')).profiles.map(p => p.name).sort()).toEqual(['Cloud', 'Local'])
  })
  it('cloud-off daily draws remain usable and reconcile without discarding the old local reading', async () => {
    auth.owner = 'owner'; localStorage.setItem('focusgo:cloud-sync-enabled', '0')
    const session = await startTarotSession('owner', { spread: 'daily', timeZone: 'UTC', reverse: false, question: '', context })
    await selectTarotCard('owner', session.id, 0)
    const local = await finishTarotSession('owner', session.id, reports)
    await updateReading('owner', local.id, { reveal: 0 })
    expect(fetchApi).not.toHaveBeenCalled(); expect(local.serverConfirmed).toBe(false)
    const different = { ...local, serverConfirmed: true, cards: [{ id: local.cards[0].id === 'major-0' ? 'major-1' : 'major-0', reversed: false, revealed: false }] }
    remote.set(local.id, { id: local.id, kind: 'tarot', payload: different, revision: ++revision, operationId: 'other-device', updatedAt: Date.now(), deleted: false })
    localStorage.setItem('focusgo:cloud-sync-enabled', '1')
    await syncSymbolicNow('owner')
    const state = await readSymbolicState('owner')
    expect(state.readings.find(r => r.id === local.id)?.cards[0].id).toBe(different.cards[0].id)
    expect(state.readings.find(r => r.archived)?.cards[0].id).toBe(local.cards[0].id)
  })
  it('reset invalidates late responses and changed server generation does not resurrect old rows', async () => {
    auth.owner = 'owner'; await saveBirthProfile('owner', birth, null, null); await syncSymbolicNow('owner')
    generation = 'gen-reset'; revision = 0; remote.clear()
    await syncSymbolicNow('owner')
    expect((await readSymbolicState('owner')).profiles).toHaveLength(0)
    const real = fetchApi.getMockImplementation()!
    let release!: () => void, start!: () => void
    const began = new Promise<void>(resolve => { start = resolve })
    fetchApi.mockImplementation(async (path: string, init: RequestInit) => {
      const response = await real(path, init)
      start(); await new Promise<void>(resolve => { release = resolve }); return response
    })
    const late = syncSymbolicNow('owner'); await began; pauseSymbolicSyncForReset(); release()
    await expect(late).rejects.toThrow('reset')
  })
  it('backup restoration ignores cloud revisions, does not overwrite newer content, and archives daily claims', async () => {
    const session = await startTarotSession('guest', { spread: 'daily', timeZone: 'UTC', reverse: false, question: '', context })
    await selectTarotCard('guest', session.id, 0); const reading = await finishTarotSession('guest', session.id, reports)
    const source = (await db.localSymbolic.get(['guest', reading.id]))!
    const imported = prepareSymbolicRestore([{ ...source, revision: 999, pending: {} as never }], [], 'guest')[0]
    expect(imported.id).not.toBe(reading.id); expect((imported.payload as TarotReading).archived).toBe(true); expect(imported.revision).toBe(0); expect(imported.pending).toBeUndefined()
    const first = await saveBirthProfile('guest', birth, null, null)
    const row = (await db.localSymbolic.get(['guest', first.id!]))!
    expect(prepareSymbolicRestore([{ ...row, updatedAt: 1 }], [row], 'guest')).toEqual([])
  })
})
