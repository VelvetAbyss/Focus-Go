import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import type { SyncWireBlob, TaskItem, WireDocument } from './types.ts'

// Must stay byte-for-byte compatible with `encodeTaskPayload` in
// apps/web/focus-go-api/sync/protocol.js. The server compares a pushed
// `assumedMasterState` against its stored payload with a stable stringify, so a
// divergence here does not fail loudly — it makes every update dead-end in the
// conflict path. `protocol.parity.test.ts` pins the two implementations together.

const BLOB_NAMESPACE_CONTENT_MD = 'task:contentMd'

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  // `btoa` exists in both Obsidian's desktop (Electron) and mobile webviews.
  return btoa(binary)
}

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const utf8ByteLength = (value: string): number => strToU8(value).length

export const sha256Hex = async (value: string): Promise<string> => {
  const bytes = strToU8(value)
  // Copy into a plain ArrayBuffer: fflate's view may sit on a pooled buffer,
  // and SubtleCrypto's typing rejects a possibly-shared backing store.
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const buildBlob = async (
  namespace: string,
  contentType: string,
  raw: string,
): Promise<SyncWireBlob> => {
  const hash = await sha256Hex(`${namespace}:${raw}`)
  const compressed = gzipSync(strToU8(raw))
  return {
    hash,
    contentType,
    compression: 'gzip',
    rawByteLength: utf8ByteLength(raw),
    byteLength: compressed.length,
    dataBase64: toBase64(compressed),
  }
}

export const decodeBlob = (blob: SyncWireBlob): string => {
  const bytes = fromBase64(blob.dataBase64)
  if (blob.compression === 'gzip') return strFromU8(gunzipSync(bytes))
  return strFromU8(bytes)
}

/**
 * Turn a task into the document shape the server stores, hoisting the note body
 * into a content-addressed blob.
 */
export const encodeTaskPayload = async (
  task: TaskItem,
): Promise<{ payload: WireDocument; blobs: SyncWireBlob[] }> => {
  const next: Record<string, unknown> = { ...task, taskNoteBlocks: [] }
  delete next.taskNoteContentMd
  delete next.taskNoteContentJson

  const blobs: SyncWireBlob[] = []
  const contentMd = task.taskNoteContentMd

  if (typeof contentMd === 'string' && contentMd.length > 0) {
    const blob = await buildBlob(BLOB_NAMESPACE_CONTENT_MD, 'text/plain', contentMd)
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs as object | undefined), taskNoteContentMd: blob.hash }
  } else if (next.bodyRefs && typeof next.bodyRefs === 'object') {
    // An emptied note must drop its ref, or the app would keep rendering the
    // previous body from the still-referenced blob.
    const { taskNoteContentMd: _dropped, ...rest } = next.bodyRefs as Record<string, unknown>
    next.bodyRefs = Object.keys(rest).length > 0 ? rest : undefined
    if (next.bodyRefs === undefined) delete next.bodyRefs
  }

  return { payload: next as WireDocument, blobs }
}

/**
 * Inverse of `encodeTaskPayload`: rehydrate the note body from the blobs that
 * accompanied a pull.
 */
export const decodeTaskDocument = (
  document: WireDocument,
  blobsByHash: Map<string, SyncWireBlob>,
): TaskItem => {
  const task = { ...document } as Record<string, unknown>
  const bodyRefs = document.bodyRefs as Record<string, string> | undefined
  const contentMdHash = bodyRefs?.taskNoteContentMd

  if (contentMdHash) {
    const blob = blobsByHash.get(contentMdHash)
    // A missing blob means the body could not be fetched. Leaving the field
    // undefined (rather than writing an empty note) keeps the pull from
    // materialising an empty `## Notes` section over real content.
    if (blob) task.taskNoteContentMd = decodeBlob(blob)
  } else {
    task.taskNoteContentMd = ''
  }

  return task as unknown as TaskItem
}

/** True when the note body could not be reconstructed, so the file must not be rewritten. */
export const hasUnresolvedBody = (
  document: WireDocument,
  blobsByHash: Map<string, SyncWireBlob>,
): boolean => {
  const bodyRefs = document.bodyRefs as Record<string, string> | undefined
  const hash = bodyRefs?.taskNoteContentMd
  return Boolean(hash) && !blobsByHash.has(hash as string)
}
