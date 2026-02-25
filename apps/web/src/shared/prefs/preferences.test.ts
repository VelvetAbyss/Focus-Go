import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LANGUAGE_KEY, detectBrowserLanguage, readLanguage, writeLanguage } from './preferences'

const createStorage = () => {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
  }
}

describe('preferences language', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('localStorage', createStorage())
    vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' })
    localStorage.clear()
  })

  it('detectBrowserLanguage normalizes language variants', () => {
    expect(detectBrowserLanguage('zh-CN')).toBe('zh')
    expect(detectBrowserLanguage(['en-US', 'zh-HK'])).toBe('en')
    expect(detectBrowserLanguage('en-US')).toBe('en')
  })

  it('readLanguage prefers persisted value', () => {
    localStorage.setItem(LANGUAGE_KEY, 'zh')
    expect(readLanguage()).toBe('zh')
  })

  it('readLanguage falls back to browser languages when no persisted value', () => {
    vi.stubGlobal('navigator', { languages: ['zh-CN'], language: 'zh-CN' })
    expect(readLanguage()).toBe('zh')
  })

  it('writeLanguage persists language', () => {
    writeLanguage('en')
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('en')
  })
})
