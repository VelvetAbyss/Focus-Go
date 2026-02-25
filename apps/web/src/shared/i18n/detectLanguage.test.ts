import { describe, expect, it } from 'vitest'
import { detectLanguage, normalizeLanguageCode } from './detectLanguage'

describe('detectLanguage', () => {
  it('normalizes zh variants to zh', () => {
    expect(normalizeLanguageCode('zh-CN')).toBe('zh')
    expect(normalizeLanguageCode('zh-TW')).toBe('zh')
    expect(normalizeLanguageCode('zh-HK')).toBe('zh')
  })

  it('maps non-zh values to en', () => {
    expect(normalizeLanguageCode('en-US')).toBe('en')
    expect(normalizeLanguageCode('fr-FR')).toBe('en')
  })

  it('uses first zh match from language array', () => {
    expect(detectLanguage(['en-US', 'zh-CN'])).toBe('zh')
  })

  it('falls back to en for empty values', () => {
    expect(detectLanguage(undefined)).toBe('en')
    expect(detectLanguage([])).toBe('en')
    expect(detectLanguage('')).toBe('en')
  })
})
