import { describe, expect, it } from 'vitest'
import { createTaskNoteDoc, resolveTaskNoteRichText } from './taskNoteRichText'

describe('resolveTaskNoteRichText', () => {
  it('prefers the stored rich-text document when there is one', () => {
    const contentJson = createTaskNoteDoc([
      { type: 'paragraph', content: [{ type: 'text', text: 'from json' }] },
    ])
    const resolved = resolveTaskNoteRichText({
      taskNoteContentJson: contentJson as Record<string, unknown>,
      taskNoteContentMd: 'from markdown',
    })

    expect(resolved.contentJson).toBe(contentJson)
    expect(resolved.contentMd).toBe('from markdown')
  })

  // The Obsidian plugin (apps/obsidian-plugin) cannot regenerate the TipTap
  // document from markdown, so when a note is edited in the vault it writes
  // taskNoteContentMd and clears taskNoteContentJson. That edit is only visible
  // in the app because of this fallback — if it goes away, vault edits to a task
  // note silently stop showing up here.
  it('rebuilds the document from markdown when the rich-text mirror is cleared', () => {
    const resolved = resolveTaskNoteRichText({
      taskNoteContentJson: null,
      taskNoteContentMd: 'edited in Obsidian',
    })

    expect(resolved.contentMd).toBe('edited in Obsidian')
    expect(JSON.stringify(resolved.contentJson)).toContain('edited in Obsidian')
  })

  it('falls back to legacy blocks when neither is present', () => {
    const resolved = resolveTaskNoteRichText({
      taskNoteContentJson: null,
      taskNoteContentMd: '',
      taskNoteBlocks: [{ id: 'b1', type: 'paragraph', text: 'legacy text' }],
    })

    expect(resolved.contentMd).toContain('legacy text')
  })
})
