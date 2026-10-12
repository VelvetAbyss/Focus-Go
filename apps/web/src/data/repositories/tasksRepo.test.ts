// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { resetRxdbSyncDatabase } from '../sync/rxdb'
import { tasksRepo } from './tasksRepo'
import { TASK_TRASH_RETENTION_MS, taskTrashRepo } from './taskTrashRepo'

describe('tasksRepo remove/restore', () => {
  beforeEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  afterEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
  })

  it('puts a deleted task back with its id, content and note links', async () => {
    const task = await tasksRepo.add({ title: 'Follow up PO 8MT4877', status: 'doing', priority: 'high', tags: ['Lowes'] })
    const link = { id: `${task.id}:note-1`, taskId: task.id, noteId: 'note-1', order: 0, createdAt: 1, updatedAt: 1 }
    await db.taskNoteLinks.put(link)

    const removedLinks = await tasksRepo.remove(task.id)

    expect(removedLinks).toEqual([link])
    expect(await tasksRepo.list()).toHaveLength(0)
    expect(await db.taskNoteLinks.count()).toBe(0)

    const restored = await tasksRepo.restore(task, removedLinks)

    expect(restored.updatedAt).toBeGreaterThanOrEqual(task.updatedAt)
    const [listed] = await tasksRepo.list()
    expect(listed).toMatchObject({ id: task.id, title: 'Follow up PO 8MT4877', status: 'doing', priority: 'high', tags: ['Lowes'] })
    expect(await db.taskNoteLinks.get(link.id)).toMatchObject({ taskId: task.id, noteId: 'note-1' })
  })
})

describe('task trash', () => {
  beforeEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  afterEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
  })

  it('keeps a deleted task with its links, and brings it back out', async () => {
    const task = await tasksRepo.add({ title: 'Ship the samples', status: 'todo', priority: null })
    const link = { id: `${task.id}:note-1`, taskId: task.id, noteId: 'note-1', order: 0, createdAt: 1, updatedAt: 1 }
    await db.taskNoteLinks.put(link)

    await tasksRepo.remove(task.id)

    const [entry] = await taskTrashRepo.list()
    expect(entry).toMatchObject({ id: task.id, task: { title: 'Ship the samples' }, links: [link] })

    const restored = await tasksRepo.restoreFromTrash(task.id)
    expect(restored?.id).toBe(task.id)
    expect(await tasksRepo.list()).toHaveLength(1)
    expect(await db.taskNoteLinks.get(link.id)).toBeTruthy()
    expect(await taskTrashRepo.list()).toEqual([])
    expect(await tasksRepo.restoreFromTrash(task.id)).toBeUndefined()
  })

  it('undo takes the task out of the trash too', async () => {
    const task = await tasksRepo.add({ title: 'Call the bank', status: 'todo', priority: null })
    const links = await tasksRepo.remove(task.id)
    await tasksRepo.restore(task, links)
    expect(await taskTrashRepo.list()).toEqual([])
  })

  it('forgets what has been there more than 30 days, newest first otherwise', async () => {
    const now = Date.now()
    const base = await tasksRepo.add({ title: 'base', status: 'todo', priority: null })
    await taskTrashRepo.keep({ ...base, id: 'old' }, [], now - TASK_TRASH_RETENTION_MS - 1000)
    await taskTrashRepo.keep({ ...base, id: 'older-ok' }, [], now - 5 * 86400000)
    await taskTrashRepo.keep({ ...base, id: 'new' }, [], now - 1000)
    expect((await taskTrashRepo.list(now)).map((entry) => entry.id)).toEqual(['new', 'older-ok'])
    expect(await db.taskTrash.get('old')).toBeUndefined()
  })

  it('restores a task whose project was deleted without the dangling project', async () => {
    const task = await tasksRepo.add({ title: 'Orphan', status: 'todo', priority: null, projectId: 'gone' })
    await tasksRepo.remove(task.id)
    const restored = await tasksRepo.restoreFromTrash(task.id)
    expect(restored?.projectId).toBeUndefined()
  })

  it('does not trash the untouched next occurrence taken back on reopen', async () => {
    const task = await tasksRepo.add({ title: 'Weekly report', status: 'todo', priority: null, dueDate: new Date().toISOString().slice(0, 10), recurrence: { frequency: 'weekly', interval: 1 } })
    const done = await tasksRepo.updateStatus(task.id, 'done')
    expect(done?.recurrenceNextId).toBeTruthy()
    await tasksRepo.updateStatus(task.id, 'todo')
    expect(await taskTrashRepo.list()).toEqual([])
  })
})

