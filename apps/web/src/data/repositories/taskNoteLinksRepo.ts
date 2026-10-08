import { db } from '../db'
import type { NoteItem, TaskNoteLink } from '../models/types'
import { enqueueSyncOperationInBackground } from '../sync/repository'
import { withBase } from './base'
import { notesRepo } from './notesRepo'
import { readLanguage } from '../../shared/prefs/preferences'

const buildLinkId = (taskId: string, noteId: string) => `${taskId}:${noteId}`

// Title for a note spun out of a task, in the app language.
const taskNoteTitle = (taskTitle: string | undefined) => {
  const seed = (taskTitle ?? '').trim().slice(0, 40)
  if (!seed) return ''
  return `${seed} · ${readLanguage() === 'zh' ? '笔记' : 'Note'}`
}

// Per-task in-flight migrations. Opening a task can call listByTask from
// more than one place at once (and twice under StrictMode); without this
// each caller saw "no links yet" and created its own copy of the note.
const legacyMigrations = new Map<string, Promise<boolean>>()

const sortByOrder = (links: TaskNoteLink[]) =>
  links.slice().sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.createdAt - b.createdAt
  })

export const taskNoteLinksRepo = {
  async listByTask(taskId: string): Promise<Array<{ link: TaskNoteLink; note: NoteItem }>> {
    let links = await db.taskNoteLinks.where('taskId').equals(taskId).toArray()
    if (links.length === 0) {
      const migrated = await this.migrateLegacyForTask(taskId)
      if (migrated) {
        links = await db.taskNoteLinks.where('taskId').equals(taskId).toArray()
      }
    }
    const notes = await db.notes.toArray()
    const noteMap = new Map(notes.map((note) => [note.id, note] as const))
    const items: Array<{ link: TaskNoteLink; note: NoteItem }> = []
    const orphanLinkIds: string[] = []
    for (const link of links) {
      const note = noteMap.get(link.noteId)
      if (!note || note.deletedAt) {
        if (!note) orphanLinkIds.push(link.id)
        continue
      }
      items.push({ link, note })
    }
    if (orphanLinkIds.length) {
      await db.taskNoteLinks.bulkDelete(orphanLinkIds)
    }
    return sortByOrder(items.map((item) => item.link)).map((link) => {
      const note = noteMap.get(link.noteId)!
      return { link, note }
    })
  },

  async listLinksByNote(noteId: string): Promise<TaskNoteLink[]> {
    return db.taskNoteLinks.where('noteId').equals(noteId).toArray()
  },

  async createForTask(taskId: string, taskTitle?: string): Promise<{ link: TaskNoteLink; note: NoteItem }> {
    const existing = await db.taskNoteLinks.where('taskId').equals(taskId).toArray()
    const nextOrder = existing.length === 0 ? 0 : Math.max(...existing.map((item) => item.order)) + 1
    const note = await notesRepo.create({
      title: taskNoteTitle(taskTitle),
      contentMd: '',
      collection: 'all-notes',
    })
    const link: TaskNoteLink = {
      ...withBase({ taskId, noteId: note.id, order: nextOrder } satisfies Omit<TaskNoteLink, 'id' | 'createdAt' | 'updatedAt'>),
      id: buildLinkId(taskId, note.id),
    }
    await db.taskNoteLinks.put(link)
    enqueueSyncOperationInBackground('taskNoteLinks', 'upsert', link)
    return { link, note }
  },

  async linkExistingNote(taskId: string, noteId: string): Promise<TaskNoteLink> {
    const existing = await db.taskNoteLinks.where('taskId').equals(taskId).toArray()
    const dup = existing.find((row) => row.noteId === noteId)
    if (dup) return dup
    const nextOrder = existing.length === 0 ? 0 : Math.max(...existing.map((item) => item.order)) + 1
    const link: TaskNoteLink = {
      ...withBase({ taskId, noteId, order: nextOrder } satisfies Omit<TaskNoteLink, 'id' | 'createdAt' | 'updatedAt'>),
      id: buildLinkId(taskId, noteId),
    }
    await db.taskNoteLinks.put(link)
    enqueueSyncOperationInBackground('taskNoteLinks', 'upsert', link)
    return link
  },

  async removeLink(taskId: string, noteId: string): Promise<void> {
    const id = buildLinkId(taskId, noteId)
    const deletedAt = Date.now()
    await db.taskNoteLinks.delete(id)
    enqueueSyncOperationInBackground('taskNoteLinks', 'delete', { id, updatedAt: deletedAt, taskId, noteId }, deletedAt)
  },

  /** Returns the links it removed, so undoing a task delete can put them back. */
  async unlinkAllForTask(taskId: string): Promise<TaskNoteLink[]> {
    const links = await db.taskNoteLinks.where('taskId').equals(taskId).toArray()
    if (links.length === 0) return []
    const deletedAt = Date.now()
    await db.taskNoteLinks.bulkDelete(links.map((link) => link.id))
    links.forEach((link) => {
      enqueueSyncOperationInBackground(
        'taskNoteLinks',
        'delete',
        { id: link.id, updatedAt: deletedAt, taskId: link.taskId, noteId: link.noteId },
        deletedAt,
      )
    })
    return links
  },

  /** Puts back links removed by unlinkAllForTask. A fresh updatedAt outranks the tombstone on the server. */
  async restoreLinks(links: TaskNoteLink[]): Promise<void> {
    if (links.length === 0) return
    const restoredAt = Date.now()
    const restored = links.map((link) => ({ ...link, updatedAt: restoredAt }))
    await db.taskNoteLinks.bulkPut(restored)
    restored.forEach((link) => enqueueSyncOperationInBackground('taskNoteLinks', 'upsert', link))
  },

  /**
   * Lazy per-task migration. Returns true if a NoteItem+link was created from the legacy field.
   */
  async migrateLegacyForTask(taskId: string): Promise<boolean> {
    const pending = legacyMigrations.get(taskId)
    if (pending) return pending
    const run = this.runLegacyMigration(taskId)
    legacyMigrations.set(taskId, run)
    try {
      return await run
    } finally {
      legacyMigrations.delete(taskId)
    }
  },

  async runLegacyMigration(taskId: string): Promise<boolean> {
    const task = await db.tasks.get(taskId)
    if (!task) return false
    const md = task.taskNoteContentMd?.trim()
    if (!md) return false
    if ((await db.taskNoteLinks.where('taskId').equals(taskId).count()) > 0) return false
    try {
      const note = await notesRepo.create({
        title: taskNoteTitle(task.title),
        contentMd: task.taskNoteContentMd ?? '',
        contentJson: task.taskNoteContentJson ?? null,
        collection: 'all-notes',
      })
      const link: TaskNoteLink = {
        ...withBase({ taskId, noteId: note.id, order: 0 } satisfies Omit<TaskNoteLink, 'id' | 'createdAt' | 'updatedAt'>),
        id: buildLinkId(taskId, note.id),
      }
      await db.taskNoteLinks.put(link)
      enqueueSyncOperationInBackground('taskNoteLinks', 'upsert', link)
      return true
    } catch (error) {
      console.error('[taskNoteLinksRepo] migrateLegacyForTask failed', taskId, error)
      return false
    }
  },

  /**
   * Bulk migration utility (optional). Idempotent: skips tasks that already have any link.
   */
  async migrateLegacyTaskNotes(): Promise<{ migrated: number; skipped: number }> {
    const [tasks, existingLinks] = await Promise.all([db.tasks.toArray(), db.taskNoteLinks.toArray()])
    const linkedTaskIds = new Set(existingLinks.map((link) => link.taskId))
    let migrated = 0
    let skipped = 0
    for (const task of tasks) {
      if (linkedTaskIds.has(task.id)) continue
      const md = task.taskNoteContentMd?.trim()
      if (!md) continue
      try {
        const note = await notesRepo.create({
          title: taskNoteTitle(task.title),
          contentMd: task.taskNoteContentMd ?? '',
          contentJson: task.taskNoteContentJson ?? null,
          collection: 'all-notes',
        })
        const link: TaskNoteLink = {
          ...withBase({ taskId: task.id, noteId: note.id, order: 0 } satisfies Omit<TaskNoteLink, 'id' | 'createdAt' | 'updatedAt'>),
          id: buildLinkId(task.id, note.id),
        }
        await db.taskNoteLinks.put(link)
        enqueueSyncOperationInBackground('taskNoteLinks', 'upsert', link)
        migrated += 1
      } catch (error) {
        console.error('[taskNoteLinksRepo] migrate failed for task', task.id, error)
        skipped += 1
      }
    }
    return { migrated, skipped }
  },
}
