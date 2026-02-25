import { db } from '../db'
import type { NoteEntity } from '../models/types'
import { touch, withBase } from './base'
import { buildBacklinkIndex, resolveLinkedNoteIds } from '../../features/notes/model/noteGraph'
import { extractHashTagsFromMarkdown, mergeTags, normalizeTag } from '../../features/notes/model/tags'
import { noteAssetsRepo } from './noteAssetsRepo'

const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : []

const isSameStringArray = (left: string[], right: string[]) =>
  left.length === right.length && left.every((item, index) => item === right[index])

const isSameJson = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

const normalizeNote = (note: NoteEntity): NoteEntity => ({
  ...note,
  title: typeof note.title === 'string' ? note.title : '',
  contentMd: typeof note.contentMd === 'string' ? note.contentMd : '',
  contentJson: note.contentJson && typeof note.contentJson === 'object' ? note.contentJson : null,
  manualTags: mergeTags(normalizeStringArray(note.manualTags).map((tag) => normalizeTag(tag)), []),
  tags: mergeTags(
    normalizeStringArray(note.manualTags).map((tag) => normalizeTag(tag)),
    extractHashTagsFromMarkdown(typeof note.contentMd === 'string' ? note.contentMd : ''),
  ),
  linkedNoteIds: Array.isArray(note.linkedNoteIds) ? note.linkedNoteIds : [],
  backlinks: Array.isArray(note.backlinks) ? note.backlinks : [],
  deletedAt: note.deletedAt ?? null,
  expiresAt: note.expiresAt ?? null,
})

const sortByUpdatedAtDesc = (notes: NoteEntity[]) => notes.sort((a, b) => b.updatedAt - a.updatedAt)

const rebuildNoteGraph = async (notes: NoteEntity[]) => {
  const active = notes.filter((item) => !item.deletedAt)
  const backlinks = buildBacklinkIndex(active)
  const updated = notes.map((item) => {
    if (item.deletedAt) return item
    return {
      ...item,
      linkedNoteIds: resolveLinkedNoteIds(item.contentMd, active).filter((id) => id !== item.id),
      backlinks: backlinks.get(item.id) ?? [],
    }
  })
  await db.noteEntries.bulkPut(updated)
  return updated
}

export const notesRepo = {
  async listAll() {
    const rows = await db.noteEntries.toArray()
    const normalized = rows.map((row) => normalizeNote(row))
    const hasDiff = rows.some((row, idx) => {
      const next = normalized[idx]
      return (
        row.title !== next.title ||
        row.contentMd !== next.contentMd ||
        !isSameJson(row.contentJson, next.contentJson) ||
        !isSameStringArray(normalizeStringArray(row.manualTags), next.manualTags) ||
        !isSameStringArray(normalizeStringArray(row.tags), next.tags) ||
        !isSameStringArray(normalizeStringArray(row.linkedNoteIds), next.linkedNoteIds) ||
        !isSameStringArray(normalizeStringArray(row.backlinks), next.backlinks) ||
        row.deletedAt !== next.deletedAt ||
        row.expiresAt !== next.expiresAt
      )
    })
    if (hasDiff) await db.noteEntries.bulkPut(normalized)
    return normalized
  },

  async listActive() {
    const all = await this.listAll()
    return sortByUpdatedAtDesc(all.filter((note) => !note.deletedAt))
  },

  async listTrash() {
    const all = await this.listAll()
    return sortByUpdatedAtDesc(all.filter((note) => !!note.deletedAt))
  },

  async get(id: string) {
    const row = await db.noteEntries.get(id)
    return row ? normalizeNote(row) : undefined
  },

  async create() {
    const next: NoteEntity = withBase({
      title: '',
      contentMd: '',
      contentJson: null,
      manualTags: [],
      tags: [],
      linkedNoteIds: [],
      backlinks: [],
      deletedAt: null,
      expiresAt: null,
    })
    await db.noteEntries.add(next)
    return next
  },

  async save(note: NoteEntity) {
    const all = await this.listAll()
    const nowTouched = touch(normalizeNote({ ...note, deletedAt: null, expiresAt: null }))
    const targetIndex = all.findIndex((item) => item.id === note.id)
    const merged = targetIndex >= 0 ? all.map((item, idx) => (idx === targetIndex ? nowTouched : item)) : [...all, nowTouched]
    const updated = await rebuildNoteGraph(merged)
    return updated.find((item) => item.id === nowTouched.id) as NoteEntity
  },

  async softDelete(id: string) {
    const note = await this.get(id)
    if (!note) return undefined
    const now = Date.now()
    const next = touch({
      ...note,
      deletedAt: now,
      expiresAt: now + TRASH_RETENTION_MS,
    })
    await db.noteEntries.put(next)
    return next
  },

  async restore(id: string) {
    const note = await this.get(id)
    if (!note) return undefined
    const next = touch({ ...note, deletedAt: null, expiresAt: null })
    await db.noteEntries.put(next)
    return this.save(next)
  },

  async hardDelete(id: string) {
    await db.noteEntries.delete(id)
    await noteAssetsRepo.removeByNote(id)
    const all = await this.listAll()
    await rebuildNoteGraph(all)
  },

  async purgeExpiredTrash(now = Date.now()) {
    const rows = await db.noteEntries.where('expiresAt').belowOrEqual(now).toArray()
    const targets = rows.filter((note) => !!note.deletedAt)
    if (!targets.length) return 0
    await db.noteEntries.bulkDelete(targets.map((note) => note.id))
    await Promise.all(targets.map((note) => noteAssetsRepo.removeByNote(note.id)))
    const all = await this.listAll()
    await rebuildNoteGraph(all)
    return targets.length
  },

  async searchByTitle(query: string) {
    const q = query.trim().toLowerCase()
    const active = await this.listActive()
    if (!q) return active
    return active.filter((note) => note.title.trim().toLowerCase().includes(q))
  },
}
