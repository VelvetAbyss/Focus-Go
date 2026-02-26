export type CalendarSourceType = 'system' | 'account' | 'custom'
export type CalendarProvider = 'builtin' | 'ics' | 'google' | 'apple' | 'outlook'
export type CalendarSyncPermission = 'read' | 'write'

export type CalendarSubscription = {
  id: string
  name: string
  sourceType: CalendarSourceType
  provider: CalendarProvider
  color: string
  enabled: boolean
  syncPermission: CalendarSyncPermission
  order: number
  url?: string
  deletedAt?: number | null
}

export type CalendarEventKind = 'event' | 'lunar' | 'holiday'

export type CalendarEvent = {
  id: string
  subscriptionId: string
  title: string
  dateKey: string
  timeLabel?: string
  kind: CalendarEventKind
}

const sourceOrder: Record<CalendarSourceType, number> = {
  system: 0,
  account: 1,
  custom: 2,
}

export const sortSubscriptions = <T extends { sourceType: CalendarSourceType; order: number; name: string }>(
  subscriptions: T[]
) =>
  subscriptions
    .slice()
    .sort(
      (a, b) =>
        a.order - b.order ||
        sourceOrder[a.sourceType] - sourceOrder[b.sourceType] ||
        a.name.localeCompare(b.name)
    )

export const buildInitialCalendarSubscriptions = (): CalendarSubscription[] =>
  sortSubscriptions([
    {
      id: 'account-google',
      name: 'Google Calendar (M1 Read-Only)',
      sourceType: 'account',
      provider: 'google',
      color: '#2563eb',
      enabled: true,
      syncPermission: 'read',
      order: 0,
    },
  ])

export const removeSubscription = (subscriptions: CalendarSubscription[], subscriptionId: string) =>
  subscriptions.filter((item) => item.id !== subscriptionId)

export const removeSubscriptionHard = (subscriptions: CalendarSubscription[], subscriptionId: string) =>
  subscriptions.filter((item) => item.id !== subscriptionId)

export const removeAllSystemSubscriptions = (subscriptions: CalendarSubscription[]) =>
  subscriptions.filter((item) => item.sourceType !== 'system')

export const softRemoveSubscription = (subscriptions: CalendarSubscription[], subscriptionId: string) => {
  const now = Date.now()
  return subscriptions.map((item) =>
    item.id === subscriptionId
      ? {
          ...item,
          enabled: false,
          deletedAt: now,
        }
      : item
  )
}

export const restoreSubscription = (subscriptions: CalendarSubscription[], subscriptionId: string) =>
  subscriptions.map((item) =>
    item.id === subscriptionId
      ? {
          ...item,
          enabled: true,
          deletedAt: null,
        }
      : item
  )

export const getActiveSubscriptions = (subscriptions: CalendarSubscription[]) =>
  sortSubscriptions(subscriptions.filter((item) => !item.deletedAt))

export const getDeletedSubscriptions = (subscriptions: CalendarSubscription[]) =>
  sortSubscriptions(subscriptions.filter((item) => Boolean(item.deletedAt)))

export const updateSubscriptionColor = (
  subscriptions: CalendarSubscription[],
  subscriptionId: string,
  color: string
) => subscriptions.map((item) => (item.id === subscriptionId ? { ...item, color } : item))

export const toggleSubscriptionEnabled = (subscriptions: CalendarSubscription[], subscriptionId: string) =>
  subscriptions.map((item) => (item.id === subscriptionId ? { ...item, enabled: !item.enabled } : item))

export const reorderSubscriptions = (subscriptions: CalendarSubscription[], orderedIds: string[]) => {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
  let nextOrder = orderedIds.length
  const withOrder = subscriptions.map((item) => ({
    ...item,
    order: orderMap.get(item.id) ?? nextOrder++,
  }))
  return sortSubscriptions(withOrder)
}

const toDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const startOfMonthGrid = (date: Date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  first.setHours(0, 0, 0, 0)
  first.setDate(first.getDate() - first.getDay())
  return first
}

const endOfMonthGrid = (date: Date) => {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  last.setHours(0, 0, 0, 0)
  last.setDate(last.getDate() + (6 - last.getDay()))
  return last
}

export const getMonthGridDateKeys = (anchorDate: Date): string[] => {
  const start = startOfMonthGrid(anchorDate)
  const end = endOfMonthGrid(anchorDate)
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1

  return Array.from({ length: totalDays }, (_, index) => {
    const current = new Date(start)
    current.setDate(start.getDate() + index)
    return toDateKey(current)
  })
}

export const buildSampleMonthEvents = (anchorDate: Date): CalendarEvent[] => {
  const y = anchorDate.getFullYear()
  const m = anchorDate.getMonth() + 1
  const monthKey = `${y}-${`${m}`.padStart(2, '0')}`

  return [
    {
      id: `${monthKey}-holiday-1`,
      subscriptionId: 'system-us-holidays',
      title: 'Presidents Day',
      dateKey: `${monthKey}-16`,
      timeLabel: 'All day',
      kind: 'holiday',
    },
    {
      id: `${monthKey}-holiday-2`,
      subscriptionId: 'system-us-holidays',
      title: 'Tax Reminder',
      dateKey: `${monthKey}-20`,
      timeLabel: 'All day',
      kind: 'holiday',
    },
    {
      id: `${monthKey}-google-1`,
      subscriptionId: 'account-google',
      title: 'Product standup',
      dateKey: `${monthKey}-05`,
      timeLabel: '10:00',
      kind: 'event',
    },
    {
      id: `${monthKey}-google-2`,
      subscriptionId: 'account-google',
      title: 'Design review',
      dateKey: `${monthKey}-14`,
      timeLabel: '16:00',
      kind: 'event',
    },
  ]
}

export const formatMonthLabel = (anchorDate: Date) =>
  anchorDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  })

export const isDateInMonth = (dateKey: string, anchorDate: Date) => {
  const date = new Date(`${dateKey}T12:00:00`)
  return date.getFullYear() === anchorDate.getFullYear() && date.getMonth() === anchorDate.getMonth()
}
