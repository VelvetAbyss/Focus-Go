import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { publishDomainEvent } from '../events/publisher'
import { finalizeDomainEvent } from '../events/domainEventsRepo'
import '../events/timelineProjection'
import { timelineRepo } from './timelineRepo'

describe('timelineRepo', () => {
  beforeEach(async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  it('projects domain events into idempotent timeline items', async () => {
    const event = await publishDomainEvent({
      type: 'task.completed',
      occurredAt: 1_768_475_200_000,
      subject: { domain: 'productivity', type: 'task', id: 'task-1' },
      payload: { title: 'Ship timeline', previousStatus: 'doing', completedAt: 1_768_475_200_000 },
      dedupeKey: 'task.completed:task-1:test',
    })

    await finalizeDomainEvent(event)
    await finalizeDomainEvent(event)

    const items = await db.timelineItems.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id: `tl_${event.id}`,
      eventId: event.id,
      kind: 'task',
      title: 'Completed task',
      summary: 'Ship timeline',
      visibility: 'default',
      subjectKey: 'task:task-1',
    })
  })

  it('filters by kind, domain, entity, visibility, and search', async () => {
    const task = await publishDomainEvent({
      type: 'task.created',
      occurredAt: 30,
      subject: { domain: 'productivity', type: 'task', id: 'task-1' },
      related: [{ domain: 'productivity', type: 'project', id: 'project-1' }],
      payload: { title: 'Review activity feed', status: 'todo', priority: null, projectId: 'project-1' },
      dedupeKey: 'task.created:task-1',
    })
    const focus = await publishDomainEvent({
      type: 'focus.started',
      occurredAt: 20,
      subject: { domain: 'productivity', type: 'focusSession', id: 'focus-1' },
      payload: { plannedMinutes: 25, goal: 'Draft' },
      dedupeKey: 'focus.started:focus-1',
    })
    await finalizeDomainEvent(task)
    await finalizeDomainEvent(focus)

    expect((await timelineRepo.list({ kind: 'task' })).items.map((item) => item.kind)).toEqual(['task'])
    expect((await timelineRepo.list({ entity: { domain: 'productivity', type: 'project', id: 'project-1' } })).items).toHaveLength(1)
    expect((await timelineRepo.list({ search: 'activity' })).items[0]?.summary).toBe('Review activity feed')
    expect((await timelineRepo.list({ visibility: ['default'] })).items.map((item) => item.kind)).toEqual(['task'])
    expect((await timelineRepo.list({ visibility: ['default', 'quiet'] })).items.map((item) => item.kind)).toEqual(['task', 'focus'])
  })

  it('backfills existing data', async () => {
    await db.tasks.put({
      id: 'task-old',
      title: 'Old task',
      description: '',
      pinned: false,
      isToday: false,
      status: 'done',
      priority: null,
      tags: [],
      subtasks: [],
      taskNoteBlocks: [],
      taskNoteContentMd: '',
      taskNoteContentJson: null,
      activityLogs: [],
      createdAt: 10,
      updatedAt: 20,
    })

    const before = await db.tasks.get('task-old')
    const count = await timelineRepo.backfill()
    expect(count).toBe(2)
    expect(await db.domainEvents.count()).toBe(2)
    expect((await timelineRepo.list({ kind: 'task' })).items).toHaveLength(2)
    expect(await timelineRepo.backfill()).toBe(0)
    expect(await db.domainEvents.count()).toBe(2)
    expect((await timelineRepo.list({ kind: 'task' })).items).toHaveLength(2)
    expect((await db.tasks.get('task-old'))?.updatedAt).toBe(before?.updatedAt)
  })
})
