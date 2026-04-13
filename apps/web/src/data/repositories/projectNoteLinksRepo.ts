import { db } from '../db'
import type { NoteItem, ProjectNoteLink } from '../models/types'
import { withBase } from './base'
import { projectTagName } from './projectsRepo'

const buildLinkId = (projectId: string, noteId: string) => `${projectId}:${noteId}`

export const projectNoteLinksRepo = {
  async syncProjectLinks(projectId: string) {
    const [notes, links] = await Promise.all([
      db.notes.toArray(),
      db.projectNoteLinks.where('projectId').equals(projectId).toArray(),
    ])
    const tagName = projectTagName(projectId)
    const linked = new Set(links.map((link) => link.noteId))
    const next = notes
      .filter((note) => !note.deletedAt && note.tags.includes(tagName) && !linked.has(note.id))
      .map((note) => ({
        ...withBase({
          projectId,
          noteId: note.id,
          tagName,
        } satisfies Omit<ProjectNoteLink, 'id' | 'createdAt' | 'updatedAt'>),
        id: buildLinkId(projectId, note.id),
      }))
    if (next.length > 0) await db.projectNoteLinks.bulkPut(next)
  },
  async listByProject(projectId: string) {
    await this.syncProjectLinks(projectId)
    const [links, notes] = await Promise.all([
      db.projectNoteLinks.where('projectId').equals(projectId).toArray(),
      db.notes.toArray(),
    ])
    const noteMap = new Map(notes.map((note) => [note.id, note] as const))
    return links
      .map((link) => {
        const note = noteMap.get(link.noteId)
        if (!note || note.deletedAt) return null
        return { link, note }
      })
      .filter((item): item is { link: ProjectNoteLink; note: NoteItem } => Boolean(item))
      .sort((left, right) => right.note.updatedAt - left.note.updatedAt)
  },
  async remove(projectId: string, noteId: string) {
    await db.projectNoteLinks.delete(buildLinkId(projectId, noteId))
  },
}
