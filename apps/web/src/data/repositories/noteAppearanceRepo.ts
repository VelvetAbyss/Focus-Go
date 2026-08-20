import type { NoteAppearanceUpsertInput } from '@focus-go/core'
import { dbService } from '../services/dbService'
import { SYNC_DATA_UPDATED_EVENT, type SyncDataUpdatedDetail } from '../sync/constants'

let appearanceCache: Awaited<ReturnType<typeof dbService.noteAppearance.get>> | null | undefined

export const invalidateNoteAppearanceCache = () => {
  appearanceCache = undefined
}

if (typeof window !== 'undefined') {
  window.addEventListener(SYNC_DATA_UPDATED_EVENT, (event) => {
    const topic = (event as CustomEvent<SyncDataUpdatedDetail>).detail?.topic
    if (topic === 'all' || topic === 'noteAppearance') invalidateNoteAppearanceCache()
  })
}

export const noteAppearanceRepo = {
  async get() {
    if (appearanceCache !== undefined) return appearanceCache
    appearanceCache = await dbService.noteAppearance.get()
    return appearanceCache
  },
  async upsert(data: Partial<NoteAppearanceUpsertInput> & Pick<NoteAppearanceUpsertInput, 'id'>) {
    const next = await dbService.noteAppearance.upsert(data)
    appearanceCache = next
    return next
  },
}
