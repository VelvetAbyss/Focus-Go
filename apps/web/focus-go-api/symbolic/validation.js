import { Lunar } from 'lunar-typescript'
import { Temporal } from '@js-temporal/polyfill'
// Boundary validation for private Labs records. Interpretation content is data, never executable.
const obj = v => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v, max = 300) => typeof v === 'string' && v.length <= max
const finite = v => typeof v === 'number' && Number.isFinite(v)
const strings = (v, max = 30) => Array.isArray(v) && v.length <= max && v.every(s => text(s, 8000))
export const spreadSize = { daily: 1, three: 3, choice: 5, relationship: 5 }
const ids = new Set([...Array.from({ length: 22 }, (_, i) => 'major-' + i), ...['wands', 'cups', 'swords', 'pentacles'].flatMap(s => Array.from({ length: 14 }, (_, i) => s + '-' + (i + 1)))])
export const validZone = z => {
  if (!text(z, 80) || !z) return false
  if (/^[+-](0\d|1\d|2[0-3]):[0-5]\d$/.test(z)) return true
  try { new Intl.DateTimeFormat('en', { timeZone: z }).format(); return true } catch { return false }
}
export const dateKey = (date, zone) => {
  const offset = /^([+-])(\d{2}):(\d{2})$/.exec(zone)
  if (offset) return new Date(date.getTime() + (offset[1] === '-' ? -1 : 1) * (+offset[2] * 60 + +offset[3]) * 60000).toISOString().slice(0, 10)
  const parts = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  return ['year', 'month', 'day'].map(p => parts.find(i => i.type === p).value).join('-')
}
const validCards = (v, size) => Array.isArray(v) && v.length === size && v.every(c => obj(c) && ids.has(c.id) && typeof c.reversed === 'boolean' && typeof c.revealed === 'boolean') && new Set(v.map(c => c.id)).size === size
const validReportMetadata = v => {
  if (v.period !== undefined && (!obj(v.period) || !text(v.period.start, 100) || !text(v.period.end, 100) || !text(v.period.label, 300) || (v.period.timeZone !== undefined && !text(v.period.timeZone, 80)))) return false
  if (v.scores !== undefined && (!obj(v.scores) || !['overall', 'career', 'money', 'love'].every(key => v.scores[key] === null || finite(v.scores[key]) && v.scores[key] >= 0 && v.scores[key] <= 100))) return false
  return true
}
export const validReport = v => obj(v) && validReportMetadata(v) && text(v.id, 300) && text(v.version, 80) && text(v.title, 1000) && text(v.summary, 12000) && Array.isArray(v.sections) && v.sections.length <= 30 && v.sections.every(s => obj(s) && text(s.id) && text(s.title, 1000) && text(s.summary, 12000) && strings(s.paragraphs) && strings(s.evidence) && strings(s.suggestions)) && strings(v.dos) && strings(v.donts) && strings(v.method) && strings(v.limitations)
export const validContext = v => obj(v) && ['general', 'career', 'money', 'love'].includes(v.topic) && ['development', 'action', 'choice', 'relationship'].includes(v.intent) && text(v.question, 300) && text(v.optionA, 120) && text(v.optionB, 120)
const validBirthDate = v => {
  if (typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return false
  const [y,m,d] = v.date.split('-').map(Number)
  if (y < 1901 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false
  try {
    let date = v.date
    if (v.calendar === 'lunar') {
      const month = v.leapMonth ? -m : m
      const lunar = Lunar.fromYmd(y, month, d)
      if (lunar.getYear() !== y || lunar.getMonth() !== month || lunar.getDay() !== d) return false
      date = lunar.getSolar().toYmd()
    }
    if (date < '1901-01-01' || date > '2100-12-31') return false
    const day = Temporal.PlainDate.from(date, { overflow: 'reject' })
    const start = day.toZonedDateTime(v.timeZone)
    const end = day.add({ days: 1 }).toZonedDateTime(v.timeZone).subtract({ milliseconds: 1 })
    if (!start.toPlainDate().equals(day) || end.epochMilliseconds < start.epochMilliseconds) return false
    if (v.time) Temporal.ZonedDateTime.from({ year: day.year, month: day.month, day: day.day, hour: Number(v.time.slice(0, 2)), minute: Number(v.time.slice(3)), timeZone: v.timeZone }, { overflow: 'reject', disambiguation: 'reject' })
    return true
  } catch { return false }
}
export const validProfile = v => obj(v) && text(v.name, 60) && text(v.version, 120) && finite(v.savedAt) && validBirthDate(v) && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && Number(v.date.slice(0, 4)) >= 1901 && Number(v.date.slice(0, 4)) <= 2100 && (v.time === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) && validZone(v.timeZone) && ['solar', 'lunar'].includes(v.calendar) && typeof v.leapMonth === 'boolean' && [1, 2].includes(v.zi) && ['', 'male', 'female'].includes(v.direction) && (v.latitude === null || finite(v.latitude) && Math.abs(v.latitude) <= 90) && (v.longitude === null || finite(v.longitude) && Math.abs(v.longitude) <= 180) && (v.id === undefined || text(v.id, 160)) && (v.place === undefined || text(v.place, 120)) && (v.relationship === undefined || text(v.relationship, 60))
export const validReading = v => {
  if (!obj(v) || !text(v.id, 240) || !finite(v.createdAt) || !validZone(v.timeZone) || !text(v.question, 300) || !text(v.reflection, 3000) || !['1', '2'].includes(v.contentVersion) || !validCards(v.cards, spreadSize[v.spread])) return false
  try { if (dateKey(new Date(v.createdAt), v.timeZone) !== v.dateKey) return false } catch { return false }
  if (v.spread === 'daily' && !v.archived && v.id !== 'daily:' + v.timeZone + ':' + v.dateKey) return false
  if (v.archived !== undefined && typeof v.archived !== 'boolean' || v.sourceId !== undefined && !text(v.sourceId, 240) || v.serverConfirmed !== undefined && typeof v.serverConfirmed !== 'boolean') return false
  if (v.contentVersion === '2' && (!validContext(v.context) || !obj(v.reports) || !validReport(v.reports.zh) || !validReport(v.reports.en))) return false
  return true
}
const dateMatches = v => { try { return dateKey(new Date(v.createdAt), v.timeZone) === v.dateKey } catch { return false } }
export const validSession = v => obj(v) && dateMatches(v) && text(v.dateKey, 10) && text(v.id, 240) && finite(v.createdAt) && validZone(v.timeZone) && validContext(v.context) && !!spreadSize[v.spread] && validCards(v.deck, 78) && Array.isArray(v.selected) && v.selected.length <= spreadSize[v.spread] && new Set(v.selected).size === v.selected.length && v.selected.every(i => Number.isInteger(i) && i >= 0 && i < 78) && (v.completedReadingId === undefined || text(v.completedReadingId, 240))
export const validRecord = r => {
  if (!obj(r) || !text(r.id, 240) || !r.id || !finite(r.updatedAt) || !Number.isInteger(r.baseRevision) || r.baseRevision < 0 || !text(r.operationId, 120) || !r.operationId || typeof r.deleted !== 'boolean') return false
  if (r.deleted) return ['birth-profile', 'profile-version', 'tarot', 'tarot-session', 'settings'].includes(r.kind) && r.payload === null
  const p = r.payload
  if (r.kind === 'birth-profile') return validProfile(p) && p.id === r.id
  if (r.kind === 'profile-version') return validProfile(p) && r.id === 'profile:' + p.version
  if (r.kind === 'tarot') return validReading(p) && p.id === r.id
  if (r.kind === 'tarot-session') return validSession(p) && p.id === r.id
  if (r.kind === 'settings') return r.id === 'settings' && obj(p) && (p.activeProfileId === null || text(p.activeProfileId, 160)) && validZone(p.timeZone)
  return false
}
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export const validChange = (previous, next) => {
  if (!previous || previous.deleted) return true
  if (next.deleted) return previous.kind !== 'tarot' && previous.kind !== 'tarot-session'
  if (previous.kind !== next.kind) return false
  if (next.kind === 'profile-version') return same(previous.payload, next.payload)
  if (next.kind === 'tarot') {
    const { reflection: _a, cards: a, ...fixedA } = previous.payload
    const { reflection: _b, cards: b, ...fixedB } = next.payload
    return same(fixedA, fixedB) && a.every((c, i) => c.id === b[i]?.id && c.reversed === b[i]?.reversed && (!c.revealed || b[i].revealed))
  }
  if (next.kind === 'tarot-session') {
    const { selected: a, completedReadingId: aId, ...fixedA } = previous.payload
    const { selected: b, completedReadingId: bId, ...fixedB } = next.payload
    return same(fixedA, fixedB) && a.every((n, i) => b[i] === n) && (!aId || aId === bId)
  }
  return true
}
