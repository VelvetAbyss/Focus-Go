import type { StockCreateInput, StockUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let cache: Awaited<ReturnType<typeof dbService.stocks.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

export const stocksRepo = {
  async list() {
    if (cache) return copy(cache)
    cache = await dbService.stocks.list()
    return copy(cache)
  },
  async create(data: StockCreateInput) {
    const created = await dbService.stocks.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: StockUpdateInput) {
    const updated = await dbService.stocks.update(id, patch)
    if (!updated) return updated
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    await dbService.stocks.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
