import type { CSSProperties } from 'react'

export const paper = '#F5F3F0'
export const cardBg = '#FDFAF7'
export const ink = '#3A3733'
export const muted = 'rgba(58,55,51,0.45)'
export const subtleBorder = 'rgba(58,55,51,0.09)'
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
  background: '#FFFCF9',
  padding: '10px 12px',
  outline: 'none',
  ...tx(13, 400),
}

export const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 88, resize: 'vertical' }

export const skeletonBlock = (style?: CSSProperties): CSSProperties => ({
  borderRadius: 18,
  background: 'linear-gradient(90deg, rgba(58,55,51,0.05) 0%, rgba(58,55,51,0.11) 50%, rgba(58,55,51,0.05) 100%)',
  backgroundSize: '200% 100%',
  animation: 'life-loader-shimmer 1.35s ease-in-out infinite',
  ...style,
})
