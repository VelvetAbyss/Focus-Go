import type { NoteCreateInput, NoteUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

// IndexedDB is the source of truth. A second list cache could be overwritten
// by a read that started before a save and finished after it.
export const notesRepo = {
  list: () => dbService.notes.list(),
  listTrash: () => dbService.notes.listTrash(),
  create: (data?: NoteCreateInput) => dbService.notes.create(data),
  update: (id: string, patch: NoteUpdateInput) => dbService.notes.update(id, patch),
  softDelete: (id: string) => dbService.notes.softDelete(id),
  restore: (id: string) => dbService.notes.restore(id),
  hardDelete: (id: string) => dbService.notes.hardDelete(id),
}
