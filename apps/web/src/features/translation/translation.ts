import models from './models.json'

export const LANGUAGES = [
  { id: 'en', zh: '英语', en: 'English', api: 'en' },
  { id: 'zh', zh: '简体中文', en: 'Chinese', api: 'zh-CN' },
  { id: 'de', zh: '德语', en: 'German', api: 'de' },
  { id: 'fr', zh: '法语', en: 'French', api: 'fr' },
  { id: 'es', zh: '西班牙语', en: 'Spanish', api: 'es' },
  { id: 'ja', zh: '日语', en: 'Japanese', api: 'ja' },
  { id: 'ko', zh: '韩语', en: 'Korean', api: 'ko' },
  { id: 'pt', zh: '葡萄牙语', en: 'Portuguese', api: 'pt' },
  { id: 'it', zh: '意大利语', en: 'Italian', api: 'it' },
  { id: 'ru', zh: '俄语', en: 'Russian', api: 'ru' },
  { id: 'ar', zh: '阿拉伯语', en: 'Arabic', api: 'ar' },
] as const
export type Language = typeof LANGUAGES[number]['id']
export type SourceLanguage = Language | 'auto'
export type TranslationMode = 'online' | 'offline'
export type ModelPack = typeof models[number]
export const MODEL_PACKS = models
export const MAX_TEXT_LENGTH = 20_000
export const MODEL_CACHE = 'focusgo-translation-models-v1'
export const RUNTIME_CACHE = 'focusgo-translation-runtime-3.8.1'

export type TranslationErrorCode = 'quota' | 'network' | 'storage' | 'download' | 'missing-pack' | 'unsupported' | 'empty' | 'too-long' | 'runtime'
export class TranslationError extends Error {
  readonly code: TranslationErrorCode
  constructor(code: TranslationErrorCode) {
    super(code)
    this.code = code
  }
}

/** Auto is deliberately limited to Chinese/English. Other languages are selected explicitly. */
export const resolveSource = (source: SourceLanguage, text: string): Language =>
  source === 'auto' ? (/\p{Script=Han}/u.test(text) ? 'zh' : 'en') : source

export function modelRoute(source: Language, target: Language): ModelPack[] {
  if (source === target) return []
  const direct = MODEL_PACKS.find(pack => pack.id === `${source}-${target}`)
  if (direct) return [direct]
  const first = MODEL_PACKS.find(pack => pack.id === `${source}-en`)
  const second = MODEL_PACKS.find(pack => pack.id === `en-${target}`)
  if (first && second) return [first, second]
  throw new TranslationError('unsupported')
}

export const modelURL = (pack: ModelPack, file: string) =>
  `https://huggingface.co/${pack.model}/resolve/${pack.revision}/${file}`

/** Keep paragraph separators untouched; every request contains at most one paragraph. */
export function textParts(text: string): string[] {
  return text.split(/((?:\r?\n)+)/).filter(Boolean)
}

/** UTF-8 byte limits, safe for surrogate pairs. Prefer sentence or word boundaries. */
export function splitParagraph(text: string, maxBytes = 450): string[] {
  if (maxBytes < 4) throw new RangeError('maxBytes must be at least 4')
  const encoder = new TextEncoder()
  const result: string[] = []
  let remaining = text
  while (encoder.encode(remaining).length > maxBytes) {
    let end = 0
    let bytes = 0
    for (const char of remaining) {
      const size = encoder.encode(char).length
      if (bytes + size > maxBytes) break
      bytes += size
      end += char.length
    }
    const candidate = remaining.slice(0, end)
    const breaks = [...candidate.matchAll(/[.!?。！？；;]\s*|\s+/gu)]
    const boundary = breaks.filter(match => match.index! + match[0].length >= end / 2).at(-1)
    if (boundary) end = boundary.index! + boundary[0].length
    result.push(remaining.slice(0, end))
    remaining = remaining.slice(end)
  }
  if (remaining) result.push(remaining)
  return result
}

/** OPUS-MT is trained on sentences. Keep independent sentences out of the same generation. */
export function sentenceChunks(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return splitParagraph(text, 300)
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' })
  return [...segmenter.segment(text)].flatMap(part => splitParagraph(part.segment, 300))
}

export async function translateParagraphs(
  text: string,
  target: Language,
  translate: (chunk: string) => Promise<string>,
  signal: AbortSignal,
  onProgress?: (done: number, total: number) => void,
  maxLength = MAX_TEXT_LENGTH,
  split = splitParagraph,
): Promise<string> {
  if (!text.trim()) throw new TranslationError('empty')
  if (text.length > maxLength) throw new TranslationError('too-long')
  const parts = textParts(text).map(part => /^\s*$/u.test(part) ? [part] : split(part))
  const total = parts.flat().filter(part => part.trim()).length
  let done = 0
  const output: string[] = []
  for (const chunks of parts) {
    const paragraph: string[] = []
    for (const chunk of chunks) {
      signal.throwIfAborted()
      if (!chunk.trim()) { paragraph.push(chunk); continue }
      const leading = chunk.match(/^\s*/u)![0]
      const trailing = chunk.match(/\s*$/u)![0]
      const translated = (await translate(chunk.trim())).trim()
      signal.throwIfAborted()
      if (!translated) throw new TranslationError('runtime')
      const last = paragraph.at(-1)
      // Chinese has no word spaces; a split Chinese paragraph translated to Latin text needs one.
      const joiner = last && !/\s$/u.test(last) && !leading && !['zh', 'ja'].includes(target) ? ' ' : ''
      paragraph.push(joiner + leading + translated + trailing)
      onProgress?.(++done, total)
    }
    output.push(paragraph.join(''))
  }
  return output.join('')
}

export const BUSINESS_EXPRESSIONS = [
  { zh: '请确认交货日期。', en: 'Could you please confirm the delivery date?' },
  { zh: '附件供您审阅，请查收。', en: 'Please find the attachment for your review.' },
  { zh: '如有任何问题，请随时与我联系。', en: 'Please let me know if you have any questions.' },
  { zh: '感谢您的跟进，期待您的回复。', en: 'Thank you for following up. I look forward to hearing from you.' },
] as const
