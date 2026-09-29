import { memo, useEffect, useRef, useState } from 'react'
import { AppNumber, AppNumberGroup } from '../../shared/ui/AppNumber'
import { usePageActivity } from '../../shared/hooks/usePageActivity'

type LiveClockProps = {
  style?: React.CSSProperties
  className?: string
  /** Off: hours and minutes only, re-rendering once a minute. */
  showSeconds?: boolean
}

const timeTrend = (oldValue: number, value: number) => (value >= oldValue ? 1 : -1)

const LiveClock = memo(({ style, className, showSeconds = true }: LiveClockProps) => {
  const [now, setNow] = useState(() => new Date())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageActivity = usePageActivity()

  useEffect(() => {
    if (pageActivity !== 'visible') return

    const step = showSeconds ? 1000 : 60000
    const scheduleNext = () => {
      // Align to the next second (or minute) boundary to avoid drift
      const msUntilNextTick = step - (Date.now() % step)
      timerRef.current = setTimeout(() => {
        setNow(new Date())
        scheduleNext()
      }, msUntilNextTick)
    }

    setNow(new Date())
    scheduleNext()

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [pageActivity, showSeconds])

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const paddedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${showSeconds ? `:${String(seconds).padStart(2, '0')}` : ''}`

  return (
    <div
      className={className}
      style={style}
      aria-label={`Current time ${paddedTime}`}
    >
      <AppNumberGroup>
        <AppNumber
          value={hours}
          trend={timeTrend}
          format={{ minimumIntegerDigits: 2 }}
          className="app-shell__hero-time-main"
        />
        <span className="app-shell__hero-time-colon" aria-hidden="true">
          :
        </span>
        <AppNumber
          value={minutes}
          trend={timeTrend}
          format={{ minimumIntegerDigits: 2 }}
          className="app-shell__hero-time-main"
        />
        {showSeconds ? (
          <span className="app-shell__hero-time-seconds-wrap" aria-hidden="true">
            :
            <AppNumber
              value={seconds}
              trend={timeTrend}
              format={{ minimumIntegerDigits: 2 }}
              className="app-shell__hero-time-seconds"
            />
          </span>
        ) : null}
      </AppNumberGroup>
    </div>
  )
})

LiveClock.displayName = 'LiveClock'

export default LiveClock
