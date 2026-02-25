import { enMessages } from './messages/en'
import { zhMessages } from './messages/zh'
import type { LanguageCode, TranslationKey } from './types'

const messagesByLanguage = {
  en: enMessages,
  zh: zhMessages,
} as const

type TranslationValues = Record<string, string | number>

const interpolate = (template: string, values?: TranslationValues) => {
  if (!values) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(values[key] ?? `{{${key}}}`))
}

export const t = (key: TranslationKey, language: LanguageCode, values?: TranslationValues): string => {
  const current = messagesByLanguage[language][key]
  if (current !== undefined) return interpolate(current, values)

  const fallback = messagesByLanguage.en[key]
  if (fallback !== undefined) return interpolate(fallback, values)

  if (import.meta.env.DEV) {
    // Helps surface missing keys during development while keeping runtime safe.
    console.warn(`[i18n] Missing translation key: ${key}`)
  }
  return key
}
