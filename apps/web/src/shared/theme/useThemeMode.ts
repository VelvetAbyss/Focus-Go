import { useSyncExternalStore } from 'react'
import { resolveInitialTheme, subscribeTheme, type ThemeMode } from './theme'

const readTheme = (): ThemeMode => {
  if (typeof document === 'undefined') return 'light'
  const applied = document.documentElement.dataset.theme
  return applied === 'dark' || applied === 'light' ? applied : resolveInitialTheme()
}

/** The theme currently applied to <html>, re-rendering when it changes. */
export const useThemeMode = (): ThemeMode => useSyncExternalStore(subscribeTheme, readTheme, () => 'light')
