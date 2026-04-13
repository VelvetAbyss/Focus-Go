export type CitySuggestion = {
  id: string
  label: string
  searchValue: string
  score: number
  source: 'local' | 'remote'
}

type OpenMeteoGeocodeResponse = {
  results?: Array<{
    id?: number
    name?: string
    country?: string
    admin1?: string
  }>
}

type OpenMeteoGeocodeResult = NonNullable<OpenMeteoGeocodeResponse['results']>[number]

export const MIN_CITY_QUERY_LENGTH = 2
export const MAX_CITY_SUGGESTIONS = 8

const LOCAL_CITY_CANDIDATES: Array<{ label: string; tokens: string[] }> = [
  { label: 'Hangzhou, China', tokens: ['hangzhou', 'hang zhou', 'hz', '杭州'] },
  { label: 'Beijing, China', tokens: ['beijing', 'peking', '北京'] },
  { label: 'Shanghai, China', tokens: ['shanghai', '上海'] },
  { label: 'Shenzhen, China', tokens: ['shenzhen', '深圳'] },
  { label: 'Guangzhou, China', tokens: ['guangzhou', 'guang zhou', '广州'] },
  { label: 'Chengdu, China', tokens: ['chengdu', 'cheng du', '成都'] },
  { label: 'Wuhan, China', tokens: ['wuhan', '武汉'] },
  { label: 'Nanjing, China', tokens: ['nanjing', '南京'] },
  { label: "Xi'an, China", tokens: ['xian', "xi'an", '西安'] },
  { label: 'Tokyo, Japan', tokens: ['tokyo'] },
  { label: 'Seoul, South Korea', tokens: ['seoul'] },
  { label: 'Singapore, Singapore', tokens: ['singapore'] },
  { label: 'London, United Kingdom', tokens: ['london'] },
  { label: 'Paris, France', tokens: ['paris'] },
  { label: 'Berlin, Germany', tokens: ['berlin'] },
  { label: 'Sydney, Australia', tokens: ['sydney'] },
  { label: 'New York, United States', tokens: ['new york', 'nyc'] },
  { label: 'Los Angeles, United States', tokens: ['los angeles', 'la'] },
  { label: 'San Francisco, United States', tokens: ['san francisco', 'sf'] },
  { label: 'Chicago, United States', tokens: ['chicago'] },
]

const CJK_CHAR_RE = /[\u3400-\u9fff]/u

const hasCjkChar = (value: string) => CJK_CHAR_RE.test(value)

export const normalizeQuery = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const getSubsequenceScore = (query: string, target: string) => {
  let queryIndex = 0
  let penalty = 0
  for (let targetIndex = 0; targetIndex < target.length && queryIndex < query.length; targetIndex += 1) {
    if (target[targetIndex] === query[queryIndex]) queryIndex += 1
    else penalty += 1
  }
  if (queryIndex !== query.length) return -1
  return 420 - penalty
}

const getTokenMatchScore = (query: string, token: string) => {
  if (!query || !token) return -1
  if (token.startsWith(query)) return 1200 - (token.length - query.length)

  const containsIndex = token.indexOf(query)
  if (containsIndex >= 0) return 800 - containsIndex * 2 - (token.length - query.length)

  return getSubsequenceScore(query, token)
}

export const buildLocalSuggestions = (query: string): CitySuggestion[] => {
  const normalizedQuery = normalizeQuery(query)
  if (normalizedQuery.length < MIN_CITY_QUERY_LENGTH) return []

  return LOCAL_CITY_CANDIDATES.map((candidate) => {
    const tokens = [candidate.label, ...candidate.tokens].map((token) => normalizeQuery(token))
    const score = Math.max(...tokens.map((token) => getTokenMatchScore(normalizedQuery, token)))
    return {
      id: `local:${candidate.label}`,
      label: candidate.label,
      searchValue: candidate.label,
      score,
      source: 'local' as const,
    }
  })
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CITY_SUGGESTIONS)
}

export const searchRemoteCitySuggestions = async (query: string, signal: AbortSignal): Promise<CitySuggestion[]> => {
  const normalizedQuery = normalizeQuery(query)
  if (normalizedQuery.length < MIN_CITY_QUERY_LENGTH) return []

  const languages: Array<'en' | 'zh'> = hasCjkChar(query) ? ['zh', 'en'] : ['en', 'zh']
  const resultsByLang = await Promise.all(
    languages.map(async (language) => {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${MAX_CITY_SUGGESTIONS}&language=${language}&format=json`,
        { signal }
      )
      if (!response.ok) return [] as OpenMeteoGeocodeResult[]
      const payload = (await response.json()) as OpenMeteoGeocodeResponse
      return payload.results ?? []
    })
  )

  return resultsByLang
    .flat()
    .reduce<CitySuggestion[]>((acc, result, index) => {
      const name = result?.name?.trim()
      if (!name) return acc

      const suffix = [result.admin1, result.country].filter(Boolean).join(', ')
      const label = suffix ? `${name}, ${suffix}` : name
      const score = Math.max(
        getTokenMatchScore(normalizedQuery, normalizeQuery(name)),
        getTokenMatchScore(normalizedQuery, normalizeQuery(label))
      )
      if (score < 0) return acc

      acc.push({
        id: `remote:${result.id ?? `${label}:${index}`}`,
        label,
        searchValue: label,
        score,
        source: 'remote' as const,
      })
      return acc
    }, [])
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CITY_SUGGESTIONS)
}
