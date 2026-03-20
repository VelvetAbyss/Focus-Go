import type { NoteCreateInput, NoteUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let activeCache: Awaited<ReturnType<typeof dbService.notes.list>> | null = null
let trashCache: Awaited<ReturnType<typeof dbService.notes.listTrash>> | null = null

const copy = <T,>(rows: T[]): T[] => [...rows]

const mergeById = <T extends { id: string }>(rows: T[] | null, next: T): T[] | null => {
  if (!rows) return rows
  const index = rows.findIndex((item) => item.id === next.id)
  if (index < 0) return [next, ...rows]
  const updated = [...rows]
  updated[index] = next
  return updated
}

export const notesRepo = {
  async list() {
    if (activeCache) return copy(activeCache)
    activeCache = await dbService.notes.list()
    return copy(activeCache)
  },
  async listTrash() {
    if (trashCache) return copy(trashCache)
    trashCache = await dbService.notes.listTrash()
    return copy(trashCache)
  },
  async create(data?: NoteCreateInput) {
    const created = await dbService.notes.create(data)
    if (created.deletedAt) {
      trashCache = trashCache ? [created, ...trashCache] : null
      activeCache = activeCache?.filter((note) => note.id !== created.id) ?? activeCache
    } else {
      activeCache = activeCache ? [created, ...activeCache] : null
      trashCache = trashCache?.filter((note) => note.id !== created.id) ?? trashCache
    }
    return created
  },
  async update(id: string, patch: NoteUpdateInput) {
    const updated = await dbService.notes.update(id, patch)
    if (!updated) return updated
    if (updated.deletedAt) {
      activeCache = activeCache?.filter((note) => note.id !== id) ?? activeCache
      trashCache = mergeById(trashCache, updated)
    } else {
      trashCache = trashCache?.filter((note) => note.id !== id) ?? trashCache
      activeCache = mergeById(activeCache, updated)
    }
    return updated
  },
  async softDelete(id: string) {
    const removed = await dbService.notes.softDelete(id)
    if (!removed) return removed
    activeCache = activeCache?.filter((note) => note.id !== id) ?? activeCache
    trashCache = trashCache ? [removed, ...trashCache.filter((note) => note.id !== id)] : null
    return removed
  },
  async restore(id: string) {
    const restored = await dbService.notes.restore(id)
    if (!restored) return restored
    trashCache = trashCache?.filter((note) => note.id !== id) ?? trashCache
    activeCache = activeCache ? [restored, ...activeCache.filter((note) => note.id !== id)] : null
    return restored
  },
  async hardDelete(id: string) {
    const deleted = await dbService.notes.hardDelete(id)
    activeCache = activeCache?.filter((note) => note.id !== id) ?? activeCache
    trashCache = trashCache?.filter((note) => note.id !== id) ?? trashCache
    return deleted
  },
}
