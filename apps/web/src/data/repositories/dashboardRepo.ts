import type { DashboardLayout } from '../models/types'
import { dbService } from '../services/dbService'

export const dashboardRepo = {
  async get() {
    return dbService.dashboard.get()
  },
  async upsert(data: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>) {
    return dbService.dashboard.upsert(data)
  },
}
