import { Temporal } from '@js-temporal/polyfill'
import { Lunar } from 'lunar-typescript'
import type { BirthInput } from './types'

export class BirthInputError extends Error {
  readonly code: 'date' | 'range' | 'lunar' | 'time' | 'zone' | 'coordinates' | 'ambiguous'
  constructor(code: BirthInputError['code']) { super(code); this.code = code }
}
export function solarDate(input: BirthInput): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new BirthInputError('date')
  const [y, m, d] = input.date.split('-').map(Number)
  if (y < 1901 || y > 2100) throw new BirthInputError('range')
  if (input.calendar === 'lunar') {
    try {
      const lunar = Lunar.fromYmd(y, input.leapMonth ? -m : m, d)
      if (lunar.getYear() !== y || lunar.getMonth() !== (input.leapMonth ? -m : m) || lunar.getDay() !== d) throw new Error('date')
      const converted = lunar.getSolar().toYmd()
      if (converted < '1901-01-01' || converted > '2100-12-31') throw new BirthInputError('range')
      return converted
    } catch (error) { if (error instanceof BirthInputError) throw error; throw new BirthInputError('lunar') }
  }
  try { return Temporal.PlainDate.from(input.date, { overflow: 'reject' }).toString() }
  catch { throw new BirthInputError('date') }
}
export function resolveBirth(input: BirthInput) {
  const date = solarDate(input)
  try { Temporal.Now.zonedDateTimeISO(input.timeZone) } catch { throw new BirthInputError('zone') }
  if ((input.latitude !== null && (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90)) || (input.longitude !== null && (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180))) throw new BirthInputError('coordinates')
  if (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new BirthInputError('time')
  const day = Temporal.PlainDate.from(date)
  const start = day.toZonedDateTime(input.timeZone)
  const end = day.add({ days: 1 }).toZonedDateTime(input.timeZone).subtract({ milliseconds: 1 })
  if (!start.toPlainDate().equals(day) || end.epochMilliseconds < start.epochMilliseconds) throw new BirthInputError('ambiguous')
  if (!input.time) return { date, instant: null, start: new Date(start.epochMilliseconds), end: new Date(end.epochMilliseconds), offset: null }
  try {
    const moment = Temporal.ZonedDateTime.from({ year: day.year, month: day.month, day: day.day, hour: Number(input.time.slice(0, 2)), minute: Number(input.time.slice(3)), timeZone: input.timeZone }, { overflow: 'reject', disambiguation: 'reject' })
    return { date, instant: new Date(moment.epochMilliseconds), start: new Date(start.epochMilliseconds), end: new Date(end.epochMilliseconds), offset: moment.offset }
  } catch { throw new BirthInputError('ambiguous') }
}
export function zonedParts(date: Date, zone: string) {
  const z = Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(zone)
  return { year: z.year, month: z.month, day: z.day, hour: z.hour, minute: z.minute, second: z.second }
}
export const localDateKey = (date: Date, zone: string) => Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(zone).toPlainDate().toString()
export const dateAtNoon = (date: string, zone: string) => new Date(Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: zone, plainTime: '12:00' }).epochMilliseconds)
