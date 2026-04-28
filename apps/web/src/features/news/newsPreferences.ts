import type { NewsCategory } from './newsApi'

export type NewsDensity = 'comfortable' | 'compact'

export type NewsPreferences = {
  enabledSourceIds: string[]
  sourceOrder: string[]
  density: NewsDensity
  selectedCategory: NewsCategory | 'all'
}

const STORAGE_KEY = 'focusgo.news.preferences.v1'

export const DEFAULT_ENABLED_SOURCE_IDS = [
  'zhihu',
  'weibo',
  'baidu',
  'toutiao',
  'hackernews',
  'github',
  'ithome',
  'sspai',
  '36kr',
  'producthunt',
  'wallstreetcn',
  'cls',
  'xueqiu',
]

export const DEFAULT_NEWS_PREFERENCES: NewsPreferences = {
  enabledSourceIds: DEFAULT_ENABLED_SOURCE_IDS,
  sourceOrder: DEFAULT_ENABLED_SOURCE_IDS,
  density: 'comfortable',
  selectedCategory: 'all',
}

const isDensity = (value: unknown): value is NewsDensity => value === 'comfortable' || value === 'compact'
const isCategory = (value: unknown): value is NewsPreferences['selectedCategory'] =>
  value === 'all' || value === 'hot' || value === 'tech' || value === 'finance'

const readArray = (value: unknown, fallback: string[]) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : fallback

export const readNewsPreferences = (): NewsPreferences => {
  if (typeof localStorage === 'undefined') return DEFAULT_NEWS_PREFERENCES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_NEWS_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<NewsPreferences>
    return {
      enabledSourceIds: readArray(parsed.enabledSourceIds, DEFAULT_ENABLED_SOURCE_IDS),
      sourceOrder: readArray(parsed.sourceOrder, DEFAULT_ENABLED_SOURCE_IDS),
      density: isDensity(parsed.density) ? parsed.density : DEFAULT_NEWS_PREFERENCES.density,
      selectedCategory: isCategory(parsed.selectedCategory) ? parsed.selectedCategory : DEFAULT_NEWS_PREFERENCES.selectedCategory,
    }
  } catch {
    return DEFAULT_NEWS_PREFERENCES
  }
}

export const writeNewsPreferences = (preferences: NewsPreferences) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
}
