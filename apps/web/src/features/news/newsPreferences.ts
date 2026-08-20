import type { NewsCategory } from './newsApi'

export type NewsDensity = 'comfortable' | 'compact'

export type NewsCategoryTab = NewsCategory | 'all' | 'custom'

export type NewsPreferences = {
  enabledSourceIds: string[]
  sourceOrder: string[]
  customSourceIds: string[]
  density: NewsDensity
  selectedCategory: NewsCategoryTab
}

const STORAGE_KEY = 'focusgo.news.preferences.v1'

export const DEFAULT_ENABLED_SOURCE_IDS = [
  // hot
  'zhihu',
  'weibo',
  'baidu',
  'toutiao',
  'bilibili',
  'hackernews',
  'github',
  // tech
  'ithome',
  'sspai',
  '36kr',
  'producthunt',
  'v2ex',
  'juejin',
  // finance
  'wallstreetcn',
  'cls',
  'xueqiu',
  'jin10',
  'gelonghui',
  // foreign starter set
  'bbc_world',
  'guardian_world',
  'npr_news',
  'france24_en',
  'aljazeera_en',
  'techcrunch',
  'theverge',
  'cnbc_business',
]

// Sources that are off by default but available to enable
export const EXTRA_SOURCE_IDS = [
  'douyin',
  'xiaoheihe',
  'bbc_top',
  'nyt_world',
  'france24_fr',
  'cnn_top',
  'cnn_world',
  'dw_top',
  'dw_world',
  'nhk_world',
  'japantimes',
  'scmp',
  'straits_times',
  'cbc_top',
  'abc_au',
  'skynews_world',
  'independent_world',
  'hindu_world',
  'ndtv_world',
  'bbc_tech',
  'bbc_science',
  'guardian_tech',
  'nyt_tech',
  'arstechnica',
  'wired',
  'engadget',
  'bbc_business',
  'guardian_business',
  'nyt_business',
  'cnbc_world',
  'marketwatch_top',
]

export const DEFAULT_NEWS_PREFERENCES: NewsPreferences = {
  enabledSourceIds: DEFAULT_ENABLED_SOURCE_IDS,
  sourceOrder: DEFAULT_ENABLED_SOURCE_IDS,
  customSourceIds: [],
  density: 'comfortable',
  selectedCategory: 'all',
}

const isDensity = (value: unknown): value is NewsDensity => value === 'comfortable' || value === 'compact'
const isCategory = (value: unknown): value is NewsPreferences['selectedCategory'] =>
  value === 'all' || value === 'hot' || value === 'tech' || value === 'finance' || value === 'world' || value === 'custom'

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
      customSourceIds: readArray(parsed.customSourceIds, []),
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
