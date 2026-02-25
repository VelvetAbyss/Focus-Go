import { db } from '../db'
import type { NoteAssetEntity } from '../models/types'
import { touch, withBase } from './base'

const IMAGE_MAX_BYTES = 8 * 1024 * 1024

export const noteAssetsRepo = {
  maxImageBytes: IMAGE_MAX_BYTES,

  async get(id: string) {
    return db.noteAssets.get(id)
  },

  async listByNote(noteId: string) {
    return db.noteAssets.where('noteId').equals(noteId).toArray()
  },

  async addLocalImage(noteId: string, file: File) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are supported.')
    }
    if (file.size > IMAGE_MAX_BYTES) {
      throw new Error('Image is too large.')
    }

    const asset: NoteAssetEntity = withBase({
      noteId,
      kind: 'image',
      storage: 'blob',
      blob: file,
      alt: file.name || 'image',
    })
    await db.noteAssets.add(asset)
    return asset
  },

  async addRemoteImage(noteId: string, url: string) {
    const trimmed = url.trim()
    if (!trimmed) throw new Error('Image URL is required.')

    const asset: NoteAssetEntity = withBase({
      noteId,
      kind: 'image',
      storage: 'remote',
      url: trimmed,
      alt: 'image',
    })
    await db.noteAssets.add(asset)
    return asset
  },

  async updateAlt(id: string, alt: string) {
    const found = await db.noteAssets.get(id)
    if (!found) return undefined
    const next = touch({ ...found, alt })
    await db.noteAssets.put(next)
    return next
  },

  async removeByNote(noteId: string) {
    const rows = await db.noteAssets.where('noteId').equals(noteId).toArray()
    if (!rows.length) return 0
    await db.noteAssets.bulkDelete(rows.map((item) => item.id))
    return rows.length
  },
}

