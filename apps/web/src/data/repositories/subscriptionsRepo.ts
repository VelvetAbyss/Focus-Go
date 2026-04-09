import type { LifeSubscriptionCreateInput, LifeSubscriptionUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let cache: Awaited<ReturnType<typeof dbService.lifeSubscriptions.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

export const subscriptionsRepo = {
  async list() {
    if (cache) return copy(cache)
    cache = await dbService.lifeSubscriptions.list()
    return copy(cache)
  },
  async create(data: LifeSubscriptionCreateInput) {
    const created = await dbService.lifeSubscriptions.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: LifeSubscriptionUpdateInput) {
    const updated = await dbService.lifeSubscriptions.update(id, patch)
    if (!updated) return updated
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    await dbService.lifeSubscriptions.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
