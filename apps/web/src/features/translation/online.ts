import { LANGUAGES, TranslationError, translateParagraphs, type Language } from './translation'

export const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'
const QUOTA_KEY = 'focusgo.translation.mymemory-quota-day'
const today = () => new Date().toISOString().slice(0, 10)

function quotaBlocked() {
  try { return localStorage.getItem(QUOTA_KEY) === today() } catch { return false }
}

function markQuotaBlocked() {
  try { localStorage.setItem(QUOTA_KEY, today()) } catch { /* Provider enforces the actual quota. */ }
}

/** Anonymous endpoint only. Never attach an account, email, key, or paid fallback. */
export async function translateOnline(
  text: string, source: Language, target: Language, signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  if (source === target) return text
  if (quotaBlocked()) throw new TranslationError('quota')
  const sourceCode = LANGUAGES.find(language => language.id === source)!.api
  const targetCode = LANGUAGES.find(language => language.id === target)!.api
  return translateParagraphs(text, target, async chunk => {
    if (quotaBlocked()) throw new TranslationError('quota')
    const url = new URL(MYMEMORY_ENDPOINT)
    url.search = new URLSearchParams({ q: chunk, langpair: `${sourceCode}|${targetCode}` }).toString()
    let response: Response
    try {
      response = await fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      })
    } catch (error) {
      if (signal.aborted) throw error
      throw new TranslationError('network')
    }
    if (response.status === 429) { markQuotaBlocked(); throw new TranslationError('quota') }
    if (!response.ok) throw new TranslationError('network')
    let data: { responseStatus?: number | string; quotaFinished?: boolean; responseData?: { translatedText?: string } }
    try { data = await response.json() } catch { throw new TranslationError('network') }
    if (data.quotaFinished || Number(data.responseStatus) === 429 || Number(data.responseStatus) === 403) {
      markQuotaBlocked()
      throw new TranslationError('quota')
    }
    if (Number(data.responseStatus) !== 200 || typeof data.responseData?.translatedText !== 'string') {
      throw new TranslationError('network')
    }
    return data.responseData.translatedText
  }, signal, onProgress)
}
