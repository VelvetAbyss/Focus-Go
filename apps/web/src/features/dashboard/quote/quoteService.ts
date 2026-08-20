import type { LanguageCode } from '../../../shared/i18n/types'

export type DashboardQuote = {
  content: string
  author: string
  source: string
  language: LanguageCode
}

type FetchOptions = {
  signal?: AbortSignal
}

type QuoteLike = {
  content: string
  author: string
  source: string
}

const DWYL_QUOTES_URL = 'https://raw.githubusercontent.com/dwyl/quotes/main/quotes.json'
const JAMESFT_QUOTES_URL = 'https://raw.githubusercontent.com/JamesFT/Database-Quotes-JSON/master/quotes.json'
const PRAXEDS_PROVERB_URL = 'https://chinese-proverbs.onrender.com/api/proverbs/random'
const RUANYF_CHINESE_URL = 'https://raw.githubusercontent.com/ruanyf/fortunes/master/data/chinese'
const CAOXINGYU_SENTENCE_API_URL = 'https://www.caoxingyu.club/guwen/sentence/selectall?page='
const CAOXINGYU_SENTENCE_JSON_URL = 'https://raw.githubusercontent.com/caoxingyu/chinese-gushiwen/master/sentence/sentence1-10000.json'
const LOCAL_ZH_SOURCE = 'focus-go/local-selected-quotes'

const LOCAL_QUOTES: Record<LanguageCode, QuoteLike[]> = {
  en: [
    {
      content: 'The only way to do great work is to love what you do.',
      author: 'Steve Jobs',
      source: 'snakeek/wisdom-quotes',
    },
    {
      content: 'Start where you are. Use what you have. Do what you can.',
      author: 'Arthur Ashe',
      source: 'snakeek/wisdom-quotes',
    },
    {
      content: 'What we see is mainly what we look for.',
      author: 'Unknown',
      source: 'snakeek/wisdom-quotes',
    },
  ],
  zh: [
    {
      content: '千里之行，始于足下。',
      author: '《道德经》',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '山有木兮木有枝，心悦君兮君不知。',
      author: '《越人歌》',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '天行健，君子以自强不息。',
      author: '《周易》',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '知不足而奋进，望远山而前行。',
      author: '人民日报',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '博观而约取，厚积而薄发。',
      author: '苏轼',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '路虽远，行则将至；事虽难，做则必成。',
      author: '《荀子》',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '君子藏器于身，待时而动。',
      author: '《周易》',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '日拱一卒，功不唐捐。',
      author: '胡适',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '纸上得来终觉浅，绝知此事要躬行。',
      author: '陆游',
      source: LOCAL_ZH_SOURCE,
    },
    {
      content: '不积跬步，无以至千里。',
      author: '《荀子》',
      source: LOCAL_ZH_SOURCE,
    },
  ],
}

const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)] ?? null

const toQuote = (content?: string | null, author?: string | null, source = 'unknown') => {
  const nextContent = content?.trim() ?? ''
  if (!nextContent) return null
  return {
    content: nextContent,
    author: author?.trim() || 'Unknown',
    source,
  }
}

const getMaxLength = (language: LanguageCode) => (language === 'zh' ? 40 : 120)

const normalizeChineseAuthor = (author: string, fallback: string) => {
  const nextAuthor = author.trim().replace(/^[-—~\s]+/, '')
  if (!nextAuthor || /^(unknown|chinese proverbs?)$/i.test(nextAuthor)) return fallback
  return nextAuthor
}

const sanitizeChineseQuote = (quote: QuoteLike, fallbackAuthor = '中文谚语') => {
  const content = quote.content.replace(/\s+/g, ' ').trim()
  const cjkCount = content.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const latinCount = content.match(/[a-z]/gi)?.length ?? 0
  if (content.length < 4 || content.length > getMaxLength('zh')) return null
  if (cjkCount === 0 || latinCount > cjkCount) return null
  return {
    content,
    author: normalizeChineseAuthor(quote.author, fallbackAuthor),
    source: quote.source,
  }
}

export const sanitizeChineseQuotes = (quotes: QuoteLike[], fallbackAuthor = '中文谚语') =>
  quotes
    .map((quote) => sanitizeChineseQuote(quote, fallbackAuthor))
    .filter((quote): quote is QuoteLike => Boolean(quote))

const chooseReadableQuote = (quotes: QuoteLike[], language: LanguageCode) => {
  const maxLength = getMaxLength(language)
  const readable = quotes.filter((quote) => quote.content.length <= maxLength)
  return pickRandom(readable.length > 0 ? readable : quotes)
}

const normalizeDwylQuotes = (raw: unknown): QuoteLike[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const entry = item as Record<string, unknown>
      return toQuote(
        typeof entry.text === 'string' ? entry.text : typeof entry.quote === 'string' ? entry.quote : typeof entry.content === 'string' ? entry.content : null,
        typeof entry.author === 'string' ? entry.author : typeof entry.quoteAuthor === 'string' ? entry.quoteAuthor : null,
        'dwyl/quotes',
      )
    })
    .filter((item): item is QuoteLike => Boolean(item))
}

