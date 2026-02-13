export type ThemeMode = 'light' | 'dark'

export const THEME_PREFERENCE_KEY = 'focusgo.theme'

export const readStoredThemePreference = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

export const writeStoredThemePreference = (theme: ThemeMode) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THEME_PREFERENCE_KEY, theme)
}

export const clearStoredThemePreference = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(THEME_PREFERENCE_KEY)
}

export const resolveTheme = () => {
  const hour = new Date().getHours()
  const isNight = hour >= 19 || hour < 7
  if (typeof window !== 'undefined' && window.matchMedia) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return isNight || prefersDark ? 'dark' : 'light'
  }
  return isNight ? 'dark' : 'light'
}

export const resolveInitialTheme = (): ThemeMode => readStoredThemePreference() ?? 'light'

export const applyTheme = (theme: ThemeMode) => {
  document.documentElement.dataset.theme = theme
}
