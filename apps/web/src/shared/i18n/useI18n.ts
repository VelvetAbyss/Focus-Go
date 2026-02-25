import { useMemo } from 'react'
import { usePreferences } from '../prefs/usePreferences'
import { t } from './translator'
import type { TranslationKey } from './types'

type TranslationValues = Record<string, string | number>

export const useI18n = () => {
  const { language } = usePreferences()

  const translate = useMemo(
    () => (key: TranslationKey, values?: TranslationValues) => t(key, language, values),
    [language]
  )

  return {
    language,
    t: translate,
  }
}
