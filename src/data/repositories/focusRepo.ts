import { db } from '../db'
import type { FocusSettings } from '../models/types'
import { touch, withBase } from './base'

const DEFAULT_ID = 'focus_settings'

export const focusRepo = {
  async get() {
    const existing = await db.focusSettings.get(DEFAULT_ID)
    return existing ?? null
  },
  async upsert(data: Omit<FocusSettings, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = await db.focusSettings.get(DEFAULT_ID)
    if (!existing) {
      const next = withBase({ ...data, id: DEFAULT_ID })
      await db.focusSettings.put(next)
      return next
    }
    const next = touch({ ...existing, ...data })
    await db.focusSettings.put(next)
    return next
  },
}
