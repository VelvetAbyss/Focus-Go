import type { ReactNode } from 'react'
import { muted, pf, tx } from './tokens'

export const EmptyJournal = ({ icon = '✦', title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gap: 10,
      placeItems: 'center',
      padding: '32px 16px',
      textAlign: 'center',
    }}
  >
    <span aria-hidden style={{ fontSize: 32, opacity: 0.5 }}>{icon}</span>
    <div style={pf(18, 500)}>{title}</div>
    {hint ? <p style={{ ...tx(12, 400, muted), maxWidth: 320 }}>{hint}</p> : null}
    {action ? <div style={{ marginTop: 6 }}>{action}</div> : null}
  </div>
)
