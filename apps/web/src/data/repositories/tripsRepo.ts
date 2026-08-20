import type { TripCreateInput, TripUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

export const tripsRepo = {
  async list() {
    return dbService.trips.list()
  },
  async create(data: TripCreateInput) {
    return dbService.trips.create(data)
  },
  async update(id: string, patch: TripUpdateInput) {
    return dbService.trips.update(id, patch)
  },
  async remove(id: string) {
    await dbService.trips.remove(id)
  },
}
