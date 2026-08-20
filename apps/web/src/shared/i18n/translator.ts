import { getCachedMessages } from './loader'
import type { LanguageCode, TranslationKey } from './types'

type TranslationValues = Record<string, string | number>

const interpolate = (template: string, values?: TranslationValues) => {
  if (!values) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(values[key] ?? `{{${key}}}`))
}

const lookup = (lang: LanguageCode, key: TranslationKey): string | undefined => {
  const table = getCachedMessages(lang) as Record<string, string> | undefined
  return table?.[key]
}

export const t = (key: TranslationKey, language: LanguageCode, values?: TranslationValues): string => {
  const current = lookup(language, key)
  if (current !== undefined) return interpolate(current, values)

  // Preserve prior semantics: fall back to English when the key is
  // missing from the active locale. If EN isn't loaded yet the
  // synchronous path simply returns the key (first paint before
  // bootstrap completes should never reach this).
  const fallback = lookup('en', key)
  if (fallback !== undefined) return interpolate(fallback, values)

  if (import.meta.env.DEV) {
    // Helps surface missing keys during development while keeping runtime safe.
    console.warn(`[i18n] Missing translation key: ${key}`)
  }
  return key
}

// Re-export loader helpers so existing call sites can depend on a single surface.
export { loadLanguage, primeMessages } from './loader'
