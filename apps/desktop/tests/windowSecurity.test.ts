import { describe, expect, it } from 'vitest'
import { createSecureWindowOptions, isNavigationAllowed } from '../electron/security/windowSecurity'

describe('window security', () => {
  it('builds secure BrowserWindow options', () => {
    const options = createSecureWindowOptions('/tmp/preload.mjs', '/tmp/icon.svg')
    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
    expect(options.webPreferences?.sandbox).toBe(true)
  })

  it('allows only app local file urls and active dev server url', () => {
    expect(isNavigationAllowed('http://localhost:5173/settings', 'http://localhost:5173')).toBe(true)
    expect(isNavigationAllowed('file:///Users/apple/index.html')).toBe(true)
    expect(isNavigationAllowed('https://example.com', 'http://localhost:5173')).toBe(false)
  })
})
