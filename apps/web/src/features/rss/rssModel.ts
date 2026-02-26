export type RssEntryLike = {
  route: string
  guidOrLink: string
  title: string
}

export type RssDatedEntry = {
  publishedAt: number
}

export type RssReadState = {
  userId: string
  entryId: string
  readAt: number
}

export type DayGroupBucket<T> = {
  key: string
  type: 'today' | 'yesterday' | 'date'
  dateMs: number
  entries: T[]
}

export const buildRssEntryId = (route: string, guidOrLink: string) => `${route}::${guidOrLink}`

export const dedupeEntries = <T extends RssEntryLike>(entries: T[]): T[] => {
  const map = new Map<string, T>()
  entries.forEach((entry) => {
    map.set(buildRssEntryId(entry.route, entry.guidOrLink), entry)
  })
  return [...map.values()]
}

export const isCacheExpired = (
  lastSuccessAt: number | undefined,
  ttlMinutes: number,
  now = Date.now(),
): boolean => {
  if (!lastSuccessAt) return true
  return now - lastSuccessAt > ttlMinutes * 60 * 1000
}

export const markEntriesRead = (
  existing: RssReadState[],
  userId: string,
  entryIds: string[],
  readAt = Date.now(),
): RssReadState[] => {
  const map = new Map(existing.map((item) => [`${item.userId}:${item.entryId}`, item]))
  entryIds.forEach((entryId) => {
    map.set(`${userId}:${entryId}`, { userId, entryId, readAt })
  })
  return [...map.values()]
}

const toDayStart = (value: number) => {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next.getTime()
}

const toDayKey = (value: number) => {
  const next = new Date(value)
  const year = next.getFullYear()
  const month = String(next.getMonth() + 1).padStart(2, '0')
  const day = String(next.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const groupEntriesByDay = <T extends RssDatedEntry>(entries: T[], now = Date.now()): DayGroupBucket<T>[] => {
  const todayStart = toDayStart(now)
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
  const map = new Map<string, DayGroupBucket<T>>()

  entries.forEach((entry) => {
    const dayStart = toDayStart(entry.publishedAt)
    const key = toDayKey(entry.publishedAt)
    const type: DayGroupBucket<T>['type'] = dayStart === todayStart ? 'today' : dayStart === yesterdayStart ? 'yesterday' : 'date'
    const bucket = map.get(key)
    if (bucket) {
      bucket.entries.push(entry)
      return
    }

    map.set(key, {
      key,
      type,
      dateMs: dayStart,
      entries: [entry],
    })
  })

  return [...map.values()]
    .sort((a, b) => b.dateMs - a.dateMs)
    .map((bucket) => ({
      ...bucket,
      entries: [...bucket.entries].sort((a, b) => b.publishedAt - a.publishedAt),
    }))
}

const imageRe = /<img[^>]*src=["']([^"']+)["'][^>]*>/i

export const extractThumbnailUrl = (input: string | null | undefined): string | null => {
  if (!input) return null
  const match = imageRe.exec(input)
  return match?.[1]?.trim() || null
}
