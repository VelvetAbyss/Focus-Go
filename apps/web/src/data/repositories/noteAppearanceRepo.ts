import type { NoteAppearanceUpsertInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

export const noteAppearanceRepo = {
  get() {
    return dbService.noteAppearance.get()
  },
  upsert(data: Partial<NoteAppearanceUpsertInput> & Pick<NoteAppearanceUpsertInput, 'id'>) {
    return dbService.noteAppearance.upsert(data)
  },
}