describe('tasksRepo status side effects', () => {
  beforeEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  afterEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
  })

  const dateKey = (offset: number) => {
    const now = new Date()
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  it('finishing a repeating task creates the next one and hands it the rule', async () => {
    const task = await tasksRepo.add({ title: '交周报', status: 'todo', priority: null, dueDate: dateKey(0), recurrence: { frequency: 'weekly', interval: 1 } })

    const done = await tasksRepo.updateStatus(task.id, 'done')

    expect(done?.recurrence).toBeUndefined()
    expect(done?.recurrenceNextId).toBeTruthy()
    const next = (await tasksRepo.list()).find((item) => item.id === done?.recurrenceNextId)
    expect(next).toMatchObject({ title: '交周报', status: 'todo', dueDate: dateKey(7), recurrence: { frequency: 'weekly', interval: 1 } })

    // Re-applying the status must not spawn a second one.
    await tasksRepo.updateStatus(task.id, 'done')
    expect(await tasksRepo.list()).toHaveLength(2)
  })

  it('reopening takes back an untouched next occurrence and the rule with it', async () => {
    const task = await tasksRepo.add({ title: '浇花', status: 'todo', priority: null, dueDate: dateKey(0), recurrence: { frequency: 'daily', interval: 1 } })
    await tasksRepo.updateStatus(task.id, 'done')

    const reopened = await tasksRepo.updateStatus(task.id, 'todo')

    expect(reopened).toMatchObject({ status: 'todo', recurrence: { frequency: 'daily', interval: 1 } })
    expect(reopened?.recurrenceNextId).toBeUndefined()
    expect(await tasksRepo.list()).toHaveLength(1)
  })

  it('leaves a next occurrence that already has a life of its own', async () => {
    const task = await tasksRepo.add({ title: '浇花', status: 'todo', priority: null, dueDate: dateKey(0), recurrence: { frequency: 'daily', interval: 1 } })
    const done = await tasksRepo.updateStatus(task.id, 'done')
    const next = (await tasksRepo.list()).find((item) => item.id === done?.recurrenceNextId)!
    await new Promise((resolve) => setTimeout(resolve, 2))
    await tasksRepo.update({ ...next, title: '浇花（阳台）' })

    const reopened = await tasksRepo.updateStatus(task.id, 'todo')

    expect(reopened?.recurrence).toBeUndefined()
    expect(reopened?.recurrenceNextId).toBeUndefined()
    const remaining = await tasksRepo.list()
    expect(remaining).toHaveLength(2)
    expect(remaining.find((item) => item.id === next.id)?.recurrence).toEqual({ frequency: 'daily', interval: 1 })
  })

  it('dropping a repeating task skips to the next occurrence', async () => {
    const task = await tasksRepo.add({ title: '晨跑', status: 'todo', priority: null, dueDate: dateKey(0), recurrence: { frequency: 'daily', interval: 1 } })
    const dropped = await tasksRepo.updateStatus(task.id, 'dropped')
    expect(dropped?.recurrenceNextId).toBeTruthy()
    expect((await tasksRepo.list()).find((item) => item.id === dropped?.recurrenceNextId)?.dueDate).toBe(dateKey(1))
  })

  it('records when waiting started and forgets it on leaving; dropping leaves 今日', async () => {
    const task = await tasksRepo.add({ title: '等 Mac 回复', status: 'todo', priority: null, isToday: true })

    const waiting = await tasksRepo.updateStatus(task.id, 'waiting')
    expect(typeof waiting?.waitingSince).toBe('number')
    const again = await tasksRepo.updateStatus(task.id, 'waiting')
    expect(again?.waitingSince).toBe(waiting?.waitingSince)

    const resumed = await tasksRepo.updateStatus(task.id, 'doing')
    expect(resumed?.waitingSince).toBeUndefined()

    await tasksRepo.update({ ...resumed!, dropReason: 'old' })
    const dropped = await tasksRepo.updateStatus(task.id, 'dropped')
    expect(dropped).toMatchObject({ status: 'dropped', isToday: false, dropReason: 'old' })
    const restored = await tasksRepo.updateStatus(task.id, 'todo')
    expect(restored?.dropReason).toBeUndefined()
  })
})
