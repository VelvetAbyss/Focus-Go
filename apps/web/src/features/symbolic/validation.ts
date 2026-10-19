import { tarotById } from '../tarot/deck'
import { localDateKey, resolveBirth } from './time'
import type { BirthProfile, TarotReading, TarotSession, TarotContext } from './types'
import type { InterpretationReport } from './report'
import type { LocalSymbolicRecord } from '../../data/models/types'
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 300): value is string => typeof value === 'string' && value.length <= max
const strings = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every(v => text(v, 8000))
export const spreadSize = { daily: 1, three: 3, choice: 5, relationship: 5 } as const
export const validProfile = (value: unknown): value is BirthProfile => {
  if (!object(value) || !text(value.name, 60) || !text(value.version, 120) || !Number.isFinite(value.savedAt) || typeof value.date !== 'string' || typeof value.time !== 'string' || typeof value.timeZone !== 'string' || !['solar','lunar'].includes(String(value.calendar)) || typeof value.leapMonth !== 'boolean' || (value.zi !== 1 && value.zi !== 2) || !['','male','female'].includes(String(value.direction))) return false
  if (!(value.latitude === null || typeof value.latitude === 'number') || !(value.longitude === null || typeof value.longitude === 'number')) return false
  if ((value.id !== undefined && !text(value.id, 160)) || (value.place !== undefined && !text(value.place, 120)) || (value.relationship !== undefined && !text(value.relationship, 60))) return false
  try { resolveBirth(value as BirthProfile); return true } catch { return false }
}
const validCards = (value: unknown, length: number) => Array.isArray(value) && value.length === length && value.every(c => object(c) && tarotById.has(String(c.id)) && typeof c.reversed === 'boolean' && typeof c.revealed === 'boolean') && new Set(value.map(c => c.id)).size === length
export const validContext = (v: unknown): v is TarotContext => object(v) && ['general','career','money','love'].includes(String(v.topic)) && ['action','development','choice','relationship'].includes(String(v.intent)) && text(v.question, 300) && text(v.optionA, 120) && text(v.optionB, 120)
const validReportMetadata = (v: Record<string, unknown>) => {
  if (v.period !== undefined && (!object(v.period) || !text(v.period.start, 100) || !text(v.period.end, 100) || !text(v.period.label, 300) || (v.period.timeZone !== undefined && !text(v.period.timeZone, 80)))) return false
  if (v.scores !== undefined) {
    const scores = v.scores
    if (!object(scores) || !['overall', 'career', 'money', 'love'].every(key => scores[key] === null || typeof scores[key] === 'number' && Number.isFinite(scores[key]) && scores[key] >= 0 && scores[key] <= 100)) return false
  }
  return true
}
export const validReport = (v: unknown): v is InterpretationReport => object(v) && validReportMetadata(v) && text(v.id) && text(v.version, 80) && text(v.title, 1000) && text(v.summary, 12000) && Array.isArray(v.sections) && v.sections.length <= 30 && v.sections.every(s => object(s) && text(s.id) && text(s.title, 1000) && text(s.summary, 12000) && strings(s.paragraphs) && strings(s.evidence) && strings(s.suggestions)) && strings(v.dos) && strings(v.donts) && strings(v.method) && strings(v.limitations)
export const validReading = (value: unknown): value is TarotReading => {
  if (!object(value) || !text(value.id, 240) || typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || typeof value.timeZone !== 'string' || typeof value.dateKey !== 'string' || !text(value.question, 300) || !text(value.reflection, 3000) || !['1','2'].includes(String(value.contentVersion)) || !['daily','three','choice','relationship'].includes(String(value.spread)) || !validCards(value.cards, spreadSize[value.spread as keyof typeof spreadSize])) return false
  try { if (localDateKey(new Date(value.createdAt),value.timeZone) !== value.dateKey) return false } catch { return false }
  if (value.spread === 'daily' && !value.archived && value.id !== 'daily:' + value.timeZone + ':' + value.dateKey) return false
  if (value.archived !== undefined && typeof value.archived !== 'boolean') return false
  if (value.sourceId !== undefined && !text(value.sourceId, 240)) return false
  if (value.serverConfirmed !== undefined && typeof value.serverConfirmed !== 'boolean') return false
  if (value.contentVersion === '2' && (!validContext(value.context) || !object(value.reports) || !validReport(value.reports.zh) || !validReport(value.reports.en))) return false
  return true
}
export const validSession = (v: unknown): v is TarotSession => {
  if (!object(v) || !text(v.id, 240) || typeof v.createdAt !== 'number' || !Number.isFinite(v.createdAt) || typeof v.timeZone !== 'string' || typeof v.dateKey !== 'string' || !['daily','three','choice','relationship'].includes(String(v.spread)) || !validContext(v.context) || !validCards(v.deck, 78) || !Array.isArray(v.selected) || v.selected.length > spreadSize[v.spread as keyof typeof spreadSize] || new Set(v.selected).size !== v.selected.length || !v.selected.every(i => Number.isInteger(i) && i >= 0 && i < 78) || (v.completedReadingId !== undefined && !text(v.completedReadingId, 240))) return false
  try { return localDateKey(new Date(v.createdAt), v.timeZone) === v.dateKey } catch { return false }
}
export const validSymbolicRecord = (row: unknown): row is LocalSymbolicRecord => {
  if (!object(row) || typeof row.ownerId !== 'string' || !row.ownerId || typeof row.id !== 'string' || row.schemaVersion !== 1 || !Number.isFinite(row.updatedAt)) return false
  if (row.deleted) return ['profile','birth-profile','profile-version','tarot','tarot-session','settings'].includes(String(row.kind))
  if (row.kind === 'tarot') return validReading(row.payload) && row.payload.id === row.id
  if (row.kind === 'tarot-session') return validSession(row.payload) && row.payload.id === row.id
  if (row.kind === 'profile') return row.id === 'profile' && validProfile(row.payload)
  if (row.kind === 'birth-profile') return validProfile(row.payload) && row.id === row.payload.id
  if (row.kind === 'profile-version') return validProfile(row.payload) && row.id === 'profile:' + row.payload.version
  if (row.kind === 'settings') {
    if (row.id !== 'settings' || !object(row.payload) || !(row.payload.activeProfileId === null || text(row.payload.activeProfileId, 160)) || !text(row.payload.timeZone, 80)) return false
    try { localDateKey(new Date(), row.payload.timeZone); return true } catch { return false }
  }
  return row.kind === 'sync-meta' && row.id === 'sync-meta' && object(row.payload) && text(row.payload.generation, 120) && typeof row.payload.cursor === 'number' && Number.isSafeInteger(row.payload.cursor) && row.payload.cursor >= 0 && text(row.payload.timeZone, 80)
}
