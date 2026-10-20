import { describe, expect, it } from 'vitest'
import { MODEL_PACKS, modelRoute, resolveSource, sentenceChunks, splitParagraph, textParts, translateParagraphs } from './translation'

describe('translation text and model routing', () => {
  it('keeps mixed Chinese, emoji and surrogate pairs within the API byte limit', () => {
    const text = '确认交货日期🙂 Please confirm the delivery date. '.repeat(60)
    const chunks = splitParagraph(text)
    expect(chunks.join('')).toBe(text)
    expect(chunks.every(chunk => new TextEncoder().encode(chunk).length <= 450)).toBe(true)
    expect(chunks.every(chunk => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u.test(chunk))).toBe(true)
  })

  it('does not merge paragraphs or normalize line endings', async () => {
    const text = '  First paragraph.\r\n\r\nSecond paragraph.\n\n'
    expect(textParts(text).join('')).toBe(text)
    const seen: string[] = []
    const result = await translateParagraphs(text, 'zh', async chunk => { seen.push(chunk); return '译文' }, new AbortController().signal)
    expect(result).toBe('  译文\r\n\r\n译文\n\n')
    expect(seen).toEqual(['First paragraph.', 'Second paragraph.'])
  })

  it('adds a word separator when long Chinese text is translated into English', async () => {
    const result = await translateParagraphs('中'.repeat(180), 'en', async () => 'a sentence', new AbortController().signal)
    expect(result).toBe('a sentence a sentence')
  })

  it('stops before the next segment after cancellation', async () => {
    const controller = new AbortController()
    let calls = 0
    await expect(translateParagraphs('one\n\ntwo', 'zh', async () => {
      calls++; controller.abort(); return '译文'
    }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(calls).toBe(1)
  })

  it('rejects empty text and oversized text instead of truncating it', async () => {
    const translate = async (chunk: string) => chunk
    await expect(translateParagraphs('  ', 'en', translate, new AbortController().signal)).rejects.toMatchObject({ code: 'empty' })
    await expect(translateParagraphs('a'.repeat(20_001), 'en', translate, new AbortController().signal)).rejects.toMatchObject({ code: 'too-long' })
  })

  it('uses a direct model or exactly two English pivot models', () => {
    expect(modelRoute('en', 'zh').map(pack => pack.id)).toEqual(['en-zh'])
    expect(modelRoute('zh', 'de').map(pack => pack.id)).toEqual(['zh-en', 'en-de'])
    expect(modelRoute('fr', 'es').map(pack => pack.id)).toEqual(['fr-en', 'en-es'])
    expect(modelRoute('zh', 'zh')).toEqual([])
    expect(() => modelRoute('ja', 'zh')).toThrow('unsupported')
    expect(MODEL_PACKS.every(pack => /^[a-f0-9]{40}$/.test(pack.revision))).toBe(true)
  })

  it('only auto-detects the Chinese/English scope promised by the UI', () => {
    expect(resolveSource('auto', '请确认')).toBe('zh')
    expect(resolveSource('auto', 'Please confirm')).toBe('en')
    expect(resolveSource('fr', 'Bonjour')).toBe('fr')
  })

  it('allows an expanded intermediate paragraph without raising the input limit', async () => {
    const intermediate = 'word '.repeat(4_100)
    const result = await translateParagraphs(intermediate, 'de', async text => text, new AbortController().signal, undefined, intermediate.length)
    expect(result).toBe(intermediate)
  })

  it('translates offline sentences independently without changing decimal numbers or whitespace', () => {
    const text = 'Please confirm $49.90. We will send 12 units. 请确认交货日期。谢谢。'
    const chunks = sentenceChunks(text)
    expect(chunks.join('')).toBe(text)
    expect(chunks.length).toBe(4)
    expect(chunks[0]).toBe('Please confirm $49.90. ')
  })
})
