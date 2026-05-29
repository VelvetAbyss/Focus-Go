import type { ReactNode } from 'react'
import { ink, muted, tx } from './tokens'

/** Muted journal-friendly palette cycled across donut segments. */
export const CHART_PALETTE = ['#7C5A3A', '#5B8C5A', '#2E6EA6', '#B07830', '#7A3A7A', '#C0793A', '#3D7A4E', '#9A6A6A']

export type DonutSegment = { id: string; value: number; color: string; label?: string }

type DonutProps = {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  /** Optional centered content (e.g. total). */
  children?: ReactNode
}

/** Simple SVG donut chart. Segments with non-positive values are skipped. */
export const Donut = ({ segments, size = 132, thickness = 18, children }: DonutProps) => {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, seg) => sum + Math.max(0, seg.value), 0)
  let offset = 0

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(58,55,51,0.07)" strokeWidth={thickness} />
        {total > 0
          ? segments.map((seg) => {
              const value = Math.max(0, seg.value)
              if (value <= 0) return null
              const length = (value / total) * circumference
              const dash = `${length} ${circumference - length}`
              const node = (
                <circle
                  key={seg.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              )
              offset += length
              return node
            })
          : null}
      </svg>
      {children ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

type ProgressRingProps = {
  /** 0..100 */
  percent: number
  size?: number
  thickness?: number
  color?: string
  trackColor?: string
  children?: ReactNode
}

/** Circular progress indicator with optional centered label. */
export const ProgressRing = ({
  percent,
  size = 64,
  thickness = 7,
  color = ink,
  trackColor = 'rgba(58,55,51,0.10)',
  children,
}: ProgressRingProps) => {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const dash = (clamped / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children ?? <span style={tx(13, 600, clamped >= 100 ? '#3D7A4E' : muted)}>{Math.round(clamped)}%</span>}
      </div>
    </div>
  )
}
