import { db } from '../../data/db'
import { getAuth } from '../../store/auth'
import { drawCards, randomBelow } from '../tarot/random'
import { TAROT_DECK } from '../tarot/deck'
import { validProfile, validReading, validSession, validSymbolicRecord, spreadSize } from './validation'
import { localDateKey, resolveBirth } from './time'
import type { BirthInput, BirthProfile, SymbolicState, TarotReading, TarotSession, TarotSpread, TarotContext } from './types'
import type { InterpretationReport } from './report'
import type { LocalSymbolicRecord } from '../../data/models/types'

export const SYMBOLIC_CHANGED = 'focusgo:symbolic-changed'
export const assertSymbolicOwner = (owner: string) => { if (owner !== (getAuth()?.user?.id || 'guest')) throw new Error('Account changed') }
export const signalSymbolicChange = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYMBOLIC_CHANGED)) }
export const dirtyRecord = (owner: string, id: string, kind: LocalSymbolicRecord['kind'], payload: unknown, previous?: LocalSymbolicRecord): LocalSymbolicRecord => ({
  ...previous, ownerId: owner, id, kind, schemaVersion: 1, updatedAt: Date.now(), payload,
  revision: previous?.revision ?? 0, dirty: true, operationId: crypto.randomUUID(), deleted: false,
})
const settingsFor = (rows: LocalSymbolicRecord[]) => rows.find(r => r.id === 'settings' && !r.deleted)?.payload as { activeProfileId: string | null; timeZone: string } | undefined
/** V1 had one current row and immutable version rows. Use a stable ID so migration is repeatable. */
export async function migrateSymbolicRecords(owner: string) {
  await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const old = await db.localSymbolic.get([owner, 'profile'])
    if (!old || old.deleted) return
    if (!validProfile(old.payload)) throw new Error('Invalid birth profile')
    const id = 'birth:legacy'
    if (!await db.localSymbolic.get([owner, id])) {
      const profile = { ...old.payload, id }
      await db.localSymbolic.put(dirtyRecord(owner, id, 'birth-profile', profile))
    }
    if (!await db.localSymbolic.get([owner, 'settings'])) await db.localSymbolic.put(dirtyRecord(owner, 'settings', 'settings', { activeProfileId: id, timeZone: old.payload.timeZone }))
    // Keep the legacy value as a migration marker; never upload it as a second profile.
    await db.localSymbolic.put({ ...old, deleted: true, dirty: false })
  })
}
export async function readSymbolicState(owner: string): Promise<SymbolicState> {
  await migrateSymbolicRecords(owner)
  return querySymbolicState(owner)
}
/** Read-only query for Dexie liveQuery; migration must finish before subscription. */
export async function querySymbolicState(owner: string): Promise<SymbolicState> {
  const rows = await db.localSymbolic.where('ownerId').equals(owner).toArray()
  if (rows.some(row => !validSymbolicRecord(row))) throw new Error('Invalid local record')
  const active = rows.filter(r => !r.deleted), settings = settingsFor(active)
  const profiles = active.filter(r => r.kind === 'birth-profile').map(r => r.payload).filter(validProfile).sort((a, b) => b.savedAt - a.savedAt)
  const profile = profiles.find(p => p.id === settings?.activeProfileId) ?? profiles[0] ?? null
  return { profile, profiles, versions: active.filter(r => r.kind === 'profile-version').map(r => r.payload).filter(validProfile).sort((a, b) => b.savedAt-a.savedAt),
    readings: active.filter(r => r.kind === 'tarot').map(r => r.payload).filter(validReading).sort((a, b) => b.createdAt-a.createdAt),
    sessions: active.filter(r => r.kind === 'tarot-session').map(r => r.payload).filter(validSession).sort((a, b) => b.createdAt-a.createdAt),
    timeZone: (active.find(r => r.kind === 'sync-meta')?.payload as { timeZone?: string } | undefined)?.timeZone ?? settings?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC' }
}
export async function saveBirthProfile(owner: string, input: BirthInput, expectedVersion?: string | null, profileId?: string | null): Promise<BirthProfile> {
  resolveBirth(input)
  await migrateSymbolicRecords(owner)
  const result = await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const rows = await db.localSymbolic.where('ownerId').equals(owner).toArray(), settings = settingsFor(rows)
    const id = profileId === null ? 'birth:' + crypto.randomUUID() : profileId ?? settings?.activeProfileId ?? 'birth:' + crypto.randomUUID()
    const current = rows.find(r => r.id === id && !r.deleted)
    if (current && !validProfile(current.payload)) throw new Error('Invalid profile')
    if (expectedVersion !== undefined && (current && validProfile(current.payload) ? current.payload.version : null) !== expectedVersion) throw new Error('Profile changed in another tab')
    const profile: BirthProfile = { ...input, id, name: input.name.trim().slice(0,60), version: crypto.randomUUID(), savedAt: Date.now() }
    if (!validProfile(profile)) throw new Error('Invalid profile')
    assertSymbolicOwner(owner)
    await db.localSymbolic.bulkPut([
      dirtyRecord(owner, id, 'birth-profile', profile, current),
      dirtyRecord(owner, 'profile:' + profile.version, 'profile-version', profile),
      dirtyRecord(owner, 'settings', 'settings', { activeProfileId: id, timeZone: settings?.timeZone ?? input.timeZone }, rows.find(r => r.id === 'settings')),
    ])
    return profile
  })
  signalSymbolicChange(); return result
}
export async function selectBirthProfile(owner: string, id: string) {
  await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const row = await db.localSymbolic.get([owner, id])
    if (!row || row.deleted || !validProfile(row.payload)) throw new Error('Profile unavailable')
    const settings = await db.localSymbolic.get([owner, 'settings'])
    const existing = settings?.payload as { timeZone?: string } | undefined
    await db.localSymbolic.put(dirtyRecord(owner, 'settings', 'settings', { activeProfileId: id, timeZone: existing?.timeZone ?? row.payload.timeZone }, settings))
  })
  signalSymbolicChange()
}
export async function deleteBirthProfile(owner: string, id: string) {
  await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const row = await db.localSymbolic.get([owner, id])
    if (!row || row.kind !== 'birth-profile') throw new Error('Profile unavailable')
    await db.localSymbolic.put({ ...dirtyRecord(owner, id, row.kind, null, row), deleted: true })
  })
  signalSymbolicChange()
}
export const dailyReadingId = (date: Date, timeZone: string) => 'daily:' + timeZone + ':' + localDateKey(date, timeZone)
/** Compatibility API for existing V1 records; new UI uses the persisted selection session. */
export async function createReading(owner: string, spread: 'daily' | 'three', timeZone: string, reverse: boolean, question: string, date = new Date()): Promise<TarotReading> {
  const id = spread === 'daily' ? dailyReadingId(date,timeZone) : 'reading:' + crypto.randomUUID()
  const result = await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const prior = await db.localSymbolic.get([owner,id])
    if (prior) { if (!validReading(prior.payload)) throw new Error('Invalid reading data'); return prior.payload }
    const reading: TarotReading = { id, createdAt: date.getTime(), timeZone, dateKey: localDateKey(date,timeZone), spread, question: question.trim().slice(0,300), cards: drawCards(spread === 'daily' ? 1 : 3, reverse), reflection: '', contentVersion: '1' }
    await db.localSymbolic.add(dirtyRecord(owner, id, 'tarot', reading))
    return reading
  })
  signalSymbolicChange(); return result
}
export async function startTarotSession(owner: string, options: { spread: TarotSpread; timeZone: string; reverse: boolean; question: string; context: TarotContext }, date?: Date): Promise<TarotSession> {
  const { symbolicNow } = await import('./sync')
  const moment = date ?? symbolicNow(owner)
  const id = 'session:' + crypto.randomUUID()
  const result = await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const existing = options.spread === 'daily' ? (await db.localSymbolic.where('ownerId').equals(owner).toArray()).find(r => r.kind === 'tarot-session' && !r.deleted && validSession(r.payload) && r.payload.spread === 'daily' && r.payload.timeZone === options.timeZone && r.payload.dateKey === localDateKey(moment, options.timeZone)) : undefined
    if (existing) { if (!validSession(existing.payload)) throw new Error('Invalid session'); return existing.payload }
    const deck = TAROT_DECK.map(c => ({ id: c.id, reversed: options.reverse && randomBelow(2) === 1, revealed: false }))
    for (let i = deck.length - 1; i > 0; i--) { const j = randomBelow(i+1); [deck[i], deck[j]] = [deck[j], deck[i]] }
    const session: TarotSession = { id, createdAt: moment.getTime(), dateKey: localDateKey(moment, options.timeZone), timeZone: options.timeZone, spread: options.spread,
      context: { ...options.context, question: options.question.trim().slice(0, 300) }, deck, selected: [] }
    if (!validSession(session)) throw new Error('Invalid session')
    await db.localSymbolic.add(dirtyRecord(owner, id, 'tarot-session', session))
    return session
  })
  signalSymbolicChange(); return result
}
export async function selectTarotCard(owner: string, sessionId: string, index: number): Promise<TarotSession> {
  const result = await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const row = await db.localSymbolic.get([owner, sessionId])
    if (!row || !validSession(row.payload)) throw new Error('Session unavailable')
    const session = row.payload
    if (session.completedReadingId || session.selected.length >= spreadSize[session.spread]) throw new Error('Selection is complete')
    if (!Number.isInteger(index) || index < 0 || index >= 78 || session.selected.includes(index)) throw new Error('Invalid card choice')
    const next = { ...session, selected: [...session.selected, index] }
    await db.localSymbolic.put(dirtyRecord(owner, sessionId, 'tarot-session', next, row))
    return next
  })
  signalSymbolicChange(); return result
}
export async function finishTarotSession(owner: string, sessionId: string, reports: { zh: InterpretationReport; en: InterpretationReport }): Promise<TarotReading> {
  assertSymbolicOwner(owner)
  const row = await db.localSymbolic.get([owner, sessionId])
  if (!row || !validSession(row.payload)) throw new Error('Session unavailable')
  const session = row.payload
  if (session.completedReadingId) {
    const previous = await db.localSymbolic.get([owner, session.completedReadingId])
    if (previous && validReading(previous.payload)) return previous.payload
  }
  if (session.selected.length !== spreadSize[session.spread]) throw new Error('Select all cards first')
  const id = session.spread === 'daily' ? dailyReadingId(new Date(session.createdAt), session.timeZone) : 'reading:' + session.id.slice(8)
  let reading: TarotReading = { id, createdAt: session.createdAt, timeZone: session.timeZone, dateKey: session.dateKey, spread: session.spread,
    question: session.context.question, context: session.context, cards: session.selected.map(i => ({ ...session.deck[i], revealed: false })), reflection: '', contentVersion: '2', reports }
  if (!validReading(reading)) throw new Error('Invalid reading report')
  if (owner !== 'guest' && session.spread === 'daily') {
    const { claimDailyReading, symbolicCloudEnabled } = await import('./sync')
    reading = symbolicCloudEnabled() ? await claimDailyReading(owner, reading) : { ...reading, serverConfirmed: false }
  }
  if (reading.id !== id) throw new Error('Daily date changed; reopen today’s draw')
  await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const currentSession = await db.localSymbolic.get([owner, sessionId])
    if (!currentSession || !validSession(currentSession.payload)) throw new Error('Session unavailable')
    const previous = await db.localSymbolic.get([owner, id])
    if (previous && validReading(previous.payload)) reading = previous.payload
    else await db.localSymbolic.put(dirtyRecord(owner, id, 'tarot', reading))
    await db.localSymbolic.put(dirtyRecord(owner, sessionId, 'tarot-session', { ...currentSession.payload, completedReadingId: reading.id }, currentSession))
  })
  signalSymbolicChange(); return reading
}
export async function updateReading(owner: string, id: string, change: { reveal?: number | 'all'; reflection?: string; expectedReflection?: string }) {
  await db.transaction('rw', db.localSymbolic, async () => {
    assertSymbolicOwner(owner)
    const row = await db.localSymbolic.get([owner,id])
    if (!row || row.deleted || !validReading(row.payload)) throw new Error('Reading unavailable')
    const reading = row.payload
    if (owner !== 'guest' && reading.spread === 'daily' && reading.contentVersion === '2' && !reading.archived && reading.serverConfirmed !== false && !row.revision) throw new Error('Connect to confirm today’s card first')
    if (change.expectedReflection !== undefined && reading.reflection !== change.expectedReflection) throw new Error('Reflection changed in another tab')
    const next = { ...reading, reflection: change.reflection === undefined ? reading.reflection : change.reflection.trim().slice(0,3000), cards: reading.cards.map((card,i) => ({ ...card, revealed: card.revealed || change.reveal === 'all' || change.reveal === i })) }
    await db.localSymbolic.put(dirtyRecord(owner, id, 'tarot', next, row))
  })
  signalSymbolicChange()
}

