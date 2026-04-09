import type { LifePersonCreateInput, LifePersonUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let cache: Awaited<ReturnType<typeof dbService.lifePeople.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

export const peopleRepo = {
  async list() {
    if (cache) return copy(cache)
    cache = await dbService.lifePeople.list()
    return copy(cache)
  },
  async create(data: LifePersonCreateInput) {
    const created = await dbService.lifePeople.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: LifePersonUpdateInput) {
    const updated = await dbService.lifePeople.update(id, patch)
    if (!updated) return updated
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    await dbService.lifePeople.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
