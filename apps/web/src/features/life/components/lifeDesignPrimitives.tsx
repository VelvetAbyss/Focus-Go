/* eslint-disable react-refresh/only-export-components */
import type { CSSProperties, ReactNode } from 'react'

export const paper = 'var(--bg-elevated)'
export const ink = 'var(--text-primary)'
export const cardBg = 'var(--bg-elevated)'
export const mutedText = 'color-mix(in srgb, var(--text-primary) 45%, transparent)'
export const subtleText = 'color-mix(in srgb, var(--text-primary) 32%, transparent)'
export const subtleBorder = 'color-mix(in srgb, var(--text-primary) 9%, transparent)'
export const sectionBorder = 'color-mix(in srgb, var(--text-primary) 7%, transparent)'

export const inter = (size = 13, weight = 400, color = ink): CSSProperties => ({
  fontFamily: 'Inter, sans-serif',
  fontSize: size,
  fontWeight: weight,
  color,
})

export const playfair = (size = 16, weight = 500, color = ink): CSSProperties => ({
  fontFamily: '"Playfair Display", serif',
  fontSize: size,
  fontWeight: weight,
  color,
})

export const cardShellStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 280,
  borderRadius: 24,
  overflow: 'hidden',
  cursor: 'pointer',
  background: cardBg,
  border: '1px solid transparent',
  boxShadow: 'var(--shadow-card)',
}

export const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  padding: '20px 20px 16px',
  borderBottom: `1px solid ${sectionBorder}`,
}

export const cardArrowStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)',
  flexShrink: 0,
}

export const modalLayoutStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  background: paper,
}

export const modalHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '20px 24px 16px',
  borderBottom: `1px solid ${sectionBorder}`,
}

export const iconButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: ink,
  cursor: 'pointer',
}

export const sidebarStyle: CSSProperties = {
  width: 292,
  minWidth: 292,
  maxWidth: 292,
  flexShrink: 0,
  padding: 16,
  borderRight: `1px solid ${sectionBorder}`,
  overflowY: 'auto',
  overflowX: 'hidden',
}

export const detailPaneStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
}

export const inputStyle: CSSProperties = {
  ...inter(14, 400, ink),
  width: '100%',
  borderRadius: 10,
  border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
  background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
  padding: '10px 12px',
  outline: 'none',
}

export const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 108,
  resize: 'vertical',
}

export const smallButtonStyle: CSSProperties = {
  ...inter(11, 500, ink),
  border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
  background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)',
  borderRadius: 999,
  padding: '7px 12px',
  cursor: 'pointer',
}

export const dangerButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  color: '#9D4C4C',
  border: '1px solid rgba(157,76,76,0.18)',
  background: 'rgba(157,76,76,0.08)',
}

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <span style={{ ...inter(10, 600, mutedText), letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
    {children}
  </label>
)

export const LifeCardLoader = ({ lines = 3, compact = false }: { lines?: number; compact?: boolean }) => (
  <div className={`life-card-loader${compact ? ' life-card-loader--compact' : ''}`} data-testid="life-card-loader" aria-hidden="true">
    <div className="life-card-loader__hero" />
    <div className="life-card-loader__lines">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="life-card-loader__line"
          style={{ width: index === lines - 1 ? '58%' : index % 2 === 0 ? '100%' : '82%' }}
        />
      ))}
    </div>
    <div className="life-card-loader__stats">
      <span className="life-card-loader__pill" />
      <span className="life-card-loader__pill life-card-loader__pill--short" />
    </div>
  </div>
)

export const LifePanelLoader = ({ rows = 4 }: { rows?: number }) => (
  <div className="life-panel-loader" data-testid="life-panel-loader" aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="life-panel-loader__row">
        <span className="life-panel-loader__cover" />
        <div className="life-panel-loader__body">
          <span className="life-panel-loader__line" style={{ width: index % 2 === 0 ? '78%' : '66%' }} />
          <span className="life-panel-loader__line life-panel-loader__line--muted" style={{ width: index % 2 === 0 ? '54%' : '42%' }} />
        </div>
      </div>
    ))}
  </div>
)
