import type { CSSProperties, ReactNode } from 'react'
import { cardBg, muted, pf, subtleBorder, tx } from './tokens'

export const PaperCard = ({ children, style, tape }: { children: ReactNode; style?: CSSProperties; tape?: boolean }) => (
  <div
    style={{
      position: 'relative',
      background: cardBg,
      border: `1px solid ${subtleBorder}`,
      borderRadius: 16,
      boxShadow: '0 1px 6px rgba(0, 0, 0, 0.05)',
      ...style,
    }}
  >
    {tape ? (
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: -10,
          left: '50%',
          transform: 'translateX(-50%) rotate(-2deg)',
          width: 92,
          height: 18,
          background: 'rgba(212,180,120,0.32)',
          borderRadius: 2,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
        }}
      />
    ) : null}
    {children}
  </div>
)

export const Hairline = () => <div style={{ height: 1, background: subtleBorder }} />

export const SerifHeading = ({ children, size = 22 }: { children: ReactNode; size?: number }) => (
  <h2 style={pf(size, 500)}>{children}</h2>
)

export const JournalLabel = ({ children }: { children: ReactNode }) => (
  <span style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>{children}</span>
)

export const SectionHeading = ({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
    <div>
      <SerifHeading>{title}</SerifHeading>
      {meta ? <p style={{ ...tx(12, 400, muted), marginTop: 6 }}>{meta}</p> : null}
    </div>
    {action}
  </div>
)
