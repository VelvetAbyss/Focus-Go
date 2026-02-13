import type { BaseEntity } from '../models/types'
import { createId } from '../../shared/utils/ids'

export const withBase = <T extends object>(data: T): BaseEntity & T => {
  const now = Date.now()
  return {
    id: createId(),
    createdAt: now,
    updatedAt: now,
    ...data,
  }
}

export const touch = <T extends BaseEntity>(data: T): T => ({
  ...data,
  updatedAt: Date.now(),
})
