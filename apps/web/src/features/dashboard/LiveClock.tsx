import { memo, useEffect, useRef, useState } from 'react'
import { AppNumber, AppNumberGroup } from '../../shared/ui/AppNumber'

type LiveClockProps = {
  style?: React.CSSProperties
  className?: string
}

const timeTrend = (oldValue: number, value: number) => (value >= oldValue ? 1 : -1)

const LiveClock = memo(({ style, className }: LiveClockProps) => {
  const [now, setNow] = useState(() => new Date())
  const frameRef = useRef<number>(0)
  const lastSecondRef = useRef<number>(-1)

  useEffect(() => {
    const tick = () => {
      const current = new Date()
      const currentSecond = current.getSeconds()
      // Only update state if the second has actually changed
      if (currentSecond !== lastSecondRef.current) {
        lastSecondRef.current = currentSecond
        setNow(current)
      }
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const paddedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

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
        <span className="app-shell__hero-time-seconds-wrap" aria-hidden="true">
          :
          <AppNumber
            value={seconds}
            trend={timeTrend}
            format={{ minimumIntegerDigits: 2 }}
            className="app-shell__hero-time-seconds"
          />
        </span>
      </AppNumberGroup>
    </div>
  )
})

LiveClock.displayName = 'LiveClock'

export default LiveClock