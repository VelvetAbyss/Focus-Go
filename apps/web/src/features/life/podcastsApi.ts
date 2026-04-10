import type { LifePodcastCreateInput } from '@focus-go/core'
import { getAuth } from '../../store/auth'
import { isLocalhostRuntime } from '../../shared/env/localhost'

type ItunesSearchResult = {
  collectionId?: number
  collectionName?: string
  artistName?: string
  artworkUrl100?: string
  feedUrl?: string
  primaryGenreName?: string
  releaseDate?: string
  country?: string
}

type ItunesEpisodeResult = {
  trackId?: number
  trackName?: string
  description?: string
  shortDescription?: string
  episodeUrl?: string
  releaseDate?: string
  trackTimeMillis?: number
  collectionId?: number
}

type ItunesLookupResult = ItunesSearchResult & ItunesEpisodeResult & { wrapperType?: string; kind?: string }

export type RemotePodcastCandidate = Omit<LifePodcastCreateInput, 'episodes' | 'selectedEpisodeId' | 'isPlaying'> & {
  episodes: NonNullable<LifePodcastCreateInput['episodes']>
}

export const NETEASE_CHANNEL_PRESETS = [
  { id: '796756498', title: 'Just Some Collections', url: 'https://music.163.com/djradio?id=796756498' },
  { id: '795087630', title: 'ChilL 2 DiE', url: 'https://music.163.com/djradio?id=795087630' },
] as const

export const buildNeteaseStreamUrl = (programId: string, cacheBust?: number) => {
  const url = new URL(`${import.meta.env.VITE_API_BASE}/podcasts/netease/stream`)
  url.searchParams.set('programId', programId)
  if (cacheBust) url.searchParams.set('t', String(cacheBust))
  return url.toString()
}

const fallbackEmojis = ['🎙', '🎧', '📻', '🗣']
const fallbackColors = ['#D8C2A6', '#B7CCB0', '#CBB5D9', '#E3BCA4', '#A9C8D8']

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json() as Promise<T>
}

const getAuthHeaders = () => {
  const auth = getAuth()
  if (!auth?.accessToken) {
    if (isLocalhostRuntime()) return { 'Content-Type': 'application/json' }
    throw new Error('Missing auth token')
  }
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    'Content-Type': 'application/json',
  }
}

const fetchAuthedJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const headers: HeadersInit = {
    ...(getAuthHeaders() as Record<string, string>),
    ...((init?.headers ?? {}) as Record<string, string>),
  }
  const response = await fetch(`${import.meta.env.VITE_API_BASE}${path}`, {
    ...init,
    headers,
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Podcast request failed: ${response.status}${detail ? ` ${detail}` : ''}`)
  }
  return response.json() as Promise<T>
}

const toDuration = (value?: number) => {
  if (!value || value <= 0) return undefined
  const totalMinutes = Math.round(value / 60000)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`
}

const hashValue = (value: string) => value.split('').reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)
const pickColor = (value: string) => fallbackColors[Math.abs(hashValue(value)) % fallbackColors.length]
const pickEmoji = (value: string) => fallbackEmojis[Math.abs(hashValue(value)) % fallbackEmojis.length]

export const extractNeteaseRadioId = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return trimmed
  try {
    const normalized = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    const url = new URL(normalized)
    if (!/music\.163\.com$/.test(url.hostname)) return null
    const hashQuery = url.hash.includes('?') ? new URLSearchParams(url.hash.slice(url.hash.indexOf('?') + 1)) : null
    return url.searchParams.get('id') ?? hashQuery?.get('id') ?? null
  } catch {
    return null
  }
}

export const isNeteasePodcastUrl = (value: string) => extractNeteaseRadioId(value) !== null

const dedupeEpisodes = (rows: RemotePodcastCandidate['episodes']) => {
  const seen = new Set<string>()
  return rows.filter((episode) => {
    const key = `${episode.id}:${episode.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const mapSearchResult = (item: ItunesSearchResult): RemotePodcastCandidate | null => {
  if (typeof item.collectionId !== 'number' || !item.collectionName) return null
  return {
    source: 'itunes',
    sourceId: String(item.collectionId),
    collectionId: item.collectionId,
    name: item.collectionName,
    author: item.artistName ?? 'Unknown',
    artworkUrl: item.artworkUrl100?.replace('100x100bb', '600x600bb'),
    feedUrl: item.feedUrl,
    primaryGenre: item.primaryGenreName,
    releaseDate: item.releaseDate,
    country: item.country,
    coverColor: pickColor(item.collectionName),
    coverEmoji: pickEmoji(item.collectionName),
    episodes: [],
  }
}

export const dedupePodcastMatch = (
  rows: Array<Pick<RemotePodcastCandidate, 'source' | 'collectionId'>>,
  candidate: Pick<RemotePodcastCandidate, 'source' | 'collectionId'>,
) =>
  rows.find((item) => item.collectionId === candidate.collectionId && item.source === candidate.source)

export const searchRemotePodcasts = async (query: string, signal?: AbortSignal): Promise<RemotePodcastCandidate[]> => {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=10`
  const payload = await fetchJson<{ results?: ItunesSearchResult[] }>(url, signal)
  const merged: RemotePodcastCandidate[] = []
  for (const result of payload.results ?? []) {
    const candidate = mapSearchResult(result)
    if (!candidate || dedupePodcastMatch(merged, candidate)) continue
    merged.push(candidate)
  }
  return merged
}

export const hydrateRemotePodcastCandidate = async (candidate: RemotePodcastCandidate, signal?: AbortSignal): Promise<RemotePodcastCandidate> => {
  if (candidate.source === 'netease') return candidate
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(String(candidate.collectionId))}&entity=podcastEpisode&limit=8`
  const payload = await fetchJson<{ results?: ItunesLookupResult[] }>(url, signal).catch(() => ({ results: [] }))
  const episodes = dedupeEpisodes(
    (payload.results ?? [])
      .filter((item) => item.kind === 'podcast-episode')
      .map((item) => ({
        id: String(item.trackId ?? crypto.randomUUID()),
        title: item.trackName ?? 'Untitled episode',
        description: item.description ?? item.shortDescription,
        duration: toDuration(item.trackTimeMillis),
        releaseDate: item.releaseDate,
        audioUrl: item.episodeUrl,
      })),
  )
  return {
    ...candidate,
    episodes,
  }
}

export const importNeteasePodcast = async (input: string): Promise<RemotePodcastCandidate> => {
  const payload = await fetchAuthedJson<{ podcast: RemotePodcastCandidate }>('/podcasts/netease/import', {
    method: 'POST',
    body: JSON.stringify({ input }),
  })
  return payload.podcast
}

export const syncNeteasePodcasts = async (sourceIds: string[]): Promise<RemotePodcastCandidate[]> => {
  const payload = await fetchAuthedJson<{ podcasts: RemotePodcastCandidate[] }>('/podcasts/netease/sync', {
    method: 'POST',
    body: JSON.stringify({ sourceIds }),
  })
  return payload.podcasts
}
