export const toDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isOverdue = (isoDate?: string) => {
  if (!isoDate) return false
  const due = new Date(isoDate)
  const now = new Date()
  return due.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}