/** A backup is content, not a server acknowledgement. Never restore revision/pending metadata. */
export function prepareSymbolicRestore(rows: LocalSymbolicRecord[], existing: LocalSymbolicRecord[], owner: string): LocalSymbolicRecord[] {
  const byId = new Map(existing.map(row => [row.id, row]))
  const restored: LocalSymbolicRecord[] = []
  for (const input of rows) {
    if (input.kind === 'sync-meta' || input.deleted) continue
    const original = byId.get(input.id)
    if (original && original.updatedAt >= input.updatedAt) continue
    let id = input.id, kind = input.kind, payload = input.payload
    if (kind === 'profile' && validProfile(payload)) { id = 'birth:restored:' + payload.version; kind = 'birth-profile'; payload = { ...payload, id } }
    if (kind === 'tarot' && validReading(payload) && payload.spread === 'daily' && !payload.archived) {
      // Keep a recoverable historic reading, never create a second claim for today.
      id = 'archive:restore:' + input.id + ':' + input.updatedAt
      payload = { ...payload, id, archived: true, sourceId: input.id, serverConfirmed: false }
    }
    const current = byId.get(id)
    if (current && (current.updatedAt >= input.updatedAt || current.dirty || current.pending || current.conflict !== undefined)) continue
    if (kind === 'tarot-session' && validSession(payload)) {
      // A saved session may point at a daily record archived above; do not resume it as a fresh draw.
      if (payload.spread === 'daily') continue
    }
    if (current && kind === 'tarot') continue
    const next = dirtyRecord(owner, id, kind, payload, current)
    restored.push(next); byId.set(id, next)
  }
  return restored
}
