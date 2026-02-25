import { describe, expect, it } from 'vitest'
import {
  appendReviewBlock,
  buildSubmitPayload,
  extractReviewBlocks,
  hasReviewBlock,
  serializeReviewBlock,
} from './reviewDiaryBridge'

describe('reviewDiaryBridge', () => {
  it('serializes review block with metadata boundaries', () => {
    const output = serializeReviewBlock({
      inboxCount: '3',
      inboxCleared: true,
      focusScore: '78',
      reflectionNote: 'Strong execution today.',
      mustDo1: 'Task A',
      mustDo2: 'Task B',
      mustDo3: 'Task C',
      submittedAt: 1700000000000,
    })

    expect(output).toContain('<!-- REVIEW_BLOCK_START {"version":1,"submittedAt":1700000000000} -->')
    expect(output).toContain('## Review Snapshot')
    expect(output).toContain('### Reflection')
    expect(output).toContain('<!-- REVIEW_BLOCK_END -->')
  })

  it('appends to non-empty content and keeps empty content clean', () => {
    const payload = {
      inboxCount: '0',
      reflectionNote: 'Done.',
      submittedAt: 1700000000000,
    }

    const emptyAppended = appendReviewBlock('', payload)
    expect(emptyAppended.startsWith('<!-- REVIEW_BLOCK_START')).toBe(true)

    const existing = '# Diary\nToday was good.'
    const appended = appendReviewBlock(existing, payload)
    expect(appended).toContain(existing)
    expect(appended).toMatch(/\n\n<!-- REVIEW_BLOCK_START/)
  })

  it('extracts multiple valid blocks and tolerates broken ones', () => {
    const valid1 = serializeReviewBlock({
      reflectionNote: 'First reflection',
      focusScore: '70',
      submittedAt: 1700000000000,
    })
    const invalid =
      '<!-- REVIEW_BLOCK_START {"version":1,"submittedAt":"bad"} -->\nfoo\n<!-- REVIEW_BLOCK_END -->'
    const valid2 = serializeReviewBlock({
      reflectionNote: 'Second reflection with more text',
      focusScore: '88',
      submittedAt: 1700000100000,
    })

    const source = `${valid1}\n\n${invalid}\n\n${valid2}`
    const blocks = extractReviewBlocks(source)

    expect(blocks).toHaveLength(2)
    expect(blocks[0].submittedAt).toBe(1700000100000)
    expect(blocks[0].summary.focusScore).toBe('88')
    expect(blocks[1].submittedAt).toBe(1700000000000)
  })

  it('detects whether content includes a review block', () => {
    const withBlock = serializeReviewBlock({
      reflectionNote: 'Reflection',
      submittedAt: 1700000000000,
    })
    expect(hasReviewBlock(withBlock)).toBe(true)
    expect(hasReviewBlock('plain diary content')).toBe(false)
  })

  it('builds submit payload from session answers', () => {
    const payload = buildSubmitPayload(
      {
        inboxCount: '5',
        inboxCleared: true,
        focusScore: '66',
        reflectionNote: 'Keep going',
        mustDo1: 'A',
      },
      1700000000000
    )
    expect(payload).toEqual({
      inboxCount: '5',
      inboxCleared: true,
      focusScore: '66',
      reflectionNote: 'Keep going',
      mustDo1: 'A',
      mustDo2: undefined,
      mustDo3: undefined,
      submittedAt: 1700000000000,
    })
  })
})

