import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`
}

const buildBlob = (namespace, contentType, raw) => {
  const hash = createHash('sha256').update(`${namespace}:${raw}`).digest('hex')
  const compressed = gzipSync(Buffer.from(raw, 'utf8'))
  return {
    hash,
    contentType,
    compression: 'gzip',
    rawByteLength: Buffer.byteLength(raw, 'utf8'),
    byteLength: compressed.byteLength,
    dataBase64: compressed.toString('base64'),
  }
}

const encodeNotePayload = (payload) => {
  const next = {
    id: payload.id,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    userId: payload.userId,
    workspaceId: payload.workspaceId,
    title: payload.title,
    editorMode: payload.editorMode,
    collection: payload.collection,
    tags: payload.tags,
    pinned: payload.pinned,
    deletedAt: payload.deletedAt ?? null,
  }
  const blobs = []
  if (typeof payload.contentMd === 'string' && payload.contentMd.length > 0) {
    const blob = buildBlob('note:contentMd', 'text/plain', payload.contentMd)
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), contentMd: blob.hash }
  }
  if (payload.contentJson && typeof payload.contentJson === 'object') {
    const blob = buildBlob('note:contentJson', 'application/json', stableStringify(payload.contentJson))
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), contentJson: blob.hash }
  }
  return { payload: next, blobs }
}

const encodeTaskPayload = (payload) => {
  const next = {
    ...payload,
    taskNoteBlocks: [],
  }
  delete next.taskNoteContentMd
  delete next.taskNoteContentJson
  const blobs = []
  if (typeof payload.taskNoteContentMd === 'string' && payload.taskNoteContentMd.length > 0) {
    const blob = buildBlob('task:contentMd', 'text/plain', payload.taskNoteContentMd)
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), taskNoteContentMd: blob.hash }
  }
  if (payload.taskNoteContentJson && typeof payload.taskNoteContentJson === 'object') {
    const blob = buildBlob('task:contentJson', 'application/json', stableStringify(payload.taskNoteContentJson))
    blobs.push(blob)
    next.bodyRefs = { ...(next.bodyRefs ?? {}), taskNoteContentJson: blob.hash }
  }
  return { payload: next, blobs }
}

export const collectBlobRefs = (entityType, payload) => {
  const refs = []
  if ((entityType === 'notes' || entityType === 'tasks') && payload?.bodyRefs) {
    for (const value of Object.values(payload.bodyRefs)) {
      if (typeof value === 'string') refs.push(value)
    }
  }
  if (entityType === 'tasks' && Array.isArray(payload?.attachments)) {
    for (const attachment of payload.attachments) {
      if (attachment && typeof attachment.hash === 'string') refs.push(attachment.hash)
    }
  }
  return refs
}

export const normalizePayloadForWire = (entityType, payload) => {
  if (entityType === 'notes' && (Object.prototype.hasOwnProperty.call(payload ?? {}, 'contentMd') || Object.prototype.hasOwnProperty.call(payload ?? {}, 'contentJson'))) {
    return encodeNotePayload(payload)
  }
  if (entityType === 'tasks' && (Object.prototype.hasOwnProperty.call(payload ?? {}, 'taskNoteContentMd') || Object.prototype.hasOwnProperty.call(payload ?? {}, 'taskNoteContentJson'))) {
    return encodeTaskPayload(payload)
  }
  return { payload, blobs: [] }
}
