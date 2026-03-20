import type { NoteAppearanceUpsertInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

let appearanceCache: Awaited<ReturnType<typeof dbService.noteAppearance.get>> | null | undefined

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
