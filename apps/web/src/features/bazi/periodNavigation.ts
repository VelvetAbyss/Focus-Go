import { Temporal } from '@js-temporal/polyfill'

/** Reports use noon to select a solar-term period; step across its actual boundary. */
export function baziAdjacentPeriodDate(period: {start:string;end:string}, direction:-1|1):string|null {
  const boundary=Temporal.Instant.from(direction>0?period.end:period.start).toZonedDateTimeISO('+08:00')
  const day=boundary.toPlainDate()
  const noon=day.toZonedDateTime({timeZone:'+08:00',plainTime:'12:00'})
  const next=direction>0
    ? (noon.epochMilliseconds<boundary.epochMilliseconds?day.add({days:1}):day)
    : (noon.epochMilliseconds>=boundary.epochMilliseconds?day.subtract({days:1}):day)
  const date=next.toString()
  return date>='1901-01-01'&&date<='2100-12-31'?date:null
}
