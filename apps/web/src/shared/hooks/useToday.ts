import { useEffect, useState } from 'react'
import { usePageActivity } from './usePageActivity'

const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Local midnight of the current day. Re-renders when the day turns over,
 * whether the page is open at midnight or comes back after a sleep.
 */
export const useToday = () => {
  const [today, setToday] = useState(startOfToday)
  const activity = usePageActivity()

  useEffect(() => {
    const sync = () => {
      const next = startOfToday()
      setToday((current) => (current.getTime() === next.getTime() ? current : next))
    }
    sync()
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = () => {
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(() => {
        sync()
        schedule()
      }, midnight.getTime() - now.getTime() + 50)
    }
    schedule()
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
  }, [activity])

  return today
}
