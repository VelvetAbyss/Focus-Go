import type { CSSProperties, ReactNode } from 'react'
import { cardBg, subtleBorder } from './tokens'

export const Ticket = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      position: 'relative',
      background: cardBg,
      border: `1px solid ${subtleBorder}`,
      borderRadius: 12,
      padding: 14,
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
      ...style,
    }}
  >
    <span
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '34%',
        width: 0,
        borderLeft: `1px dashed ${subtleBorder}`,
      }}
    />
    {children}
  </div>
)
