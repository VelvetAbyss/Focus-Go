import { useMemo, type CSSProperties } from 'react'
import { daylightAt, sunElevation, type Daylight } from './solar'

const SAMPLES = 96 // one every 15 minutes
const DAY_MS = 86400000

const STOP_COLOR: Record<Daylight, string> = {
  day: 'var(--wc-strip-day)',
  golden: 'var(--wc-strip-golden)',
  twilight: 'var(--wc-strip-twilight)',
  night: 'var(--wc-strip-night)',
}

/** City-local hour for an instant, from a fixed UTC offset in minutes. */
const localHour = (time: number, offsetMinutes: number) => {
  const minutes = (((time / 60000 + offsetMinutes) % 1440) + 1440) % 1440
  return minutes / 60
}

type Props = {
  latitude: number
  longitude: number
  /** City UTC offset in minutes (from Intl), used for work hours and midnight. */
  offsetMinutes: number
  /** Start of the viewer's local day; the strip spans 24 hours from here. */
  axisStart: number
  now: number
}

/**
 * One city's day on the viewer's clock. The fill is the real light at that
 * place (sun elevation): day, the low golden sun, civil twilight, night. Work
 * hours at the city are a dashed pencil line underneath; the city's midnight
 * is a tick; now is the pen, at the same x on every row.
 */
const DaylightStrip = ({ latitude, longitude, offsetMinutes, axisStart, now }: Props) => {
  const minuteBucket = Math.floor(now / 60000)

  const { stops, workSpans, midnights } = useMemo(() => {
    const stops: { offset: number; color: string }[] = []
    const workSpans: [number, number][] = []
    const midnights: number[] = []
    let workStart: number | null = null
    let prevHour: number | null = null
    for (let i = 0; i <= SAMPLES; i++) {
      const f = i / SAMPLES
      const time = axisStart + f * DAY_MS
      stops.push({ offset: f, color: STOP_COLOR[daylightAt(sunElevation(new Date(time), latitude, longitude))] })
      const hour = localHour(time, offsetMinutes)
      const working = hour >= 9 && hour < 18
      if (working && workStart === null) workStart = f
      if (!working && workStart !== null) {
        workSpans.push([workStart, f])
        workStart = null
      }
      if (prevHour !== null && hour < prevHour) midnights.push(f)
      prevHour = hour
    }
    if (workStart !== null) workSpans.push([workStart, 1])
    return { stops, workSpans, midnights }
    // Recomputed every ten minutes; light at a place changes slower than that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, offsetMinutes, axisStart, Math.floor(minuteBucket / 10)])

  const nowX = Math.min(1, Math.max(0, (now - axisStart) / DAY_MS)) * 100

  const background = `linear-gradient(90deg, ${stops.map((stop) => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`).join(', ')})`

  return (
    <div className="wc-strip" aria-hidden="true">
      <div className="wc-strip__band" style={{ background }}>
        {midnights.map((x) => (
          <span key={x} className="wc-strip__midnight" style={{ left: `${x * 100}%` }} />
        ))}
      </div>
      {workSpans.map(([a, b]) => (
        <span key={a} className="wc-strip__work" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` } as CSSProperties} />
      ))}
      <span className="wc-strip__now" style={{ left: `${nowX}%` }} />
    </div>
  )
}

export default DaylightStrip
