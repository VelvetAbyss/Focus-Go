import type { LifePodcastCreateInput, LifePodcastUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let cache: Awaited<ReturnType<typeof dbService.lifePodcasts.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

export const podcastsRepo = {
  async list() {
    if (cache) return copy(cache)
    cache = await dbService.lifePodcasts.list()
    return copy(cache)
  },
  async create(data: LifePodcastCreateInput) {
    const created = await dbService.lifePodcasts.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: LifePodcastUpdateInput) {
    const updated = await dbService.lifePodcasts.update(id, patch)
    if (!updated) return updated
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    await dbService.lifePodcasts.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
