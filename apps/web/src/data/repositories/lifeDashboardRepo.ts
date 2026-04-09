import type { LifeDashboardLayout } from '../models/types'
import { dbService } from '../services/dbService'

export const lifeDashboardRepo = {
  async get() {
    return dbService.lifeDashboard.get()
  },
  async upsert(data: Omit<LifeDashboardLayout, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.lifeDashboard.upsert(data)
  },
}
