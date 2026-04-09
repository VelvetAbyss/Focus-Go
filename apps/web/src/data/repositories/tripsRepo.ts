import type { TripCreateInput, TripUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let cache: Awaited<ReturnType<typeof dbService.trips.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

export const tripsRepo = {
  async list() {
    if (cache) return copy(cache)
    cache = await dbService.trips.list()
    return copy(cache)
  },
  async create(data: TripCreateInput) {
    const created = await dbService.trips.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: TripUpdateInput) {
    const updated = await dbService.trips.update(id, patch)
    if (!updated) return updated
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    await dbService.trips.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
