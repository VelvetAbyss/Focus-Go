import type { NoteTagCreateInput, NoteTagUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'
import { SYNC_DATA_UPDATED_EVENT, type SyncDataUpdatedDetail } from '../sync/constants'

let tagsCache: Awaited<ReturnType<typeof dbService.noteTags.list>> | null = null

const copy = <T,>(rows: T[]): T[] => [...rows]

export const invalidateNoteTagsCache = () => {
  tagsCache = null
}

if (typeof window !== 'undefined') {
  window.addEventListener(SYNC_DATA_UPDATED_EVENT, (event) => {
    const topic = (event as CustomEvent<SyncDataUpdatedDetail>).detail?.topic
    if (topic === 'all' || topic === 'noteTags') invalidateNoteTagsCache()
  })
}

export const noteTagsRepo = {
  async list() {
    if (tagsCache) return copy(tagsCache)
    tagsCache = await dbService.noteTags.list()
    return copy(tagsCache)
  },
  async create(data: NoteTagCreateInput) {
    const created = await dbService.noteTags.create(data)
    tagsCache = tagsCache ? [...tagsCache, created] : null
    return created
  },
  async update(id: string, patch: NoteTagUpdateInput) {
    const updated = await dbService.noteTags.update(id, patch)
    if (!updated) return updated
    tagsCache = tagsCache ? tagsCache.map((tag) => (tag.id === id ? updated : tag)) : null
    return updated
  },
  async remove(id: string) {
    const removed = await dbService.noteTags.remove(id)
    tagsCache = tagsCache?.filter((tag) => tag.id !== id) ?? tagsCache
    return removed
  },
}
