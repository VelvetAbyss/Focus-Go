import type { BrowserWindowConstructorOptions } from 'electron'

export const createSecureWindowOptions = (
  preloadPath: string,
  iconPath: string
): BrowserWindowConstructorOptions => ({
  icon: iconPath,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
})

export const isNavigationAllowed = (url: string, devServerUrl?: string): boolean => {
  if (devServerUrl && url.startsWith(devServerUrl)) return true
  if (url.startsWith('file://')) return true
  return false
}
