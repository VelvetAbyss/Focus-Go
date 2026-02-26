import type { ThemeMode } from './theme'

export type ThemePackId = 'theme-a' | 'theme-b' | 'theme-c'

export type ThemePalette = {
  bg: string
  bgElevated: string
  bgMuted: string
  accent: string
  accentSoft: string
  primaryHsl: string
  ringHsl: string
}

export const THEME_BEFORE_MODE_TOGGLE_EVENT = 'focus-theme:before-mode-toggle'

const THEME_PACK_PALETTES: Record<ThemePackId, Record<ThemeMode, ThemePalette>> = {
  'theme-a': {
    light: {
      bg: '#f6f5f2',
      bgElevated: '#ffffff',
      bgMuted: '#efece7',
      accent: '#1b4f4a',
      accentSoft: '#e0edea',
      primaryHsl: '164 49% 21%',
      ringHsl: '164 49% 21%',
    },
    dark: {
      bg: '#151617',
      bgElevated: '#1b1d1f',
      bgMuted: '#212428',
      accent: '#7edbc7',
      accentSoft: '#1f2c28',
      primaryHsl: '164 57% 68%',
      ringHsl: '164 57% 68%',
    },
  },
  'theme-b': {
    light: {
      bg: '#f2f7fb',
      bgElevated: '#ffffff',
      bgMuted: '#e6eef7',
      accent: '#245a94',
      accentSoft: '#dde8f7',
      primaryHsl: '211 60% 36%',
      ringHsl: '211 60% 36%',
    },
    dark: {
      bg: '#121823',
      bgElevated: '#182130',
      bgMuted: '#1e2a3d',
      accent: '#74b9ff',
      accentSoft: '#1d2d45',
      primaryHsl: '208 100% 73%',
      ringHsl: '208 100% 73%',
    },
  },
  'theme-c': {
    light: {
      bg: '#fff5ee',
      bgElevated: '#fffdfa',
      bgMuted: '#fbe8da',
      accent: '#9f4a2b',
      accentSoft: '#f6dfd2',
      primaryHsl: '17 58% 40%',
      ringHsl: '17 58% 40%',
    },
    dark: {
      bg: '#231713',
      bgElevated: '#2b1d18',
      bgMuted: '#34241e',
      accent: '#ffb089',
      accentSoft: '#462f27',
      primaryHsl: '23 100% 77%',
      ringHsl: '23 100% 77%',
    },
  },
}

const THEME_PREVIEW_VAR_MAP = {
  bg: '--bg',
  bgElevated: '--bg-elevated',
  bgMuted: '--bg-muted',
  accent: '--accent',
  accentSoft: '--accent-soft',
  primaryHsl: '--primary',
  ringHsl: '--ring',
} as const

type ThemePaletteKey = keyof ThemePalette

const THEME_PREVIEW_KEYS = Object.keys(THEME_PREVIEW_VAR_MAP) as ThemePaletteKey[]

export const getThemePalette = (pack: ThemePackId, mode: ThemeMode): ThemePalette => {
  return THEME_PACK_PALETTES[pack][mode]
}

export const applyThemePackPreview = (pack: ThemePackId, mode: ThemeMode) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const palette = getThemePalette(pack, mode)
  THEME_PREVIEW_KEYS.forEach((key) => {
    root.style.setProperty(THEME_PREVIEW_VAR_MAP[key], palette[key])
  })
}

export const clearThemePackPreview = () => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  THEME_PREVIEW_KEYS.forEach((key) => {
    root.style.removeProperty(THEME_PREVIEW_VAR_MAP[key])
  })
}

// TODO(theme-v2): persist selected theme pack in DashboardLayout as the single source of truth.
