import type { LanguageCode } from './types'

export const normalizeLanguageCode = (value: string): LanguageCode => {
  const normalized = value.trim().toLowerCase()
  if (normalized.startsWith('zh')) return 'zh'
  return 'en'
}

export const detectLanguage = (raw: string | string[] | undefined): LanguageCode => {
  if (Array.isArray(raw)) {
    if (raw.length === 0) return 'en'
    for (const item of raw) {
      if (typeof item === 'string' && item.trim().length > 0) {
        if (normalizeLanguageCode(item) === 'zh') return 'zh'
      }
    }
    return 'en'
  }

  if (typeof raw !== 'string' || raw.trim().length === 0) return 'en'
  return normalizeLanguageCode(raw)
}
