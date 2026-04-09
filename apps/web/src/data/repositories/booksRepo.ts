import type { BookCreateInput, BookUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let cache: Awaited<ReturnType<typeof dbService.books.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]

export const booksRepo = {
  async list() {
    if (cache) return copy(cache)
    cache = await dbService.books.list()
    return copy(cache)
  },
  async create(data: BookCreateInput) {
    const created = await dbService.books.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: BookUpdateInput) {
    const updated = await dbService.books.update(id, patch)
    if (!updated) return updated
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    await dbService.books.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
