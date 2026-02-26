import { db } from '../../data/db'
import { createId } from '../../shared/utils/ids'
import { CURRENT_USER_ID, ensureLabsSeed } from '../labs/labsApi'
import { buildRssEntryId, dedupeEntries, extractThumbnailUrl, markEntriesRead } from './rssModel'

export const RSS_TTL_MINUTES = 30

export type SourceListSection = 'all' | 'favorites' | 'subscriptions'

type SourceOptions = {
  includeRemoved?: boolean
  section?: SourceListSection
  groupId?: string | null
  onlyStarred?: boolean
}

export type EntryViewScope =
  | { scope: 'all-active' }
  | { scope: 'source'; sourceId: string }
  | { scope: 'group'; groupId: string | null }
  | { scope: 'starred' }

export type RefreshResult = {
  ok: boolean
  stale: boolean
  lastSuccessAt?: number
  error?: string
}

type MockEntry = {
  guidOrLink: string
  title: string
  summary: string
  url: string
  thumbnailUrl?: string
  publishedAt: number
}

const failingRoutes = new Set<string>()

export const setMockSourceFailure = (route: string, shouldFail: boolean) => {
  if (shouldFail) failingRoutes.add(route)
  else failingRoutes.delete(route)
}

export const clearMockFailures = () => {
  failingRoutes.clear()
}

const routeRe = /^\/[a-z0-9_-]+(?:\/[a-z0-9_:-]+)*$/i
const looksLikeUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const parseDateMs = (value: string | null | undefined) => {
  if (!value) return Date.now()
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

const parseRssOrAtomFeed = (xml: string, source: string): MockEntry[] => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('RSS parsing is not available in this environment')
  }

  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid RSS XML')
  }

  const rssItems = [...doc.querySelectorAll('rss > channel > item, channel > item')]
  if (rssItems.length > 0) {
    return rssItems.slice(0, 120).map((item, index) => {
      const title = item.querySelector('title')?.textContent?.trim() || `Untitled #${index + 1}`
      const link = item.querySelector('link')?.textContent?.trim() || source
      const guid = item.querySelector('guid')?.textContent?.trim() || link || `${source}#${index}`
      const descriptionRaw =
        item.querySelector('description')?.textContent ||
        item.querySelector('content\\:encoded')?.textContent ||
        ''

      const mediaImage = item.querySelector('media\\:content')?.getAttribute('url')?.trim() || null
      const enclosureImage =
        item.querySelector('enclosure[type^="image/"]')?.getAttribute('url')?.trim() ||
        item.querySelector('enclosure')?.getAttribute('url')?.trim() ||
        null
      const thumbnailUrl = mediaImage || enclosureImage || extractThumbnailUrl(descriptionRaw) || undefined

      return {
        guidOrLink: guid,
        title,
        summary: stripHtml(descriptionRaw).slice(0, 500) || title,
        url: link,
        thumbnailUrl,
        publishedAt: parseDateMs(item.querySelector('pubDate')?.textContent),
      }
    })
  }

  const atomItems = [...doc.querySelectorAll('feed > entry')]
  if (atomItems.length > 0) {
    return atomItems.slice(0, 120).map((entry, index) => {
      const title = entry.querySelector('title')?.textContent?.trim() || `Untitled #${index + 1}`
      const id = entry.querySelector('id')?.textContent?.trim()
      const linkEl = entry.querySelector('link[rel="alternate"]') ?? entry.querySelector('link')
      const href = linkEl?.getAttribute('href')?.trim() || source
      const guid = id || href || `${source}#${index}`
      const summaryRaw = entry.querySelector('summary')?.textContent || entry.querySelector('content')?.textContent || ''
      const mediaImage = entry.querySelector('media\\:content')?.getAttribute('url')?.trim() || null
      const enclosureImage = entry.querySelector('link[rel="enclosure"][type^="image/"]')?.getAttribute('href')?.trim() || null
      const thumbnailUrl = mediaImage || enclosureImage || extractThumbnailUrl(summaryRaw) || undefined
      return {
        guidOrLink: guid,
        title,
        summary: stripHtml(summaryRaw).slice(0, 500) || title,
        url: href,
        thumbnailUrl,
        publishedAt: parseDateMs(entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent),
      }
    })
  }

  throw new Error('Unsupported feed format')
}

