import type { DashboardLayoutItem } from '../../data/models/types'

export type DashboardLayoutSyncPayload = {
  items: DashboardLayoutItem[]
  hiddenCardIds: string[]
}

export async function syncDashboardLayout(payload: DashboardLayoutSyncPayload): Promise<void> {
  void payload
  return Promise.resolve()
}
