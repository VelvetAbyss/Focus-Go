import type { MediaCreateInput } from '@focus-go/core'

type TmdbMediaType = 'movie' | 'tv'

type TmdbSearchResult = {
  id?: number
  media_type?: string
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
}

type TmdbGenre = { name?: string }
type TmdbCast = { name?: string }
type TmdbCrew = { job?: string; department?: string; name?: string }
type TmdbDetails = {
  id?: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  number_of_episodes?: number
  production_countries?: Array<{ name?: string }>
  origin_country?: string[]
  original_language?: string
  genres?: TmdbGenre[]
  created_by?: Array<{ name?: string }>
  credits?: {
    cast?: TmdbCast[]
    crew?: TmdbCrew[]
  }
}

export type RemoteMediaCandidate = {
  source: MediaCreateInput['source']
  sourceId: string
  tmdbId: number
  mediaType: MediaCreateInput['mediaType']
  title: string
  originalTitle?: string
  status?: MediaCreateInput['status']
  progress?: number
  posterUrl?: string
  backdropUrl?: string
  overview?: string
  releaseDate?: string
  director?: string
  creator?: string
  cast: string[]
  genres: string[]
  duration?: string
  seasons?: number
  episodes?: number
  country?: string
  language?: string
  rating?: string
  voteAverage?: number
}

const IMAGE_BASE = 'https://image.tmdb.org/t/p'

const getTmdbKey = () => import.meta.env.VITE_TMDB_API_KEY?.trim()

export const hasTmdbKey = () => Boolean(getTmdbKey())

const buildImageUrl = (path?: string | null, size: 'w92' | 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMAGE_BASE}/${size}${path}` : undefined

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`TMDb request failed: ${response.status}`)
  return response.json() as Promise<T>
}

const getPrimaryDirector = (details: TmdbDetails) => {
  const crew = details.credits?.crew ?? []
  const director = crew.find((item) => item.job === 'Director' && typeof item.name === 'string')?.name
  if (director) return director
  const creator = details.created_by?.find((item) => typeof item.name === 'string')?.name
  if (creator) return creator
  const showrunner = crew.find((item) => item.department === 'Production' && typeof item.name === 'string')?.name
  return showrunner
}

const toDurationLabel = (details: TmdbDetails, mediaType: TmdbMediaType) => {
  if (mediaType === 'movie' && typeof details.runtime === 'number' && details.runtime > 0) return `${Math.round(details.runtime)} min`
  if (mediaType === 'tv') {
    const runtime = details.episode_run_time?.find((value) => typeof value === 'number' && value > 0)
    if (typeof runtime === 'number') return `${Math.round(runtime)} min / ep`
  }
  return undefined
}

const mapSearchResult = (item: TmdbSearchResult): RemoteMediaCandidate | null => {
  const mediaType = item.media_type === 'tv' ? 'tv' : item.media_type === 'movie' ? 'movie' : null
  if (!mediaType || typeof item.id !== 'number') return null
  const title = mediaType === 'movie' ? item.title : item.name
  if (typeof title !== 'string' || !title.trim()) return null
  return {
    source: 'tmdb',
    sourceId: String(item.id),
    tmdbId: item.id,
    mediaType,
    title,
    originalTitle: mediaType === 'movie' ? item.original_title : item.original_name,
    posterUrl: buildImageUrl(item.poster_path, 'w185'),
    backdropUrl: buildImageUrl(item.backdrop_path, 'w500'),
    overview: typeof item.overview === 'string' ? item.overview : undefined,
    releaseDate: mediaType === 'movie' ? item.release_date : item.first_air_date,
    cast: [],
    genres: [],
    voteAverage: typeof item.vote_average === 'number' ? item.vote_average : undefined,
  }
}

const mapDetails = (details: TmdbDetails, mediaType: TmdbMediaType): RemoteMediaCandidate => ({
  source: 'tmdb',
  sourceId: String(details.id ?? ''),
  tmdbId: Number(details.id ?? 0),
  mediaType,
  title: mediaType === 'movie' ? String(details.title ?? 'Untitled') : String(details.name ?? 'Untitled'),
  originalTitle:
    mediaType === 'movie'
      ? (typeof details.original_title === 'string' ? details.original_title : undefined)
      : (typeof details.original_name === 'string' ? details.original_name : undefined),
  posterUrl: buildImageUrl(details.poster_path, 'w342'),
  backdropUrl: buildImageUrl(details.backdrop_path, 'w500'),
  overview: typeof details.overview === 'string' ? details.overview : undefined,
  releaseDate: mediaType === 'movie' ? details.release_date : details.first_air_date,
  director: getPrimaryDirector(details),
  creator: details.created_by?.find((item) => typeof item.name === 'string' && item.name.trim())?.name,
  cast: unique((details.credits?.cast ?? []).map((item) => (typeof item.name === 'string' ? item.name : '')).slice(0, 5)),
  genres: unique((details.genres ?? []).map((item) => (typeof item.name === 'string' ? item.name : '')).slice(0, 6)),
  duration: toDurationLabel(details, mediaType),
  seasons: mediaType === 'tv' && typeof details.number_of_seasons === 'number' ? details.number_of_seasons : undefined,
  episodes: mediaType === 'tv' && typeof details.number_of_episodes === 'number' ? details.number_of_episodes : undefined,
  country: details.production_countries?.find((item) => typeof item.name === 'string' && item.name.trim())?.name ?? details.origin_country?.join(' / '),
  language: typeof details.original_language === 'string' ? details.original_language.toUpperCase() : undefined,
  rating: typeof details.vote_average === 'number' ? `${details.vote_average.toFixed(1)} / 10` : undefined,
  voteAverage: typeof details.vote_average === 'number' ? details.vote_average : undefined,
})

export const dedupeMediaMatch = (rows: Array<Pick<RemoteMediaCandidate, 'tmdbId' | 'mediaType'>>, candidate: Pick<RemoteMediaCandidate, 'tmdbId' | 'mediaType'>) =>
  rows.find((item) => item.tmdbId === candidate.tmdbId && item.mediaType === candidate.mediaType)

export const hydrateRemoteMediaCandidate = async (candidate: RemoteMediaCandidate, signal?: AbortSignal): Promise<RemoteMediaCandidate> => {
  const key = getTmdbKey()
  if (!key) throw new Error('TMDb key missing')
  const url = `https://api.themoviedb.org/3/${candidate.mediaType}/${candidate.tmdbId}?api_key=${encodeURIComponent(key)}&append_to_response=credits&language=en-US`
  const details = await fetchJson<TmdbDetails>(url, signal)
  return mapDetails(details, candidate.mediaType)
}

export const searchRemoteMedia = async (query: string, signal?: AbortSignal): Promise<RemoteMediaCandidate[]> => {
  const key = getTmdbKey()
  if (!key) throw new Error('TMDb key missing')
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}&language=en-US&include_adult=false`
  const payload = await fetchJson<{ results?: TmdbSearchResult[] }>(url, signal)
  const results = (payload.results ?? [])
    .map(mapSearchResult)
    .filter((item): item is RemoteMediaCandidate => Boolean(item))

  const merged: RemoteMediaCandidate[] = []
  for (const item of results) {
    if (dedupeMediaMatch(merged, item)) continue
    merged.push(item)
  }
  return merged.slice(0, 10)
}
