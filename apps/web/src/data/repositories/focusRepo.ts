import type { FocusSettings } from '../models/types'
import { dbService } from '../services/dbService'

export const focusRepo = {
  async get() {
    return dbService.focus.get()
  },
  async upsert(data: Omit<FocusSettings, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.focus.upsert(data)
  },
}
