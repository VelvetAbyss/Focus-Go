import type { DiaryEntry } from '../models/types'
import { dbService } from '../services/dbService'

export const diaryRepo = {
  async list() {
    return dbService.diary.list()
  },
  async listActive() {
    return dbService.diary.listActive()
  },
  /** @deprecated Use listByDate for multi-entry-per-day support */
  async getByDate(dateKey: string) {
    return dbService.diary.getByDate(dateKey)
  },
  async listByDate(dateKey: string) {
    return dbService.diary.listByDate(dateKey)
  },
  async listByRange(dateFrom: string, dateTo: string, options: { includeDeleted?: boolean } = {}) {
    return dbService.diary.listByRange(dateFrom, dateTo, options)
  },
  async listTrash() {
    return dbService.diary.listTrash()
  },
  async softDeleteByDate(dateKey: string) {
    return dbService.diary.softDeleteByDate(dateKey)
  },
  async softDeleteById(id: string) {
    return dbService.diary.softDeleteById(id)
  },
  async restoreByDate(dateKey: string) {
    return dbService.diary.restoreByDate(dateKey)
  },
  async restoreById(id: string) {
    return dbService.diary.restoreById(id)
  },
  async markExpiredOlderThan(days = 30) {
    return dbService.diary.markExpiredOlderThan(days)
  },
  async hardDeleteByDate(dateKey: string) {
    return dbService.diary.hardDeleteByDate(dateKey)
  },
  async hardDeleteById(id: string) {
    return dbService.diary.hardDeleteById(id)
  },
  async add(data: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.diary.add(data)
  },
  async update(entry: DiaryEntry) {
    return dbService.diary.update(entry)
  },
}
