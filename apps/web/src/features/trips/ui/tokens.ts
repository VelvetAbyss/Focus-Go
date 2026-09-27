import type { CSSProperties } from 'react'
import { scaleFontSize } from '../../../shared/theme/typeScale'

export const paper = 'var(--paper-raised)'
export const cardBg = 'var(--paper-raised)'
export const ink = 'var(--ink-1)'
// Secondary text must stay ≥4.5:1 (DESIGN.md › Color): ink-3, not a 45% tint.
export const muted = 'var(--ink-3)'
export const subtleBorder = 'var(--rule)'
export const accent = 'var(--accent)'
export const danger = 'var(--tone-urgent)'
export const success = 'var(--tone-done)'

export const tx = (size = 13, weight: 400 | 500 | 600 | 700 = 400, color: string = ink): CSSProperties => ({
  fontFamily: 'var(--font-body)',
  fontSize: scaleFontSize(size),
  fontWeight: weight,
  color,
})

export const pf = (size = 16, weight: 400 | 500 | 600 | 700 = 500, color: string = ink): CSSProperties => ({
  fontFamily: 'var(--font-display)',
  fontSize: scaleFontSize(size),
  fontWeight: weight,
  color,
})

export const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: `1px solid ${subtleBorder}`,
  background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
  padding: '10px 12px',
  outline: 'none',
  ...tx(13, 400),
}

export const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 88, resize: 'vertical' }

export const skeletonBlock = (style?: CSSProperties): CSSProperties => ({
  borderRadius: 18,
  background: 'linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 5%, transparent) 0%, color-mix(in srgb, var(--text-primary) 11%, transparent) 50%, color-mix(in srgb, var(--text-primary) 5%, transparent) 100%)',
  backgroundSize: '200% 100%',
  animation: 'life-loader-shimmer 1.35s ease-in-out infinite',
  ...style,
})
