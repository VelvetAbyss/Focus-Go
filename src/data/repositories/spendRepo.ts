import { db } from '../db'
import type { SpendCategory, SpendEntry } from '../models/types'
import { touch, withBase } from './base'

export const spendRepo = {
  async listEntries() {
    return db.spends.toArray()
  },
  async addEntry(data: Omit<SpendEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    const entry = withBase(data)
    await db.spends.add(entry)
    return entry
  },
  async deleteEntry(id: string) {
    await db.spends.delete(id)
  },
  async updateEntry(entry: SpendEntry) {
    const next = touch(entry)
    await db.spends.put(next)
    return next
  },
  async listCategories() {
    return db.spendCategories.toArray()
  },
  async addCategory(data: Omit<SpendCategory, 'id' | 'createdAt' | 'updatedAt'>) {
    const category = withBase(data)
    await db.spendCategories.add(category)
    return category
  },
  async updateCategory(category: SpendCategory) {
    const next = touch(category)
    await db.spendCategories.put(next)
    return next
  },
}
