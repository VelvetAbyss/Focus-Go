import type { DomainEvent } from '../models/types'
import { db } from '../db'
import { dispatchSyncDataUpdated } from '../sync/constants'
import { enqueueSyncOperation } from '../sync/repository'
import { runDomainEventProjections } from './projections'

export const domainEventsRepo = {
  async list() {
    return db.domainEvents.orderBy('occurredAt').toArray()
  },
  async getByDedupeKey(dedupeKey: string) {
    return db.domainEvents.where('dedupeKey').equals(dedupeKey).first()
  },
  async append(event: DomainEvent) {
    const existing = await this.getByDedupeKey(event.dedupeKey)
    if (existing) return existing
    try {
      await db.domainEvents.add(event)
      dispatchSyncDataUpdated('domainEvents')
      return event
    } catch (error) {
      if ((error as { name?: string })?.name !== 'ConstraintError') throw error
      const current = await this.getByDedupeKey(event.dedupeKey)
      if (current) return current
      throw error
    }
  },
}

export const finalizeDomainEvent = async (event: DomainEvent | null | undefined) => {
  if (!event) return
  await runDomainEventProjections(event)
  await enqueueSyncOperation('domainEvents', 'upsert', event)
}
