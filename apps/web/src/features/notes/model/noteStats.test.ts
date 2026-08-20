import { describe, expect, it } from 'vitest'
import { countWordsInMarkdown, countCharactersInMarkdown, countCharactersNoSpacesInMarkdown } from './noteStats'

describe('noteStats', () => {
  it('excludes image markdown from text stats', () => {
    const content = 'ab cd\n\n![preview](data:image/png;base64,abcdef)\n\nef'

    expect(countWordsInMarkdown(content)).toBe(3)
    expect(countCharactersInMarkdown(content)).toBe(11)
    expect(countCharactersNoSpacesInMarkdown(content)).toBe(6)
  })
})
