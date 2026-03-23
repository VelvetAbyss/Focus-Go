export type ThemeMode = 'light' | 'dark'
export type ThemeSelection = ThemeMode | 'system'

export const THEME_PREFERENCE_KEY = 'focusgo.theme'

export const readStoredThemePreference = (): ThemeSelection | null => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : null
}

export const writeStoredThemePreference = (theme: ThemeSelection) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THEME_PREFERENCE_KEY, theme)
}

export const clearStoredThemePreference = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(THEME_PREFERENCE_KEY)
}

export const resolveSystemTheme = (): ThemeMode => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export const resolveTheme = (selection: ThemeSelection = 'system'): ThemeMode => {
  if (selection === 'light' || selection === 'dark') return selection
  return resolveSystemTheme()
}

export const resolveInitialTheme = (): ThemeMode => resolveTheme(readStoredThemePreference() ?? 'system')

export const applyTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}
