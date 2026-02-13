import { db } from '../db'
import type { DashboardLayout } from '../models/types'
import { touch, withBase } from './base'

const DEFAULT_ID = 'dashboard_layout'

export const dashboardRepo = {
  async get() {
    const layout = await db.dashboardLayout.get(DEFAULT_ID)
    return layout ?? null
  },
  async upsert(data: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = await db.dashboardLayout.get(DEFAULT_ID)
    if (!existing) {
      const next = withBase({ ...data, id: DEFAULT_ID })
      await db.dashboardLayout.put(next)
      return next
    }
    const next = touch({ ...existing, ...data })
    await db.dashboardLayout.put(next)
    return next
  },
}
