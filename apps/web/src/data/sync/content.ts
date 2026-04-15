import type { NoteItem, TaskItem } from '../models/types'
import type { SyncEntityType, SyncPayload, SyncWireBlob } from './types'

type PlainObject = Record<string, unknown>

type NotesSyncPayload = Omit<
  NoteItem,
  'contentMd' | 'contentJson' | 'excerpt' | 'wordCount' | 'charCount' | 'paragraphCount' | 'imageCount' | 'fileCount' | 'headings' | 'backlinks'
> & {
  bodyRefs?: {
    contentMd?: string
    contentJson?: string
  }
}

type TasksSyncPayload = Omit<TaskItem, 'taskNoteBlocks' | 'taskNoteContentMd' | 'taskNoteContentJson'> & {
  bodyRefs?: {
    taskNoteContentMd?: string
    taskNoteContentJson?: string
  }
  taskNoteBlocks: []
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const sanitizeOptionalId = (value: unknown) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined
  return trimmed
}

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return btoa(binary)
}

const base64ToBytes = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const entries = Object.entries(value as PlainObject).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`
}

const gzipBytes = async (bytes: Uint8Array) => {
  const compressed = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(compressed).arrayBuffer())
}

const gunzipBytes = async (bytes: Uint8Array) => {
  const decompressed = new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(decompressed).arrayBuffer())
}

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('')
}

const buildBlob = async (
  namespace: string,
  contentType: SyncWireBlob['contentType'],
  raw: string,
): Promise<SyncWireBlob> => {
  const hash = await sha256Hex(`${namespace}:${raw}`)
  const compressed = await gzipBytes(encoder.encode(raw))
  return {
    hash,
    contentType,
    compression: 'gzip',
    rawByteLength: encoder.encode(raw).length,
    byteLength: compressed.length,
    dataBase64: bytesToBase64(compressed),
  }
}

const restoreBlobText = async (blob: SyncWireBlob) => decoder.decode(await gunzipBytes(base64ToBytes(blob.dataBase64)))

const buildNotePayload = async (payload: NoteItem): Promise<{ payload: NotesSyncPayload; blobs: SyncWireBlob[] }> => {
  const userId = sanitizeOptionalId(payload.userId)
  const workspaceId = sanitizeOptionalId(payload.workspaceId)
  const next: NotesSyncPayload = {
    id: payload.id,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    title: payload.title,
    editorMode: payload.editorMode,
    collection: payload.collection,
    tags: payload.tags,
    pinned: payload.pinned,
    deletedAt: payload.deletedAt ?? null,
  }
  if (userId) next.userId = userId
  if (workspaceId) next.workspaceId = workspaceId
  const blobs: SyncWireBlob[] = []
  if (payload.contentMd) {
    const blob = await buildBlob('note:contentMd', 'text/plain', payload.contentMd)
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), contentMd: blob.hash }
  }
  if (payload.contentJson !== undefined && payload.contentJson !== null) {
    const blob = await buildBlob('note:contentJson', 'application/json', stableStringify(payload.contentJson))
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), contentJson: blob.hash }
  }
  return { payload: next, blobs }
}

const buildTaskPayload = async (payload: TaskItem): Promise<{ payload: TasksSyncPayload; blobs: SyncWireBlob[] }> => {
  const { taskNoteContentMd, taskNoteContentJson, userId: rawUserId, workspaceId: rawWorkspaceId, ...rest } = payload
  const userId = sanitizeOptionalId(rawUserId)
  const workspaceId = sanitizeOptionalId(rawWorkspaceId)
  const next: TasksSyncPayload = {
    ...rest,
    taskNoteBlocks: [],
  }
  if (userId) next.userId = userId
  if (workspaceId) next.workspaceId = workspaceId
  const blobs: SyncWireBlob[] = []
  if (taskNoteContentMd) {
    const blob = await buildBlob('task:contentMd', 'text/plain', taskNoteContentMd)
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), taskNoteContentMd: blob.hash }
  }
  if (taskNoteContentJson !== undefined && taskNoteContentJson !== null) {
    const blob = await buildBlob('task:contentJson', 'application/json', stableStringify(taskNoteContentJson))
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), taskNoteContentJson: blob.hash }
  }
  return { payload: next, blobs }
}

export const createBlobMap = (blobs: SyncWireBlob[]) => new Map(blobs.map((blob) => [blob.hash, blob] as const))

export const collectBlobRefs = (entityType: SyncEntityType, payload: SyncPayload | Record<string, unknown>) => {
  const payloadObject = isPlainObject(payload) ? payload : null
  const refsCandidate = payloadObject && 'bodyRefs' in payloadObject ? payloadObject.bodyRefs : null
  const bodyRefs = isPlainObject(refsCandidate) ? refsCandidate : null
  if ((entityType === 'notes' || entityType === 'tasks') && bodyRefs) {
    return Object.values(bodyRefs).filter((value): value is string => typeof value === 'string')
  }
  return []
}

export const encodeSyncPayload = async (entityType: SyncEntityType, payload: SyncPayload) => {
  if (entityType === 'notes') return buildNotePayload(payload as NoteItem)
  if (entityType === 'tasks') return buildTaskPayload(payload as TaskItem)
  return { payload, blobs: [] }
}

const ensureBlob = async (blobMap: Map<string, SyncWireBlob>, hash: string) => {
  const blob = blobMap.get(hash)
  if (!blob) throw new Error(`Missing blob payload: ${hash}`)
  return restoreBlobText(blob)
}

export const decodeSyncPayload = async (
  entityType: SyncEntityType,
  payload: SyncPayload | Record<string, unknown>,
  blobMap: Map<string, SyncWireBlob>,
) => {
  const payloadObject = isPlainObject(payload) ? payload : null
  const refsCandidate = payloadObject && 'bodyRefs' in payloadObject ? payloadObject.bodyRefs : null
  const bodyRefs = isPlainObject(refsCandidate) ? (refsCandidate as Record<string, string | undefined>) : null

  if (entityType === 'notes' && bodyRefs) {
    const contentMd = bodyRefs.contentMd ? await ensureBlob(blobMap, bodyRefs.contentMd) : ''
    const contentJson = bodyRefs.contentJson ? JSON.parse(await ensureBlob(blobMap, bodyRefs.contentJson)) : null
    return {
      ...payload,
      contentMd,
      contentJson,
      excerpt: '',
      wordCount: 0,
      charCount: 0,
      paragraphCount: 0,
      imageCount: 0,
      fileCount: 0,
      headings: [],
      backlinks: [],
    } as NoteItem
  }

  if (entityType === 'tasks' && bodyRefs) {
    const taskNoteContentMd = bodyRefs.taskNoteContentMd ? await ensureBlob(blobMap, bodyRefs.taskNoteContentMd) : ''
    const taskNoteContentJson = bodyRefs.taskNoteContentJson ? JSON.parse(await ensureBlob(blobMap, bodyRefs.taskNoteContentJson)) : null
    return {
      ...payload,
      taskNoteBlocks: [],
      taskNoteContentMd,
      taskNoteContentJson,
    } as TaskItem
  }

  return payload as SyncPayload
}

export const decodeBackupBlob = async (blob: SyncWireBlob) => gunzipBytes(base64ToBytes(blob.dataBase64))

export const encodeBackupBlobBytes = async (blob: SyncWireBlob) => base64ToBytes(blob.dataBase64)
