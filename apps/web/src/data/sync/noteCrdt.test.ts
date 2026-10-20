// @vitest-environment jsdom
import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { applyNoteCrdt, containsNoteCrdtState, createNoteCrdt, encodeNoteCrdt, isNoteCrdtSnapshot, mergeNoteCrdt, noteCrdtProjection } from './noteCrdt'

const original = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] }
const text = (doc: Y.Doc) => (doc.getXmlFragment('default').get(0) as Y.XmlElement).get(0) as Y.XmlText

describe('mergeable note bodies', () => {
  it('merges concurrent edits seeded from the same legacy note without duplicating its body', () => {
    const a = createNoteCrdt(original)
    const b = createNoteCrdt(original)
    text(a).insert(0, 'A: ')
    text(b).insert(text(b).length, '!')
    const local = { id: 'n', updatedAt: 2, ...noteCrdtProjection(a) }
    const remote = { id: 'n', updatedAt: 3, ...noteCrdtProjection(b) }
    const merged = mergeNoteCrdt(local, remote)
    expect(merged?.contentMd).toContain('A: Hello world!')
    expect(containsNoteCrdtState(String(merged!.crdtState), encodeNoteCrdt(a))).toBe(true)
    expect(containsNoteCrdtState(encodeNoteCrdt(a), encodeNoteCrdt(b))).toBe(false)
    applyNoteCrdt(a, String(merged!.crdtState))
    applyNoteCrdt(b, String(merged!.crdtState))
    expect(noteCrdtProjection(a).contentJson).toEqual(noteCrdtProjection(b).contentJson)
    a.destroy(); b.destroy()
  })

  it('preserves image-upload placeholders, existing images and surrounding text through CRDT reopening and merge', () => {
    const content = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Before the upload' }] },
      { type: 'imageUpload', attrs: { accept: 'image/*', limit: 3, maxSize: 10485760 } },
      { type: 'image', attrs: { src: 'data:image/png;base64,aGVsbG8=', alt: 'Existing attachment', title: 'Keep this image' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'After the upload' }] },
    ] }
    const first = createNoteCrdt(content)
    const snapshot = noteCrdtProjection(first)
    expect(snapshot.contentJson.content).toMatchObject(content.content)
    expect(isNoteCrdtSnapshot(snapshot)).toBe(true)
    const reopened = createNoteCrdt(content, snapshot.crdtState)
    expect(noteCrdtProjection(reopened).contentJson).toEqual(snapshot.contentJson)
    text(first).insert(0, 'Edited: ')
    const merged = mergeNoteCrdt({ id: 'image-note', ...noteCrdtProjection(first) }, { id: 'image-note', ...snapshot })
    expect(merged?.contentMd).toContain('Edited: Before the upload')
    expect(merged?.contentMd).toContain('After the upload')
    expect((merged?.contentJson as { content: unknown[] }).content).toEqual(expect.arrayContaining([
      expect.objectContaining(content.content[1]), expect.objectContaining({ type: 'image', attrs: expect.objectContaining(content.content[2].attrs) }),
    ]))
    first.destroy(); reopened.destroy()
  })

  it('replays snapshots idempotently and preserves remote deletions in the body', () => {
    const a = createNoteCrdt(original)
    const b = createNoteCrdt(original)
    text(a).delete(0, 6)
    const state = encodeNoteCrdt(a)
    applyNoteCrdt(b, state); applyNoteCrdt(b, state)
    expect(noteCrdtProjection(b).contentMd).toBe('world')
    a.destroy(); b.destroy()
  })

  it('keeps legacy, mixed-version, invalid and deleted records on the conflict recovery path', () => {
    const doc = createNoteCrdt(original)
    const snapshot = { id: 'n', ...noteCrdtProjection(doc) }
    expect(mergeNoteCrdt(snapshot, { ...snapshot, crdtState: undefined })).toBeNull()
    expect(mergeNoteCrdt(snapshot, { ...snapshot, contentJson: { type: 'doc', content: [] } })).toBeNull()
    expect(mergeNoteCrdt(snapshot, { ...snapshot, _deleted: true })).toBeNull()
    expect(mergeNoteCrdt(snapshot, { ...snapshot, crdtState: 'invalid' })).toBeNull()
    expect(containsNoteCrdtState(String(snapshot.crdtState), 'invalid')).toBe(false)
    expect(containsNoteCrdtState('', String(snapshot.crdtState))).toBe(false)
    const unrelated = createNoteCrdt({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Another legacy version' }] }] })
    expect(mergeNoteCrdt(snapshot, { id: 'n', ...noteCrdtProjection(unrelated) })).toBeNull()
    unrelated.destroy()
    doc.destroy()
  })

  it('shares a legacy epoch when ProseMirror defaults are explicitly null on one device', () => {
    const implicit = createNoteCrdt(original)
    const explicit = createNoteCrdt({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'Hello world' }] }] })
    text(implicit).insert(0, 'A ')
    text(explicit).insert(text(explicit).length, ' B')
    expect(mergeNoteCrdt({ id: 'n', ...noteCrdtProjection(implicit) }, { id: 'n', ...noteCrdtProjection(explicit) })?.contentMd).toContain('A Hello world B')
    implicit.destroy(); explicit.destroy()
  })
})
