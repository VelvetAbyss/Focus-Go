import type { SpendCategory, SpendEntry } from '../models/types'
import { dbService } from '../services/dbService'

export const spendRepo = {
  async listEntries() {
    return dbService.spend.listEntries()
  },
  async addEntry(data: Omit<SpendEntry, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.spend.addEntry(data)
  },
  async deleteEntry(id: string) {
    await dbService.spend.deleteEntry(id)
  },
  async updateEntry(entry: SpendEntry) {
    return dbService.spend.updateEntry(entry)
  },
  async listCategories() {
    return dbService.spend.listCategories()
  },
  async addCategory(data: Omit<SpendCategory, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.spend.addCategory(data)
  },
  async updateCategory(category: SpendCategory) {
    return dbService.spend.updateCategory(category)
  },
}
