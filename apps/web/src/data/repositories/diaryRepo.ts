import type { DiaryEntry } from '../models/types'
import { dbService } from '../services/dbService'

export const diaryRepo = {
  async list() {
    return dbService.diary.list()
  },
  async listActive() {
    return dbService.diary.listActive()
  },
  async getByDate(dateKey: string) {
    return dbService.diary.getByDate(dateKey)
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
  async restoreByDate(dateKey: string) {
    return dbService.diary.restoreByDate(dateKey)
  },
  async markExpiredOlderThan(days = 30) {
    return dbService.diary.markExpiredOlderThan(days)
  },
  async hardDeleteByDate(dateKey: string) {
    return dbService.diary.hardDeleteByDate(dateKey)
  },
  async add(data: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.diary.add(data)
  },
  async update(entry: DiaryEntry) {
    return dbService.diary.update(entry)
  },
}
