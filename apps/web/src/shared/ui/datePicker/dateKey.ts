const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_KEY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export const parseDateKeyToLocalDate = (value?: string | null) => {
  if (!value) return undefined
  const match = DATE_KEY_RE.exec(value.trim())
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return undefined
  }
  return date
}

export const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const normalizeTimeKey = (value?: string | null) => {
  if (!value) return null
  const text = value.trim()
  return TIME_KEY_RE.test(text) ? text : null
}

export const normalizeDateRangeKeys = (
  startDate: string | null,
  endDate: string | null,
) => {
  if (startDate && endDate && endDate < startDate) {
    return { startDate: endDate, endDate: startDate }
  }
  return { startDate, endDate }
}
