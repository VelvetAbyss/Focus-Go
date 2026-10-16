import * as Y from 'yjs'
import { getSchema, type JSONContent } from '@tiptap/core'
import { prosemirrorJSONToYXmlFragment, yDocToProsemirrorJSON } from '@tiptap/y-tiptap'
import { createRichTextExtensions } from '../../features/notes/model/richTextExtensions'
import { ensureRichDoc, richDocToMarkdown } from '../../features/notes/model/richTextCodec'

export const NOTE_CRDT_ORIGIN = 'focusgo-remote-note'
const field = 'default'
let noteSchema: ReturnType<typeof getSchema> | undefined
const getNoteSchema = () => noteSchema ??= getSchema(createRichTextExtensions())
const canonicalBody = (value: unknown) => getNoteSchema().nodeFromJSON(value).toJSON()
const toBytes = (state: string) => Uint8Array.from(atob(state), char => char.charCodeAt(0))
export const encodeNoteCrdt = (doc: Y.Doc) => {
  let binary = ''
  for (const byte of Y.encodeStateAsUpdate(doc)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export const applyNoteCrdt = (doc: Y.Doc, state: string) => {
  if (state.length > 16 * 1024 * 1024) throw new Error('Note CRDT state exceeds limit')
  Y.applyUpdate(doc, toBytes(state), NOTE_CRDT_ORIGIN)
}

export const hasSameNoteCrdtEpoch = (doc: Y.Doc, state: string) => {
  const remote = new Y.Doc()
  try {
    applyNoteCrdt(remote, state)
    const epoch = doc.getMap('focusgo').get('epoch')
    return Boolean(epoch) && epoch === remote.getMap('focusgo').get('epoch')
  } finally { remote.destroy() }
}

export const containsNoteCrdtState = (targetState: string, sourceState: string) => {
  if (!targetState || !sourceState) return false
  let doc: Y.Doc | null = null
  try {
    doc = createNoteCrdt({ type: 'doc', content: [] }, targetState)
    if (!hasSameNoteCrdtEpoch(doc, sourceState)) return false
    const before = encodeNoteCrdt(doc)
    applyNoteCrdt(doc, sourceState)
    return before === encodeNoteCrdt(doc)
  } catch { return false } finally { doc?.destroy() }
}

export const createNoteCrdt = (content: JSONContent, state?: string | null) => {
  const doc = new Y.Doc()
  if (state) {
    try { applyNoteCrdt(doc, state); return doc } catch (error) { doc.destroy(); throw error }
  }
  // Two upgraded clients opening the same legacy snapshot must share exactly
  // the same initial structs, rather than inserting its paragraphs twice.
  const seed = new Y.Doc()
  const canonical = canonicalBody(content)
  const serialized = JSON.stringify(canonical)
  let hash = 2166136261
  for (let i = 0; i < serialized.length; i++) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619)
  seed.clientID = hash >>> 0
  seed.getMap('focusgo').set('epoch', `${hash >>> 0}:${serialized.length}`)
  prosemirrorJSONToYXmlFragment(getNoteSchema(), canonical, seed.getXmlFragment(field))
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed), NOTE_CRDT_ORIGIN)
  seed.destroy()
  return doc
}

export const noteCrdtProjection = (doc: Y.Doc) => {
  const contentJson = canonicalBody(yDocToProsemirrorJSON(doc, field)) as JSONContent
  return { contentJson: contentJson as Record<string, unknown>, contentMd: richDocToMarkdown(contentJson), crdtState: encodeNoteCrdt(doc) }
}

const stable = (value: unknown): string => value && typeof value === 'object'
  ? Array.isArray(value) ? `[${value.map(stable).join(',')}]` : JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])))
  : JSON.stringify(value)

const verifiedDoc = (value: Record<string, unknown>) => {
  if (typeof value.crdtState !== 'string') return null
  const doc = createNoteCrdt({ type: 'doc', content: [] }, value.crdtState)
  const projected = yDocToProsemirrorJSON(doc, field)
  const body = ensureRichDoc(value.contentJson as Record<string, unknown> | null, String(value.contentMd ?? ''))
  if (stable(canonicalBody(projected)) !== stable(canonicalBody(body))) { doc.destroy(); return null }
  return doc
}

export const isNoteCrdtSnapshot = (value: { contentJson?: Record<string, unknown> | null; contentMd: string; crdtState?: string }) => {
  try {
    const doc = verifiedDoc(value)
    if (!doc) return false
    doc.destroy()
    return true
  } catch { return false }
}

export const mergeNoteCrdt = (local: Record<string, unknown>, remote: Record<string, unknown>) => {
  if (local._deleted || remote._deleted || local.deletedAt || remote.deletedAt) return null
  let left: Y.Doc | null = null
  let right: Y.Doc | null = null
  try {
    left = verifiedDoc(local); right = verifiedDoc(remote)
    if (!left || !right) return null // Keep conflict copies for legacy/mixed clients.
    if (!left.getMap('focusgo').get('epoch') || left.getMap('focusgo').get('epoch') !== right.getMap('focusgo').get('epoch')) return null
    Y.applyUpdate(left, Y.encodeStateAsUpdate(right), NOTE_CRDT_ORIGIN)
    const projected = noteCrdtProjection(left)
    return { ...remote, ...projected, updatedAt: Math.max(Number(local.updatedAt) || 0, Number(remote.updatedAt) || 0) + 1 }
  } catch { return null } finally { left?.destroy(); right?.destroy() }
}
