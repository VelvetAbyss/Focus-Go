import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { IDatabaseService } from '@focus-go/core'
import { createDexieDatabaseService } from './DexieDatabaseService'
import { db } from '../db'

describe('DexieDatabaseService', () => {
  it('implements IDatabaseService contract surface', () => {
    const service: IDatabaseService = createDexieDatabaseService()
    expect(typeof service.tasks.list).toBe('function')
    expect(typeof service.notes.list).toBe('function')
    expect(typeof service.notes.create).toBe('function')
    expect(typeof service.notes.hardDelete).toBe('function')
    expect(typeof service.noteTags.list).toBe('function')
    expect(typeof service.noteAppearance.get).toBe('function')
    expect(typeof service.widgetTodos.add).toBe('function')
    expect(typeof service.widgetTodos.resetDone).toBe('function')
    expect(typeof service.focus.upsert).toBe('function')
    expect(typeof service.focusSessions.start).toBe('function')
    expect(typeof service.diary.listTrash).toBe('function')
    expect(typeof service.spend.listCategories).toBe('function')
    expect(typeof service.dashboard.get).toBe('function')
    expect(typeof service.habits.listHabits).toBe('function')
  })

  it('hydrates rich task note fields from legacy blocks when listing tasks', async () => {
    await db.tasks.clear()
    const service = createDexieDatabaseService()
    const created = await service.tasks.add({
      title: 'Legacy task',
      status: 'todo',
      priority: null,
    })
    await db.tasks.put({
      ...created,
      title: 'Legacy task',
      taskNoteBlocks: [
        { id: 'p1', type: 'paragraph', text: 'Prep ' },
        { id: 'p2', type: 'paragraph', text: ' before review' },
      ],
      taskNoteContentMd: undefined,
      taskNoteContentJson: undefined,
    })

    const task = (await service.tasks.list()).find((item) => item.id === created.id)

    expect(task).toBeDefined()
    expect(task?.taskNoteContentMd).toBe('Prep \n\n before review')
    expect(task?.taskNoteContentJson).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Prep ' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: ' before review' }],
        },
      ],
    })
  })

  it('clears legacy task note blocks when saving rich task note content', async () => {
    await db.tasks.clear()
    const service = createDexieDatabaseService()
    const created = await service.tasks.add({
      title: 'Rich task',
      status: 'todo',
      priority: null,
      taskNoteBlocks: [
        { id: 'legacy', type: 'paragraph', text: 'legacy text' },
      ],
      taskNoteContentMd: 'Fresh text',
      taskNoteContentJson: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Fresh text' }] }],
      },
    })

    expect(created.taskNoteBlocks).toEqual([])
    expect(created.taskNoteContentMd).toBe('Fresh text')

    const stored = await db.tasks.get(created.id)
    expect(stored?.taskNoteBlocks).toEqual([])
    expect(stored?.taskNoteContentMd).toBe('Fresh text')
  })

  it('creates a blank note and lists it as active', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const created = await service.notes.create()
    const notes = await service.notes.list()

    expect(created.title).toBe('')
    expect(created.collection).toBe('all-notes')
    expect(created.contentMd).toBe('')
    expect(notes.map((note) => note.id)).toContain(created.id)
  })

  it('soft deletes and restores notes through trash', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()
    const created = await service.notes.create()

    await service.notes.update(created.id, { title: 'Draft title', tags: ['Design'] })
    await service.notes.softDelete(created.id)

    const activeAfterDelete = await service.notes.list()
    const trashAfterDelete = await service.notes.listTrash()

    expect(activeAfterDelete.some((note) => note.id === created.id)).toBe(false)
    expect(trashAfterDelete.find((note) => note.id === created.id)?.deletedAt).toEqual(expect.any(Number))

    await service.notes.restore(created.id)

    const restored = await service.notes.list()
    expect(restored.find((note) => note.id === created.id)?.title).toBe('Draft title')
  })

  it('persists note appearance and note tags', async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    const service = createDexieDatabaseService()

    const tag = await service.noteTags.create({
      name: 'Research',
      icon: 'microscope',
      pinned: true,
      parentId: null,
      sortOrder: 1,
    })
    const appearance = await service.noteAppearance.upsert({
      id: 'note_appearance',
      theme: 'graphite',
      font: 'serif',
      fontSize: 18,
      lineHeight: 1.8,
      contentWidth: 70,
      focusMode: true,
    })

    expect(tag.name).toBe('Research')
    expect((await service.noteTags.list())[0]?.pinned).toBe(true)
    expect(appearance.theme).toBe('graphite')
    expect((await service.noteAppearance.get())?.font).toBe('serif')
  })
})
