import { describe, expect, it } from 'vitest'
import { t } from './translator'

describe('translator', () => {
  it('returns localized text for existing key', () => {
    expect(t('nav.settings', 'en')).toBe('Settings')
    expect(t('nav.settings', 'zh')).toBe('设置')
  })

  it('applies interpolation values', () => {
    expect(t('settings.theme.forceHelp', 'en', { theme: 'dark' })).toBe('Force dark theme')
  })

  it('falls back to english when key missing in current locale', () => {
    const result = t('modules.rss.title', 'zh')
    expect(result).toBe('订阅')
  })
})
