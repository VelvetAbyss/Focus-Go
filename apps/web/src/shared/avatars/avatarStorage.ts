import imageCompression from 'browser-image-compression'
import { db } from '../../data/db'
import type { SyncBlobCacheEntry, SyncWireBlobContentType } from '../../data/sync/types'

const COMPRESS_OPTIONS = {
  maxSizeMB: 0.15,
  maxWidthOrHeight: 256,
  useWebWorker: true,
  fileType: 'image/webp' as const,
  initialQuality: 0.85,
}

const AVATAR_MAX_RAW_BYTES = 8 * 1024 * 1024

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

const base64ToBytes = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const sha256Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export type AvatarUploadResult =
  | { ok: true; hash: string }
  | { ok: false; reason: 'invalid-mime' | 'too-large' | 'compress-failed' }

/**
 * Compress an avatar source and persist it to syncBlobCache. Returns the SHA-256
 * hash, which callers should store on the owning entity (e.g. ProjectPerson.avatarBlobHash).
 */
export const uploadAvatar = async (file: File): Promise<AvatarUploadResult> => {
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'invalid-mime' }
  if (file.size > AVATAR_MAX_RAW_BYTES) return { ok: false, reason: 'too-large' }
  try {
    const compressed = await imageCompression(file, COMPRESS_OPTIONS)
    const buffer = await compressed.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const hash = await sha256Hex(bytes)
    const existing = await db.syncBlobCache.get(hash)
    if (!existing) {
      const now = Date.now()
      const entry: SyncBlobCacheEntry = {
        hash,
        contentType: (compressed.type || 'image/webp') as SyncWireBlobContentType,
        compression: 'none',
        rawByteLength: bytes.byteLength,
        byteLength: bytes.byteLength,
        dataBase64: bytesToBase64(bytes),
        createdAt: now,
        updatedAt: now,
      }
      await db.syncBlobCache.put(entry)
    }
    return { ok: true, hash }
  } catch (error) {
    console.error('[avatarStorage] compress failed', error)
    return { ok: false, reason: 'compress-failed' }
  }
}

const urlCache = new Map<string, { url: string; refCount: number }>()

export const acquireAvatarUrl = async (hash: string): Promise<string | null> => {
  const cached = urlCache.get(hash)
  if (cached) {
    cached.refCount += 1
    return cached.url
  }
  const blob = await db.syncBlobCache.get(hash)
  if (!blob) return null
  const bytes = base64ToBytes(blob.dataBase64)
  const file = new Blob([bytes as unknown as BlobPart], { type: blob.contentType })
  const url = URL.createObjectURL(file)
  urlCache.set(hash, { url, refCount: 1 })
  return url
}

export const releaseAvatarUrl = (hash: string): void => {
  const cached = urlCache.get(hash)
  if (!cached) return
  cached.refCount -= 1
  if (cached.refCount <= 0) {
    URL.revokeObjectURL(cached.url)
    urlCache.delete(hash)
  }
}
