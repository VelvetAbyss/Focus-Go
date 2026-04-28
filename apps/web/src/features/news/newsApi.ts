import { fetchApi } from '../../shared/apiBase'

export type NewsCategory = 'hot' | 'tech' | 'finance'
export type NewsSourceType = 'hottest' | 'realtime'

export type NewsSource = {
  id: string
  name: string
  category: NewsCategory
  type: NewsSourceType
  interval: number
  home: string
  accent: string
}

export type NewsItem = {
  id: string
  title: string
  url: string
  mobileUrl?: string
  pubDate?: number | string
  extra?: {
    info?: string | false
    hover?: string
    date?: number | string
  }
}

export type NewsSourceResponse = {
  status: 'success' | 'cache'
  id: string
  updatedTime: number | string
  items: NewsItem[]
  warning?: string
}

export type NewsRefreshResponse = {
  results: Array<NewsSourceResponse | { status: 'error'; id: string; error: string }>
}

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetchApi(path, init)
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`News request failed: ${response.status}${detail ? ` ${detail}` : ''}`)
  }
  return response.json() as Promise<T>
}

export const fetchNewsSources = async (signal?: AbortSignal) => {
  const payload = await fetchJson<{ sources: NewsSource[] }>('/news/sources', { signal })
  return payload.sources
}

export const fetchNewsSource = async (id: string, options: { latest?: boolean; signal?: AbortSignal } = {}) => {
  const params = new URLSearchParams({ id })
  if (options.latest) params.set('latest', '1')
  return fetchJson<NewsSourceResponse>(`/news/source?${params.toString()}`, { signal: options.signal })
}

export const refreshNewsSources = async (ids: string[], signal?: AbortSignal) =>
  fetchJson<NewsRefreshResponse>('/news/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    signal,
  })
