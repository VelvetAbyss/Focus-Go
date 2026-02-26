export const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part))
  return new Date(year, month - 1, day)
}

export const shiftDateKey = (dateKey: string, offsetDays: number) => {
  const next = parseDateKey(dateKey)
  next.setDate(next.getDate() + offsetDays)
  return toDateKey(next)
}

export const todayDateKey = () => toDateKey(new Date())
