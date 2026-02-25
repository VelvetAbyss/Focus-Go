import { describe, expect, it } from 'vitest'
import { applyWikiLinkSelection, detectWikiLinkTrigger } from './wikiLinks'

describe('wikiLinks', () => {
  it('detects wiki trigger after [[ before caret', () => {
    const input = 'Read [[Pro'

    const trigger = detectWikiLinkTrigger(input, input.length)

    expect(trigger).toEqual({
      query: 'Pro',
      start: 5,
      end: 10,
    })
  })

  it('returns null when trigger is already closed', () => {
    const input = 'Read [[Project]] done'

    const trigger = detectWikiLinkTrigger(input, input.length)

    expect(trigger).toBeNull()
  })

  it('applies selected wiki suggestion and keeps caret after replacement', () => {
    const input = 'Read [[Pro now'
    const trigger = detectWikiLinkTrigger(input, 10)
    if (!trigger) throw new Error('expected trigger')

    const next = applyWikiLinkSelection(input, trigger, 'Project X')

    expect(next.value).toBe('Read [[Project X]] now')
    expect(next.caret).toBe(18)
  })
})
