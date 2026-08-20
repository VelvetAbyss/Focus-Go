import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PERSONAL_API_KEY_STORAGE_KEYS,
  clearPersonalApiKey,
  readPersonalApiKey,
  writePersonalApiKey,
} from './personalApiKeys'

describe('personalApiKeys', () => {
  const entries = new Map<string, string>()

  beforeEach(() => {
    entries.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    })
  })

  it('stores only trimmed values on the current device and removes blank values', () => {
    writePersonalApiKey('tmdb', '  personal-key  ')
    expect(readPersonalApiKey('tmdb')).toBe('personal-key')
    expect(entries.get(PERSONAL_API_KEY_STORAGE_KEYS.tmdb)).toBe('personal-key')

    writePersonalApiKey('tmdb', '   ')
    expect(readPersonalApiKey('tmdb')).toBe('')
    expect(entries.get(PERSONAL_API_KEY_STORAGE_KEYS.tmdb)).toBeUndefined()
  })

  it('removes an individual service key without touching another service', () => {
    writePersonalApiKey('tmdb', 'tmdb-key')
    writePersonalApiKey('twelveData', 'twelve-key')

    clearPersonalApiKey('tmdb')

    expect(readPersonalApiKey('tmdb')).toBe('')
    expect(readPersonalApiKey('twelveData')).toBe('twelve-key')
  })
})
