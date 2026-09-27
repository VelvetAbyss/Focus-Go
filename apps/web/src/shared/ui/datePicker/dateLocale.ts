import { format } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import type { LanguageCode } from '../../i18n/types'

/** date-fns locale and the display formats the pickers use, per app language. */
export const dateFnsLocaleFor = (language: LanguageCode) => (language === 'zh' ? zhCN : enUS)

/** "2026年9月27日" / "September 27th, 2026" — a picked date on a trigger button. */
export const formatPickedDate = (date: Date, language: LanguageCode) =>
  format(date, 'PPP', { locale: dateFnsLocaleFor(language) })

/** "9月27日" / "Sep 27, 2026" — each end of a picked range. */
export const formatRangeEnd = (date: Date, language: LanguageCode) =>
  language === 'zh' ? format(date, 'y年M月d日') : format(date, 'LLL dd, y', { locale: enUS })