const mockFetchRoute = async (route: string): Promise<MockEntry[]> => {
  if (failingRoutes.has(route)) throw new Error('Mock fetch failed')
  const now = Date.now()
  const base = route.replace(/\W+/g, '-')
  return [
    {
      guidOrLink: `${route}/post-1`,
      title: `${base} update #1`,
      summary: `Summary for ${route} entry 1`,
      url: `https://example.com${route}/post-1`,
      publishedAt: now - 15 * 60 * 1000,
    },
    {
      guidOrLink: `${route}/post-2`,
      title: `${base} update #2`,
      summary: `Summary for ${route} entry 2`,
      url: `https://example.com${route}/post-2`,
      publishedAt: now - 45 * 60 * 1000,
    },
  ]
}

const fetchSourceEntries = async (source: string): Promise<MockEntry[]> => {
  if (failingRoutes.has(source)) throw new Error('Mock fetch failed')
  if (!looksLikeUrl(source)) {
    return mockFetchRoute(source)
  }

  const response = await fetch(source, { method: 'GET', cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`)
  }
  const xml = await response.text()
  return parseRssOrAtomFeed(xml, source)
}

const deriveDefaultDisplayName = (value: string) => {
  if (looksLikeUrl(value)) {
    try {
      const url = new URL(value)
      return url.hostname.replace(/^www\./, '')
    } catch {
      return value
    }
  }
  return value
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .join(' / ')
}

const normalizeGroupName = (name: string) => name.trim().toLowerCase()

const activityScore = (source: { lastEntryAt?: number; lastSuccessAt?: number; updatedAt: number }) =>
  Math.max(source.lastEntryAt ?? 0, source.lastSuccessAt ?? 0, source.updatedAt)

const sortSourcesByActive = <T extends { displayName: string; lastEntryAt?: number; lastSuccessAt?: number; updatedAt: number }>(rows: T[]) =>
  [...rows].sort((a, b) => {
    const scoreDelta = activityScore(b) - activityScore(a)
    if (scoreDelta !== 0) return scoreDelta
    return a.displayName.localeCompare(b.displayName)
  })

export const getSourceGroups = async () => {
  await ensureLabsSeed()
  const rows = await db.rssSourceGroups.where('userId').equals(CURRENT_USER_ID).toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

export const createSourceGroup = async (name: string) => {
  await ensureLabsSeed()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Group name is required')

  const groups = await getSourceGroups()
  const exists = groups.some((group) => normalizeGroupName(group.name) === normalizeGroupName(trimmed))
  if (exists) throw new Error('Group already exists')

  const now = Date.now()
  const created = {
    id: createId(),
    userId: CURRENT_USER_ID,
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  }
  await db.rssSourceGroups.put(created)
  return created
}

export const renameSourceGroup = async (groupId: string, name: string) => {
  const current = await db.rssSourceGroups.get(groupId)
  if (!current || current.userId !== CURRENT_USER_ID) throw new Error('Group not found')

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Group name is required')

  const groups = await getSourceGroups()
  const exists = groups.some(
    (group) => group.id !== groupId && normalizeGroupName(group.name) === normalizeGroupName(trimmed),
  )
  if (exists) throw new Error('Group already exists')

  const next = {
    ...current,
    name: trimmed,
    updatedAt: Date.now(),
  }
  await db.rssSourceGroups.put(next)
  return next
}

export const deleteSourceGroup = async (groupId: string) => {
  const current = await db.rssSourceGroups.get(groupId)
  if (!current || current.userId !== CURRENT_USER_ID) throw new Error('Group not found')

  await db.transaction('rw', db.rssSourceGroups, db.rssSources, async () => {
    await db.rssSourceGroups.delete(groupId)
    const linked = await db.rssSources.where('[userId+groupId]').equals([CURRENT_USER_ID, groupId]).toArray()
    if (!linked.length) return
    const now = Date.now()
    await db.rssSources.bulkPut(
      linked.map((source) => ({
        ...source,
        groupId: null,
        updatedAt: now,
      })),
    )
  })
}

export const assignSourceGroup = async (sourceId: string, groupId: string | null) => {
  const source = await db.rssSources.get(sourceId)
  if (!source || source.userId !== CURRENT_USER_ID) throw new Error('Source not found')

  if (groupId) {
    const group = await db.rssSourceGroups.get(groupId)
    if (!group || group.userId !== CURRENT_USER_ID) throw new Error('Group not found')
  }

  const next = {
    ...source,
    groupId,
    updatedAt: Date.now(),
  }
  await db.rssSources.put(next)
  return next
}

export const starSource = async (sourceId: string) => {
  const source = await db.rssSources.get(sourceId)
  if (!source || source.userId !== CURRENT_USER_ID) throw new Error('Source not found')
  const next = {
    ...source,
    starredAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.rssSources.put(next)
  return next
}

export const unstarSource = async (sourceId: string) => {
  const source = await db.rssSources.get(sourceId)
  if (!source || source.userId !== CURRENT_USER_ID) throw new Error('Source not found')
  const next = {
    ...source,
    starredAt: null,
    updatedAt: Date.now(),
  }
  await db.rssSources.put(next)
  return next
}

export const getSources = async (options: SourceOptions = {}) => {
  await ensureLabsSeed()
  const rows = await db.rssSources.where('userId').equals(CURRENT_USER_ID).toArray()

  const filtered = rows.filter((item) => {
    if (!options.includeRemoved && item.deletedAt) return false
    if ((options.onlyStarred || options.section === 'favorites') && !item.starredAt) return false

    if (options.groupId !== undefined) {
      if (options.groupId === null) {
        if (item.groupId) return false
      } else if (item.groupId !== options.groupId) {
        return false
      }
    }

    return true
  })

  return sortSourcesByActive(filtered)
}

export const addSource = async (input: { route: string; displayName: string; groupId?: string | null }) => {
  await ensureLabsSeed()
  const route = input.route.trim()
  const displayName = input.displayName.trim() || deriveDefaultDisplayName(route)
  const groupId = input.groupId ?? null

  if (!route) throw new Error('Route or RSS URL is required')
  if (!routeRe.test(route) && !looksLikeUrl(route)) {
    throw new Error('Source must be route like /platform/path or RSS URL')
  }

  if (groupId) {
    const group = await db.rssSourceGroups.get(groupId)
    if (!group || group.userId !== CURRENT_USER_ID) throw new Error('Group not found')
  }

  const existing = await db.rssSources
    .where('[userId+route]')
    .equals([CURRENT_USER_ID, route])
    .first()

  if (existing) throw new Error('Source already exists')

  const now = Date.now()
  const created = {
    id: createId(),
    userId: CURRENT_USER_ID,
    route,
    displayName,
    isPreset: false,
    enabled: true,
    groupId,
    starredAt: null,
    deletedAt: null,
    lastEntryAt: undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.rssSources.put(created)
  return created
}

export const removeSource = async (sourceId: string) => {
  const current = await db.rssSources.get(sourceId)
  if (!current) return null
  const next = {
    ...current,
    enabled: false,
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.rssSources.put(next)
  return next
}

export const restoreSource = async (sourceId: string) => {
  const current = await db.rssSources.get(sourceId)
  if (!current) return null
  const next = {
    ...current,
    enabled: true,
    deletedAt: null,
    updatedAt: Date.now(),
  }
  await db.rssSources.put(next)
  return next
}

const writeSourceError = async (sourceId: string, message: string) => {
  const current = await db.rssSources.get(sourceId)
  if (!current) return
  await db.rssSources.put({
    ...current,
    lastErrorAt: Date.now(),
    lastErrorMessage: message,
    updatedAt: Date.now(),
  })
}

const writeSourceSuccess = async (sourceId: string, successAt: number, lastEntryAt?: number) => {
  const current = await db.rssSources.get(sourceId)
  if (!current) return
  await db.rssSources.put({
    ...current,
    lastSuccessAt: successAt,
    lastEntryAt: lastEntryAt ?? current.lastEntryAt,
    lastErrorAt: undefined,
    lastErrorMessage: undefined,
    updatedAt: Date.now(),
  })
}

const refreshOne = async (sourceId: string): Promise<RefreshResult> => {
  const source = await db.rssSources.get(sourceId)
  if (!source || source.deletedAt || !source.enabled) {
    return { ok: false, stale: false, error: 'Source is unavailable' }
  }

  const existing = await db.rssEntries.where('sourceId').equals(sourceId).toArray()
  try {
    const fetched = await fetchSourceEntries(source.route)
    const deduped = dedupeEntries(
      fetched.map((entry) => ({
        route: source.route,
        guidOrLink: entry.guidOrLink,
        title: entry.title,
        summary: entry.summary,
        url: entry.url,
        thumbnailUrl: entry.thumbnailUrl,
        publishedAt: entry.publishedAt,
      })),
    )

    const now = Date.now()
    const latestPublished = deduped.length
      ? deduped.map((entry) => entry.publishedAt).sort((a, b) => b - a)[0]
      : source.lastEntryAt

    const nextRows = deduped.map((entry) => ({
      id: buildRssEntryId(source.route, entry.guidOrLink),
      sourceId: source.id,
      route: source.route,
      guidOrLink: entry.guidOrLink,
      title: entry.title,
      summary: entry.summary,
      url: entry.url,
      thumbnailUrl: entry.thumbnailUrl,
      publishedAt: entry.publishedAt,
      cachedAt: now,
      createdAt: existing.find((item) => item.id === buildRssEntryId(source.route, entry.guidOrLink))?.createdAt ?? now,
      updatedAt: now,
    }))

    await db.transaction('rw', db.rssEntries, async () => {
      await db.rssEntries.where('sourceId').equals(sourceId).delete()
      if (nextRows.length > 0) await db.rssEntries.bulkPut(nextRows)
    })

    await writeSourceSuccess(source.id, now, latestPublished)
    return { ok: true, stale: false, lastSuccessAt: now }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh failed'
    await writeSourceError(source.id, message)
    if (existing.length > 0) {
      return {
        ok: true,
        stale: true,
        lastSuccessAt: source.lastSuccessAt,
      }
    }
    return {
      ok: false,
      stale: false,
      error: message,
    }
  }
}

export const refreshSource = async (sourceId: string): Promise<RefreshResult> => refreshOne(sourceId)

export const refreshAll = async (): Promise<RefreshResult> => {
  const sources = await getSources()
  if (!sources.length) return { ok: true, stale: false }
  const results = await Promise.all(sources.filter((item) => item.enabled).map((item) => refreshOne(item.id)))
  const entries = await getEntries()

  const stale = results.some((item) => item.stale)
  const hardFail = results.some((item) => !item.ok)
  const latestSuccessAt = results
    .map((item) => item.lastSuccessAt)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => b - a)[0]

  if (hardFail && entries.length === 0) {
    return {
      ok: false,
      stale,
      lastSuccessAt: latestSuccessAt,
      error: 'Refresh failed with no cached entries',
    }
  }

  return {
    ok: true,
    stale,
    lastSuccessAt: latestSuccessAt,
  }
}

export const getEntries = async (options?: { sourceId?: string }) => {
  const rows = options?.sourceId
    ? await db.rssEntries.where('sourceId').equals(options.sourceId).toArray()
    : await db.rssEntries.toArray()

  return rows.sort((a, b) => b.publishedAt - a.publishedAt)
}

export const getEntriesView = async (input: EntryViewScope = { scope: 'all-active' }) => {
  let sourceIds: string[] = []

  if (input.scope === 'all-active') {
    const sources = await getSources()
    sourceIds = sources.map((item) => item.id)
  }

  if (input.scope === 'source') {
    const source = await db.rssSources.get(input.sourceId)
    sourceIds = source && !source.deletedAt ? [source.id] : []
  }

  if (input.scope === 'group') {
    const sources = await getSources({ groupId: input.groupId })
    sourceIds = sources.map((item) => item.id)
  }

  if (input.scope === 'starred') {
    const sources = await getSources({ onlyStarred: true })
    sourceIds = sources.map((item) => item.id)
  }

  if (!sourceIds.length) return []

  const rows = await db.rssEntries.where('sourceId').anyOf(sourceIds).toArray()
  const deduped = dedupeEntries([...rows].sort((a, b) => a.publishedAt - b.publishedAt))
  return deduped.sort((a, b) => b.publishedAt - a.publishedAt)
}

export const getReadStates = async () => {
  return db.rssReadStates.where('userId').equals(CURRENT_USER_ID).toArray()
}

export const markEntriesAsRead = async (entryIds: string[]) => {
  const existing = await getReadStates()
  const now = Date.now()
  const next = markEntriesRead(
    existing.map((item) => ({ userId: item.userId, entryId: item.entryId, readAt: item.readAt })),
    CURRENT_USER_ID,
    entryIds,
    now,
  ).map((item) => {
    const prior = existing.find((row) => row.userId === item.userId && row.entryId === item.entryId)
    return {
      id: prior?.id ?? createId(),
      userId: item.userId,
      entryId: item.entryId,
      readAt: item.readAt,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
    }
  })

  await db.rssReadStates.bulkPut(next)
  return next
}
