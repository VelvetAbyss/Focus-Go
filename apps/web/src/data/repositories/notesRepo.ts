import type { NoteCreateInput, NoteUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

export const notesRepo = {
  list() {
    return dbService.notes.list()
  },
  listTrash() {
    return dbService.notes.listTrash()
  },
  create(data?: NoteCreateInput) {
    return dbService.notes.create(data)
  },
  update(id: string, patch: NoteUpdateInput) {
    return dbService.notes.update(id, patch)
  },
  softDelete(id: string) {
    return dbService.notes.softDelete(id)
  },
  restore(id: string) {
    return dbService.notes.restore(id)
  },
  hardDelete(id: string) {
    return dbService.notes.hardDelete(id)
  },
}
