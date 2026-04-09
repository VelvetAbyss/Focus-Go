import type { TripRecord } from '../../data/models/types'
import type { TripCreateInput, TripUpdateInput } from '@focus-go/core'
import { tripsRepo as persistedTripsRepo } from '../../data/repositories/tripsRepo'
import { createEmptyTripInput, demoTrip } from './tripData'

const sortTrips = (rows: TripRecord[]) => [...rows].sort((left, right) => right.updatedAt - left.updatedAt || left.startDate.localeCompare(right.startDate))

const ensureSeedTrip = async () => {
  const created = await persistedTripsRepo.create(demoTrip)
  return created
}

export const tripsRepo = {
  async list(): Promise<TripRecord[]> {
    const rows = await persistedTripsRepo.list()
    return sortTrips(rows)
  },
  async getPrimary(): Promise<TripRecord> {
    const rows = await this.list()
    if (rows.length > 0) return rows[0]
    return ensureSeedTrip()
  },
  async getDashboardTrip(): Promise<TripRecord> {
    const rows = await this.list()
    if (rows.length > 0) return rows[0]
    return ensureSeedTrip()
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
    return persistedTripsRepo.remove(id)
  },
}
