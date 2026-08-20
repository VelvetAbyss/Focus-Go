import type { TripRecord } from '../../data/models/types'
import type { TripCreateInput, TripUpdateInput } from '@focus-go/core'
import { tripsRepo as persistedTripsRepo } from '../../data/repositories/tripsRepo'
import { createEmptyTripInput, pickDashboardTrip } from './tripData'
import { tripAttachmentsRepo } from './tripAttachmentsRepo'

const sortTrips = (rows: TripRecord[]) => [...rows].sort((left, right) => right.updatedAt - left.updatedAt || left.startDate.localeCompare(right.startDate))

export const tripsRepo = {
  async list(): Promise<TripRecord[]> {
    const rows = await persistedTripsRepo.list()
    return sortTrips(rows)
  },
  async getPrimary(): Promise<TripRecord | null> {
    const rows = await this.list()
    return rows[0] ?? null
  },
  async getDashboardTrip(): Promise<TripRecord | null> {
    const rows = await this.list()
    return pickDashboardTrip(rows)
  },
  async getById(id: string): Promise<TripRecord | null> {
    const rows = await this.list()
    return rows.find((row) => row.id === id) ?? null
  },
  async create(input?: Partial<TripCreateInput>) {
    return persistedTripsRepo.create(createEmptyTripInput(input))
  },
  async update(id: string, patch: TripUpdateInput) {
    return persistedTripsRepo.update(id, patch)
  },
  async remove(id: string) {
    await persistedTripsRepo.remove(id)
    // Attachments are local-only blobs (outside the sync queue) — cascade clean.
    await tripAttachmentsRepo.removeByTrip(id).catch((error) => {
      console.error('[trips] failed to clean up attachments', error)
    })
  },
}
