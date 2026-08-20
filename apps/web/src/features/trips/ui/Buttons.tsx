import type { CSSProperties, ReactNode } from 'react'
import { danger as dangerColor, ink, subtleBorder, tx } from './tokens'

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  ariaLabel?: string
  style?: CSSProperties
  type?: 'button' | 'submit'
}

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 999,
  padding: '9px 12px',
  cursor: 'pointer',
  border: `1px solid ${subtleBorder}`,
}

export const InkButton = ({ children, onClick, disabled, ariaLabel, style, type = 'button' }: ButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    style={{
      ...base,
      background: 'var(--bg-elevated)',
      ...tx(12, 600, ink),
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style,
    }}
  >
    {children}
  </button>
)

export const GhostButton = ({ children, onClick, disabled, ariaLabel, style, type = 'button' }: ButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    style={{
      ...base,
      background: 'transparent',
      border: 'none',
      ...tx(12, 600, ink),
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style,
    }}
  >
    {children}
  </button>
)

export const DangerButton = ({ children, onClick, disabled, ariaLabel, style, type = 'button' }: ButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    style={{
      ...base,
      border: `1px solid rgba(192,80,80,0.22)`,
      background: 'rgba(192,80,80,0.08)',
      ...tx(12, 600, dangerColor),
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      ...style,
    }}
  >
    {children}
  </button>
)
