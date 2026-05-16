import imageCompression from 'browser-image-compression'
import { db } from '../../../data/db'
import type { TaskAttachment, TaskAttachmentMime } from '../../../data/models/types'
import type { SyncBlobCacheEntry, SyncWireBlobContentType } from '../../../data/sync/types'

export const TASK_ATTACHMENT_LIMIT = 10
export const TASK_ATTACHMENT_PER_BATCH = 5
export const TASK_ATTACHMENT_MAX_RAW_BYTES = 20 * 1024 * 1024

const ALLOWED_MIMES = new Set<TaskAttachmentMime>(['image/webp', 'image/png', 'image/jpeg', 'image/gif'])

const COMPRESS_OPTIONS = {
  maxSizeMB: 0.2,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: 'image/webp' as const,
  initialQuality: 0.85,
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

const base64ToBytes = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('')
}

const readImageDimensions = (file: Blob): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight }
      URL.revokeObjectURL(url)
      resolve(dims)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode image'))
    }
    img.src = url
  })
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

export type ProcessFileResult =
  | { ok: true; attachment: TaskAttachment }
  | { ok: false; reason: 'invalid-mime' | 'too-large' | 'compress-failed'; file: File }

export const isImageFile = (file: File): boolean => file.type.startsWith('image/')

export const processFile = async (file: File): Promise<ProcessFileResult> => {
  if (!isImageFile(file)) {
    return { ok: false, reason: 'invalid-mime', file }
  }
  if (file.size > TASK_ATTACHMENT_MAX_RAW_BYTES) {
    return { ok: false, reason: 'too-large', file }
  }
  try {
    const compressed = await imageCompression(file, COMPRESS_OPTIONS)
    const arrayBuffer = await compressed.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const hash = await sha256Hex(bytes)
    const mime = (compressed.type || 'image/webp') as TaskAttachmentMime
    const safeMime = ALLOWED_MIMES.has(mime) ? mime : 'image/webp'
    const dims = await readImageDimensions(compressed).catch(() => ({ width: 0, height: 0 }))

    const now = Date.now()
    const existing = await db.syncBlobCache.get(hash)
    if (!existing) {
      const entry: SyncBlobCacheEntry = {
        hash,
        contentType: safeMime as SyncWireBlobContentType,
        compression: 'none',
        rawByteLength: bytes.byteLength,
        byteLength: bytes.byteLength,
        dataBase64: bytesToBase64(bytes),
        createdAt: now,
        updatedAt: now,
      }
      await db.syncBlobCache.put(entry)
    }

    return {
      ok: true,
      attachment: {
        id: newId(),
        hash,
        mime: safeMime,
        width: dims.width,
        height: dims.height,
        byteLength: bytes.byteLength,
        name: file.name || undefined,
        createdAt: now,
      },
    }
  } catch (error) {
    console.error('[taskAttachments] compress failed', error)
    return { ok: false, reason: 'compress-failed', file }
  }
}

export type ProcessRejectReason = 'invalid-mime' | 'too-large' | 'compress-failed'

export type ProcessBatchResult = {
  added: TaskAttachment[]
  rejected: Array<{ reason: ProcessRejectReason; file: File }>
  truncatedByBatch: number
  truncatedByTotal: number
}

export const processFilesForComposer = async (
  files: File[],
  currentCount: number,
): Promise<ProcessBatchResult> => {
  const result: ProcessBatchResult = {
    added: [],
    rejected: [],
    truncatedByBatch: 0,
    truncatedByTotal: 0,
  }
  if (files.length === 0) return result

  const imageFiles: File[] = []
  for (const file of files) {
    if (isImageFile(file)) imageFiles.push(file)
    else result.rejected.push({ reason: 'invalid-mime', file })
  }

  let queue = imageFiles
  if (queue.length > TASK_ATTACHMENT_PER_BATCH) {
    result.truncatedByBatch = queue.length - TASK_ATTACHMENT_PER_BATCH
    queue = queue.slice(0, TASK_ATTACHMENT_PER_BATCH)
  }

  const remainingSlots = Math.max(0, TASK_ATTACHMENT_LIMIT - currentCount)
  if (queue.length > remainingSlots) {
    result.truncatedByTotal = queue.length - remainingSlots
    queue = queue.slice(0, remainingSlots)
  }

  const processed = await Promise.all(queue.map((file) => processFile(file)))
  for (const item of processed) {
    if (item.ok) result.added.push(item.attachment)
    else result.rejected.push({ reason: item.reason, file: item.file })
  }
  return result
}

const objectUrlCache = new Map<string, { url: string; refCount: number }>()

export const acquireAttachmentUrl = async (hash: string): Promise<string | null> => {
  const cached = objectUrlCache.get(hash)
  if (cached) {
    cached.refCount += 1
    return cached.url
  }
  const blob = await db.syncBlobCache.get(hash)
  if (!blob) return null
  const bytes = base64ToBytes(blob.dataBase64)
  const file = new Blob([bytes as unknown as BlobPart], { type: blob.contentType })
  const url = URL.createObjectURL(file)
  objectUrlCache.set(hash, { url, refCount: 1 })
  return url
}

export const releaseAttachmentUrl = (hash: string): void => {
  const cached = objectUrlCache.get(hash)
  if (!cached) return
  cached.refCount -= 1
  if (cached.refCount <= 0) {
    URL.revokeObjectURL(cached.url)
    objectUrlCache.delete(hash)
  }
}
