import type { DiaryEntry } from '../../data/models/types'
import { markdownToPreview } from '../../shared/utils/markdownPreview'
import { toDateKey } from '../../shared/utils/time'

/** The same day last month, or null when last month had no such day (31 March → no 31 February). */
export const monthAgoDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 2, day, 12)
  return date.getDate() === day ? toDateKey(date) : null
}

/** The first thing written on that day a month ago, if anything was. */
export const pickMonthAgoEntry = (entries: readonly DiaryEntry[], todayKey: string) => {
  const target = monthAgoDateKey(todayKey)
  if (!target) return null
  return (
    entries
      .filter((entry) => entry.dateKey === target && !entry.deletedAt && markdownToPreview(entry.contentMd).trim())
      .sort((a, b) => a.entryAt - b.entryAt)[0] ?? null
  )
}
