import type { CSSProperties, ReactNode } from 'react'
import { muted, subtleBorder, tx } from './tokens'

export const RAIL_HOUR_HEIGHT = 56
export const RAIL_START_HOUR = 6
export const RAIL_END_HOUR = 24

export const minutesToY = (minutes: number) => ((minutes / 60) - RAIL_START_HOUR) * RAIL_HOUR_HEIGHT
export const hhmmToMinutes = (hhmm: string): number | null => {
  const m = hhmm.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export const TimelineRail = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => {
  const hours: number[] = []
  for (let h = RAIL_START_HOUR; h <= RAIL_END_HOUR; h++) hours.push(h)
  const totalHeight = (RAIL_END_HOUR - RAIL_START_HOUR) * RAIL_HOUR_HEIGHT
  return (
    <div style={{ position: 'relative', height: totalHeight, paddingLeft: 56, ...style }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {hours.map((h) => (
          <div
            key={h}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: (h - RAIL_START_HOUR) * RAIL_HOUR_HEIGHT,
              borderTop: `1px dashed ${subtleBorder}`,
            }}
          >
            <span style={{ position: 'absolute', left: 0, top: -8, ...tx(10, 500, muted) }}>{`${String(h).padStart(2, '0')}:00`}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', height: '100%' }}>{children}</div>
    </div>
  )
}
