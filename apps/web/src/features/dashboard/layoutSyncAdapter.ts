import type { DashboardLayoutItem } from '../../data/models/types'

export type DashboardLayoutSyncPayload = {
  items: DashboardLayoutItem[]
  hiddenCardIds: string[]
}

export async function syncDashboardLayout(payload: DashboardLayoutSyncPayload): Promise<void> {
  void payload
  // Placeholder adapter for future cloud sync integration.
  // Current behavior: local-only success path.
  return Promise.resolve()
}
