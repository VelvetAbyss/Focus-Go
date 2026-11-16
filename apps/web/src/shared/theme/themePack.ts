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
      bg: '#e8e4dd',
      bgElevated: '#fcfbf7',
      bgMuted: '#efebe4',
      accent: '#a65d43',
      accentSoft: '#f0e0d6',
      primaryHsl: '16 42% 46%',
      ringHsl: '16 42% 46%',
    },
    dark: {
      bg: '#242320',
      bgElevated: '#34312c',
      bgMuted: '#35322e',
      accent: '#e3a381',
      accentSoft: '#4b352b',
      primaryHsl: '21 64% 70%',
      ringHsl: '21 64% 70%',
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
      bg: '#151e2b',
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
      bg: '#261813',
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
  // A temporary pack preview suspends ambient tokens as a complete set.
  // Clearing it restores the selected environment, including portaled UI.
  root.dataset.themePackPreview = pack
  const palette = getThemePalette(pack, mode)
  THEME_PREVIEW_KEYS.forEach((key) => {
    root.style.setProperty(THEME_PREVIEW_VAR_MAP[key], palette[key])
  })
}

export const clearThemePackPreview = () => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  delete root.dataset.themePackPreview
  THEME_PREVIEW_KEYS.forEach((key) => {
    root.style.removeProperty(THEME_PREVIEW_VAR_MAP[key])
  })
}

// TODO(theme-v2): persist selected theme pack in DashboardLayout as the single source of truth.
