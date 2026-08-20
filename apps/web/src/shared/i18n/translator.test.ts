import { beforeAll, describe, expect, it } from 'vitest'
import { loadLanguage, t } from './translator'

describe('translator', () => {
  beforeAll(async () => {
    await Promise.all([loadLanguage('en'), loadLanguage('zh')])
  })

  it('returns localized text for existing key', () => {
    expect(t('nav.settings', 'en')).toBe('Settings')
    expect(t('nav.settings', 'zh')).toBe('设置')
  })

  it('applies interpolation values', () => {
    expect(t('settings.theme.forceHelp', 'en', { theme: 'dark' })).toBe('Force dark theme')
  })

  it('falls back to english when key missing in current locale', () => {
    const result = t('modules.tasks.title', 'zh')
    expect(result).toBe('任务')
  })
})
