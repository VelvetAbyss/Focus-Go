import type { LifePodcastCreateInput, LifePodcastUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'
import { getAuth, subscribeAuth } from '../../store/auth'
import { isLocalhostRuntime } from '../../shared/env/localhost'

let cache: Awaited<ReturnType<typeof dbService.lifePodcasts.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

const isAuthed = () => isLocalhostRuntime() || Boolean(getAuth()?.user)

if (typeof window !== 'undefined') {
  subscribeAuth(() => {
    cache = null
  })
}

export const podcastsRepo = {
  async list() {
    if (!isAuthed()) {
      cache = null
      return []
    }
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