const normalizeJamesQuotes = (raw: unknown): QuoteLike[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const entry = item as Record<string, unknown>
      return toQuote(
        typeof entry.quoteText === 'string' ? entry.quoteText : typeof entry.text === 'string' ? entry.text : null,
        typeof entry.quoteAuthor === 'string' ? entry.quoteAuthor : typeof entry.author === 'string' ? entry.author : null,
        'JamesFT/Database-Quotes-JSON',
      )
    })
    .filter((item): item is QuoteLike => Boolean(item))
}

const normalizeCaoxingyuSentence = (raw: unknown): QuoteLike | null => {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  return toQuote(
    typeof entry.name === 'string' ? entry.name : null,
    typeof entry.from === 'string' ? entry.from : '《chinese-gushiwen》',
    'caoxingyu/chinese-gushiwen',
  )
}

const parseFortuneBlocks = (content: string): QuoteLike[] =>
  content
    .split(/\n%\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
      const authorLine = [...lines].reverse().find((line) => line.startsWith('~'))
      const text = lines.filter((line) => !line.startsWith('~')).join(' ')
      return toQuote(text, authorLine ? authorLine.replace(/^~\s*/, '') : 'Unknown', 'ruanyf/fortunes')
    })
    .filter((item): item is QuoteLike => Boolean(item))

const normalizeCaoxingyuSentences = (raw: unknown): QuoteLike[] => {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeCaoxingyuSentence).filter((item): item is QuoteLike => Boolean(item))
}

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Failed to fetch quote source: ${url}`)
  return response.json() as Promise<T>
}

const fetchText = async (url: string, signal?: AbortSignal): Promise<string> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Failed to fetch quote source: ${url}`)
  return response.text()
}

const getEnglishSources = async (signal?: AbortSignal) => {
  try {
    const raw = await fetchJson<unknown>(DWYL_QUOTES_URL, signal)
    const quote = chooseReadableQuote(normalizeDwylQuotes(raw), 'en')
    if (quote) return quote
  } catch {
    // continue to next source
  }

  const raw = await fetchJson<unknown>(JAMESFT_QUOTES_URL, signal)
  const quote = chooseReadableQuote(normalizeJamesQuotes(raw), 'en')
  if (!quote) throw new Error('No quote available')
  return quote
}

const getChineseProverbSource = async (signal?: AbortSignal) => {
  const raw = await fetchJson<Record<string, unknown>>(PRAXEDS_PROVERB_URL, signal)
  const baseQuote = toQuote(
    typeof raw.proverb === 'string' ? raw.proverb : null,
    '中文谚语',
    'praxeds/chinese-proverbs-api',
  )
  const quote = baseQuote ? sanitizeChineseQuote(baseQuote) : null
  if (!quote) throw new Error('No quote available')
  return quote
}

const getRuanyfSource = async (signal?: AbortSignal) => {
  const raw = await fetchText(RUANYF_CHINESE_URL, signal)
  const quote = chooseReadableQuote(sanitizeChineseQuotes(parseFortuneBlocks(raw)), 'zh')
  if (!quote) throw new Error('No quote available')
  return quote
}

const getCaoxingyuSource = async (signal?: AbortSignal) => {
  try {
    const page = 1 + Math.floor(Math.random() * 200)
    const raw = await fetchJson<unknown>(`${CAOXINGYU_SENTENCE_API_URL}${page}`, signal)
    const quote = chooseReadableQuote(sanitizeChineseQuotes(normalizeCaoxingyuSentences(raw), '《古诗文》'), 'zh')
    if (quote) return quote
  } catch {
    // fall back to the raw dataset below
  }

  const raw = await fetchJson<unknown>(CAOXINGYU_SENTENCE_JSON_URL, signal)
  const quote = chooseReadableQuote(sanitizeChineseQuotes(normalizeCaoxingyuSentences(raw), '《古诗文》'), 'zh')
  if (!quote) throw new Error('No quote available')
  return quote
}

const getLocalFallbackQuote = (language: LanguageCode) => pickRandom(LOCAL_QUOTES[language]) ?? LOCAL_QUOTES[language][0]

export const getDashboardQuote = async (language: LanguageCode, options: FetchOptions = {}): Promise<DashboardQuote> => {
  const { signal } = options
  const source = language === 'zh'
    ? [() => Promise.resolve(getLocalFallbackQuote('zh')), getChineseProverbSource, getRuanyfSource, getCaoxingyuSource]
    : [getEnglishSources]

  for (const load of source) {
    try {
      const quote = await load(signal)
      return { ...quote, language }
    } catch {
      // continue to the next candidate
    }
  }

  return { ...getLocalFallbackQuote(language), language }
}

export const getLocalDashboardQuote = (language: LanguageCode): DashboardQuote => ({
  ...getLocalFallbackQuote(language),
  language,
})
