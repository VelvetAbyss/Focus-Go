import type { MediaCreateInput, MediaUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let cache: Awaited<ReturnType<typeof dbService.media.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

export const mediaRepo = {
  async list() {
    if (cache) return copy(cache)
    cache = await dbService.media.list()
    return copy(cache)
  },
  async create(data: MediaCreateInput) {
    const created = await dbService.media.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: MediaUpdateInput) {
    const updated = await dbService.media.update(id, patch)
    if (!updated) return updated
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    await dbService.media.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
