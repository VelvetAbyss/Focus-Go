import type { LanguageCode } from './types'

type MessageRecord = Record<string, string>

// In-memory cache. Once a language is loaded it stays in memory —
// toggling EN↔ZH at runtime will not refetch.
const cache = new Map<LanguageCode, MessageRecord>()
const inflight = new Map<LanguageCode, Promise<MessageRecord>>()

const importers: Record<LanguageCode, () => Promise<{ default?: MessageRecord } & Record<string, unknown>>> = {
  en: () => import('./messages/en'),
  zh: () => import('./messages/zh'),
}

const pickMessages = (lang: LanguageCode, mod: Record<string, unknown>): MessageRecord => {
  // messages files export `enMessages` / `zhMessages`
  const namedKey = `${lang}Messages`
  const named = mod[namedKey]
  if (named && typeof named === 'object') return named as MessageRecord
  if (mod.default && typeof mod.default === 'object') return mod.default as MessageRecord
  throw new Error(`[i18n] message module for "${lang}" has no recognizable export`)
}

export const loadLanguage = async (lang: LanguageCode): Promise<MessageRecord> => {
  const hit = cache.get(lang)
  if (hit) return hit
  const existing = inflight.get(lang)
  if (existing) return existing
  const p = importers[lang]()
    .then((mod) => {
      const messages = pickMessages(lang, mod)
      cache.set(lang, messages)
      inflight.delete(lang)
      return messages
    })
    .catch((err) => {
      inflight.delete(lang)
      throw err
    })
  inflight.set(lang, p)
  return p
}

export const getCachedMessages = (lang: LanguageCode): MessageRecord | undefined => cache.get(lang)

// Test/synchronous priming — lets tests or the mock helper inject messages
// without going through the dynamic importer.
export const primeMessages = (lang: LanguageCode, messages: MessageRecord) => {
  cache.set(lang, messages)
}
