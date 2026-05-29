import { db } from '../../data/db'
import { createId } from '../../shared/utils/ids'
import type {
  TripAttachmentKind,
  TripAttachmentMeta,
  TripAttachmentRecord,
} from '../../data/models/types'

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024 // 20 MB safety cap

const kindFromMime = (mime: string): TripAttachmentKind => {
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  return 'other'
}

const toMeta = (record: TripAttachmentRecord): TripAttachmentMeta => {
  const { blob: _blob, ...meta } = record
  void _blob
  return meta
}

export type AddAttachmentResult = { meta: TripAttachmentMeta }

export const tripAttachmentsRepo = {
  /** Persist a File/Blob as a local trip attachment. Returns its metadata. */
  async add(tripId: string, file: File): Promise<TripAttachmentMeta> {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Attachment exceeds ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB limit`)
    }
    const id = createId()
    const record: TripAttachmentRecord = {
      id,
      tripId,
      kind: kindFromMime(file.type),
      name: file.name || 'attachment',
      size: file.size,
      mime: file.type || 'application/octet-stream',
      createdAt: new Date().toISOString(),
      blobKey: id,
      blob: file instanceof File ? file.slice(0, file.size, file.type) : file,
    }
    await db.tripAttachments.put(record)
    return toMeta(record)
  },

  async getMeta(id: string): Promise<TripAttachmentMeta | undefined> {
    const record = await db.tripAttachments.get(id)
    return record ? toMeta(record) : undefined
  },

  async getBlob(id: string): Promise<Blob | undefined> {
    const record = await db.tripAttachments.get(id)
    return record?.blob
  },

  async listByIds(ids: string[]): Promise<TripAttachmentMeta[]> {
    if (ids.length === 0) return []
    const rows = await db.tripAttachments.bulkGet(ids)
    return rows.filter((row): row is TripAttachmentRecord => Boolean(row)).map(toMeta)
  },

  async listByTrip(tripId: string): Promise<TripAttachmentMeta[]> {
    const rows = await db.tripAttachments.where('tripId').equals(tripId).toArray()
    return rows.map(toMeta)
  },

  async remove(id: string): Promise<void> {
    await db.tripAttachments.delete(id)
  },

  async removeByTrip(tripId: string): Promise<void> {
    const ids = await db.tripAttachments.where('tripId').equals(tripId).primaryKeys()
    if (ids.length > 0) await db.tripAttachments.bulkDelete(ids)
  },
}
