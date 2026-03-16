import type { NoteTagCreateInput, NoteTagUpdateInput } from '@focus-go/core'
import { dbService } from '../services/dbService'

export const noteTagsRepo = {
  list() {
    return dbService.noteTags.list()
  },
  create(data: NoteTagCreateInput) {
    return dbService.noteTags.create(data)
  },
  update(id: string, patch: NoteTagUpdateInput) {
    return dbService.noteTags.update(id, patch)
  },
  remove(id: string) {
    return dbService.noteTags.remove(id)
  },
}
