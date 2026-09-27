import { describe, expect, it } from 'vitest'
import { mergeAttributes } from '@tiptap/react'

// Regression guard for GHSA-cp6q-959q-f8rh. Our custom nodes (image-upload,
// horizontal-rule) pass attributes through mergeAttributes. Before
// @tiptap/core 3.30.4 an own `__proto__` key was assigned rather than defined,
// which swapped the merged object's prototype — so an attacker-supplied
// `{"__proto__": {"onerror": "..."}}` surfaced as an *inherited* attribute that
// DOM serialisation (which walks attributes with for…in) then wrote to the page.
describe('mergeAttributes prototype safety', () => {
  const payload = () => JSON.parse('{"__proto__": {"onerror": "alert(1)"}}') as Record<string, unknown>

  it('does not let an own __proto__ key replace the prototype', () => {
    const merged = mergeAttributes({ 'data-type': 'image-upload' }, payload())
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
  })

  it('does not expose attacker keys as inherited, enumerable attributes', () => {
    const merged = mergeAttributes({ 'data-type': 'image-upload' }, payload())

    const walked: string[] = []
    for (const key in merged) walked.push(key)

    expect('onerror' in merged).toBe(false)
    expect(walked).not.toContain('onerror')
  })

  it('still merges ordinary attributes', () => {
    const merged = mergeAttributes({ class: 'a', 'data-type': 'hr' }, { class: 'b', id: 'x' })
    expect(merged).toMatchObject({ class: 'a b', 'data-type': 'hr', id: 'x' })
  })
})
