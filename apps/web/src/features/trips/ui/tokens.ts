import type { CSSProperties } from 'react'

export const paper = 'var(--bg-elevated)'
export const cardBg = 'var(--bg-elevated)'
export const ink = 'var(--text-primary)'
export const muted = 'color-mix(in srgb, var(--text-primary) 45%, transparent)'
export const subtleBorder = 'color-mix(in srgb, var(--text-primary) 9%, transparent)'
export const accent = '#7C5A3A'
export const danger = '#C05050'
export const success = '#5B8C5A'

export const tx = (size = 13, weight: 400 | 500 | 600 | 700 = 400, color: string = ink): CSSProperties => ({
  fontFamily: 'Inter, sans-serif',
  fontSize: size,
  fontWeight: weight,
  color,
})

export const pf = (size = 16, weight: 400 | 500 | 600 | 700 = 500, color: string = ink): CSSProperties => ({
  fontFamily: '"Playfair Display", serif',
  fontSize: size,
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
