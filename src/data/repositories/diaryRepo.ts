import { db } from '../db'
import type { DiaryEntry } from '../models/types'
import { touch, withBase } from './base'

export const diaryRepo = {
  async list() {
    return db.diaryEntries.toArray()
  },
  async listActive() {
    const entries = await db.diaryEntries.toArray()
    return entries.filter((entry) => !entry.deletedAt).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  },
  async getByDate(dateKey: string) {
    return db.diaryEntries.where('dateKey').equals(dateKey).first()
  },
  async listByRange(
    dateFrom: string,
    dateTo: string,
    options: { includeDeleted?: boolean } = {}
  ) {
    const entries = await db.diaryEntries.where('dateKey').between(dateFrom, dateTo, true, true).toArray()
    const filtered = options.includeDeleted ? entries : entries.filter((entry) => !entry.deletedAt)
    return filtered.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
  },
  async listTrash() {
    const entries = await db.diaryEntries.where('deletedAt').above(0).toArray()
    return entries.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  },
  async softDeleteByDate(dateKey: string) {
    const existing = await db.diaryEntries.where('dateKey').equals(dateKey).first()
    if (!existing) return null
    const next = touch({ ...existing, deletedAt: Date.now(), expiredAt: null })
    await db.diaryEntries.put(next)
    return next
  },
  async restoreByDate(dateKey: string) {
    const existing = await db.diaryEntries.where('dateKey').equals(dateKey).first()
    if (!existing) return null
    const next = touch({ ...existing, deletedAt: null, expiredAt: null })
    await db.diaryEntries.put(next)
    return next
  },
  async markExpiredOlderThan(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const entries = await db.diaryEntries.where('deletedAt').belowOrEqual(cutoff).toArray()
    const targets = entries.filter((entry) => entry.deletedAt && !entry.expiredAt)
    if (!targets.length) return 0
    const now = Date.now()
    const updated = targets.map((entry) => touch({ ...entry, expiredAt: now }))
    await db.diaryEntries.bulkPut(updated)
    return updated.length
  },
  async hardDeleteByDate(dateKey: string) {
    return db.diaryEntries.where('dateKey').equals(dateKey).delete()
  },
  async add(data: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    const entry = withBase(data)
    await db.diaryEntries.add(entry)
    return entry
  },
  async update(entry: DiaryEntry) {
    const next = touch(entry)
    await db.diaryEntries.put(next)
    return next
  },
}
