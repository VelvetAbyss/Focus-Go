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

/**
 * Account-backed calendars (Google) never had a sync backend — they only
 * rendered placeholder events. Stored copies from older versions are dropped
 * so the sidebar only lists calendars that can actually show data.
 */
export const removeUnsupportedAccountSubscriptions = (subscriptions: CalendarSubscription[]) =>
  subscriptions.filter((item) => item.provider !== 'google')

/** The built-in 农历 calendar: worked out on the device, so it has no feed to sync. */
export const isBuiltinLunar = (subscription: Pick<CalendarSubscription, 'provider'>) => subscription.provider === 'builtin'

// The lunar feed older versions shipped, often added back by hand: a GitHub-hosted .ics
// that covers only a three-year window and is often unreachable from mainland China,
// where the API fallback won't fetch it for a signed-out user.
const LEGACY_LUNAR_FEED = /^(?:https?|webcals?):\/\/raw\.githubusercontent\.com\/infinet\/lunar-calendar\//i

/** Turns subscriptions to the legacy lunar feed into the built-in lunar calendar. */
export const migrateLegacyLunarFeeds = (subscriptions: CalendarSubscription[]) =>
  subscriptions.map((item): CalendarSubscription => {
    if (item.provider !== 'ics' || !item.url || !LEGACY_LUNAR_FEED.test(item.url.trim())) return item
    const builtin: CalendarSubscription = { ...item, provider: 'builtin' }
    delete builtin.url
    return builtin
  })

export const buildInitialCalendarSubscriptions = (): CalendarSubscription[] =>
  sortSubscriptions([
    {
      id: 'preset-cn-holidays',
      name: 'China Public Holidays',
      sourceType: 'custom',
      provider: 'ics',
      color: '#ef4444',
      enabled: true,
      syncPermission: 'read',
      order: 0,
      url: 'https://ical.muhan.org/rest.ics',
    },
    {
      id: 'preset-us-holidays',
      name: 'US Federal Holidays',
      sourceType: 'custom',
      provider: 'ics',
      color: '#2563eb',
      enabled: true,
      syncPermission: 'read',
      order: 1,
      url: 'https://calendar.google.com/calendar/ical/en.usa.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
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

// Weeks run Monday → Sunday, like the date picker, the habit weeks and the weekly recap.
const mondayIndex = (date: Date) => (date.getDay() + 6) % 7

const startOfMonthGrid = (date: Date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  first.setHours(0, 0, 0, 0)
  first.setDate(first.getDate() - mondayIndex(first))
  return first
}

const endOfMonthGrid = (date: Date) => {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  last.setHours(0, 0, 0, 0)
  last.setDate(last.getDate() + (6 - mondayIndex(last)))
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

export const formatMonthLabel = (anchorDate: Date, language: 'en' | 'zh' = 'zh') =>
  anchorDate.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  })

export const isDateInMonth = (dateKey: string, anchorDate: Date) => {
  const date = new Date(`${dateKey}T12:00:00`)
  return date.getFullYear() === anchorDate.getFullYear() && date.getMonth() === anchorDate.getMonth()
}

/** The calendar's built-in source for trips; not a subscription, always shown. */
export const TRIPS_SOURCE_ID = 'system-trips'

/**
 * One event per day of each trip that falls on the given days, so a trade show
 * or a business trip shows across its span. Day 2 onwards says which day it is.
 */
export const buildTripEvents = (
  trips: ReadonlyArray<{ id: string; title: string; startDate: string; endDate: string }>,
  dateKeys: readonly string[],
): Array<CalendarEvent & { tripId: string }> => {
  const dayMs = 86_400_000
  const toDay = (dateKey: string) => Date.UTC(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10)))
  return trips.flatMap((trip) => {
    if (!trip.startDate || !trip.endDate || trip.endDate < trip.startDate) return []
    const total = Math.round((toDay(trip.endDate) - toDay(trip.startDate)) / dayMs) + 1
    return dateKeys
      .filter((dateKey) => dateKey >= trip.startDate && dateKey <= trip.endDate)
      .map((dateKey) => {
        const day = Math.round((toDay(dateKey) - toDay(trip.startDate)) / dayMs) + 1
        return {
          id: `trip-${trip.id}-${dateKey}`,
          tripId: trip.id,
          subscriptionId: TRIPS_SOURCE_ID,
          title: total > 1 && day > 1 ? `${trip.title} · ${day}/${total}` : trip.title,
          dateKey,
          kind: 'event' as const,
        }
      })
  })
}
