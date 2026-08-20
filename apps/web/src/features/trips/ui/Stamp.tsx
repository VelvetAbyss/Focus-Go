import type { CSSProperties } from 'react'
import { tx } from './tokens'

const palettes: Record<string, { fg: string; bg: string; border: string }> = {
  planning: { fg: '#7C5A3A', bg: 'rgba(124,90,58,0.08)', border: 'rgba(124,90,58,0.35)' },
  booked: { fg: '#3D6B5C', bg: 'rgba(61,107,92,0.08)', border: 'rgba(61,107,92,0.35)' },
  ready: { fg: '#3D5A8C', bg: 'rgba(61,90,140,0.08)', border: 'rgba(61,90,140,0.35)' },
  ongoing: { fg: '#A65B2E', bg: 'rgba(166,91,46,0.08)', border: 'rgba(166,91,46,0.4)' },
  done: { fg: '#5C5246', bg: 'rgba(92,82,70,0.06)', border: 'rgba(92,82,70,0.3)' },
}

export const Stamp = ({ label, tone = 'planning', tilt = -3, style }: { label: string; tone?: keyof typeof palettes; tilt?: number; style?: CSSProperties }) => {
  const palette = palettes[tone] ?? palettes.planning
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 10px',
        border: `1.5px dashed ${palette.border}`,
        borderRadius: 4,
        background: palette.bg,
        color: palette.fg,
        transform: `rotate(${tilt}deg)`,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        ...tx(10, 700, palette.fg),
        ...style,
      }}
    >
      {label}
    </span>
  )
}
