import type { DomainEvent, EntityRef, EntityRefDomain, TimelineItem, TimelineKind, TimelineVisibility } from '../models/types'
import { db } from '../db'
import { dispatchSyncDataUpdated } from '../sync/constants'
import { projectTimelineEvent } from '../events/timelineProjection'
import { domainEventsRepo, finalizeDomainEvent } from '../events/domainEventsRepo'

export type TimelineCursor = { occurredAt: number; id: string }

export type TimelineListInput = {
  domain?: EntityRefDomain
  kind?: TimelineKind
  entity?: EntityRef
  from?: number
  to?: number
  visibility?: TimelineVisibility[]
  pinnedOnly?: boolean
  limit?: number
  cursor?: TimelineCursor
  search?: string
}

export type TimelineListResult = {
  items: TimelineItem[]
  nextCursor?: TimelineCursor
}

const DEFAULT_LIMIT = 80

const subjectKey = (ref: EntityRef) => `${ref.type}:${ref.id}`

const compareTimelineDesc = (left: TimelineItem, right: TimelineItem) =>
  right.occurredAt - left.occurredAt || right.createdAt - left.createdAt || right.id.localeCompare(left.id)

const isEntityMatch = (item: TimelineItem, ref: EntityRef) => {
  const key = subjectKey(ref)
  return item.subjectKey === key || item.related.some((related) => subjectKey(related) === key)
}

const eventIdFromDedupeKey = (dedupeKey: string) => `evt_${dedupeKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`

const createBackfillEvent = <TType extends DomainEvent['type']>(
  input: Omit<DomainEvent<TType>, 'id' | 'actorId' | 'workspaceId' | 'source' | 'subjectKey' | 'related' | 'schemaVersion' | 'createdAt' | 'updatedAt'> & {
    related?: EntityRef[]
  },
): DomainEvent<TType> => {
  const timestamp = Date.now()
  return {
    id: eventIdFromDedupeKey(input.dedupeKey),
    ...input,
    actorId: null,
    workspaceId: null,
    source: { kind: 'backfill' },
    subjectKey: subjectKey(input.subject),
    related: input.related ?? [],
    schemaVersion: 1,
    createdAt: input.occurredAt || timestamp,
    updatedAt: input.occurredAt || timestamp,
  }
}

export const timelineRepo = {
  async list(input: TimelineListInput = {}): Promise<TimelineListResult> {
    const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_LIMIT, 200))
    const visibility = input.visibility ?? ['default', 'quiet']
    const search = input.search?.trim().toLowerCase()
    const rows = await db.timelineItems.toArray()
    const filtered = rows
      .filter((item) => visibility.includes(item.visibility))
      .filter((item) => (input.domain ? item.domain === input.domain : true))
      .filter((item) => (input.kind ? item.kind === input.kind : true))
      .filter((item) => (input.entity ? isEntityMatch(item, input.entity) : true))
      .filter((item) => (typeof input.from === 'number' ? item.occurredAt >= input.from : true))
      .filter((item) => (typeof input.to === 'number' ? item.occurredAt <= input.to : true))
      .filter((item) => (input.pinnedOnly ? item.pinned : true))
      .filter((item) => {
        if (!search) return true
        return `${item.title} ${item.summary ?? ''} ${item.kind} ${item.domain}`.toLowerCase().includes(search)
      })
      .sort(compareTimelineDesc)
      .filter((item) => {
        if (!input.cursor) return true
        if (item.occurredAt < input.cursor.occurredAt) return true
        if (item.occurredAt > input.cursor.occurredAt) return false
        return item.id < input.cursor.id
      })

    const page = filtered.slice(0, limit)
    const hasMore = filtered.length > limit
    const tail = page.at(-1)
    return {
      items: page,
      nextCursor: hasMore && tail ? { occurredAt: tail.occurredAt, id: tail.id } : undefined,
    }
  },

  async listForEntity(ref: EntityRef, limit = 50) {
    return this.list({ entity: ref, limit })
  },

  async listRecent(limit = 12) {
    return this.list({ limit })
  },

  async pin(id: string, pinned: boolean) {
    const current = await db.timelineItems.get(id)
    if (!current) return undefined
    const next = { ...current, pinned, updatedAt: Date.now() }
    await db.timelineItems.put(next)
    dispatchSyncDataUpdated('timelineItems')
    return next
  },

  async hide(id: string) {
    const current = await db.timelineItems.get(id)
    if (!current) return undefined
    const next = { ...current, visibility: 'hidden' as const, updatedAt: Date.now() }
    await db.timelineItems.put(next)
    dispatchSyncDataUpdated('timelineItems')
    return next
  },

  async restore(id: string) {
    const current = await db.timelineItems.get(id)
    if (!current) return undefined
    const next = { ...current, visibility: 'default' as const, updatedAt: Date.now() }
    await db.timelineItems.put(next)
    dispatchSyncDataUpdated('timelineItems')
    return next
  },

  async rebuild() {
    await db.timelineItems.clear()
    const events = await db.domainEvents.orderBy('occurredAt').toArray()
    for (const event of events) {
      await projectTimelineEvent(event)
    }
    dispatchSyncDataUpdated('timelineItems')
  },

  async backfill() {
    const [tasks, notes, focusSessions, diaryEntries, projects, podcasts] = await Promise.all([
      db.tasks.toArray(),
      db.notes.toArray(),
      db.focusSessions.toArray(),
      db.diaryEntries.toArray(),
      db.projects.toArray(),
      db.lifePodcasts.toArray(),
    ])

    const events: DomainEvent[] = []
    for (const task of tasks) {
      events.push(createBackfillEvent({
        type: 'task.created',
        occurredAt: task.createdAt,
        dedupeKey: `backfill:task.created:${task.id}`,
        subject: { domain: 'productivity', type: 'task', id: task.id },
        related: task.projectId ? [{ domain: 'productivity', type: 'project', id: task.projectId }] : [],
        payload: { title: task.title, status: task.status, priority: task.priority, projectId: task.projectId },
      }))
      if (task.status === 'done') {
        const completedAt = task.updatedAt
        events.push(createBackfillEvent({
          type: 'task.completed',
          occurredAt: task.updatedAt,
          dedupeKey: `backfill:task.completed:${task.id}:${completedAt}`,
          subject: { domain: 'productivity', type: 'task', id: task.id },
          related: task.projectId ? [{ domain: 'productivity', type: 'project', id: task.projectId }] : [],
          payload: { title: task.title, previousStatus: 'doing', completedAt, projectId: task.projectId },
        }))
      }
    }
    for (const note of notes.filter((note) => !note.deletedAt)) {
      events.push(createBackfillEvent({
        type: 'note.created',
        occurredAt: note.createdAt,
        dedupeKey: `backfill:note.created:${note.id}`,
        subject: { domain: 'content', type: 'note', id: note.id },
        payload: { title: note.title || 'Untitled', collection: note.collection, tagNames: note.tags },
      }))
    }
    for (const session of focusSessions.filter((session) => session.status === 'completed')) {
      const completedAt = session.completedAt ?? session.updatedAt
      events.push(createBackfillEvent({
        type: 'focus.completed',
        occurredAt: completedAt,
        dedupeKey: `backfill:focus.completed:${session.id}`,
        subject: { domain: 'productivity', type: 'focusSession', id: session.id },
        related: session.taskId ? [{ domain: 'productivity', type: 'task', id: session.taskId }] : [],
        payload: {
          taskId: session.taskId,
          goal: session.goal,
          plannedMinutes: session.plannedMinutes,
          actualMinutes: session.actualMinutes ?? session.plannedMinutes,
          completedAt,
        },
      }))
    }
    for (const entry of diaryEntries.filter((entry) => !entry.deletedAt)) {
      const entryAt = entry.entryAt ?? entry.createdAt
      events.push(createBackfillEvent({
        type: 'diary.created',
        occurredAt: entryAt,
        dedupeKey: `backfill:diary.created:${entry.id}`,
        subject: { domain: 'life', type: 'diaryEntry', id: entry.id },
        payload: { dateKey: entry.dateKey, entryAt, tagNames: entry.tags },
      }))
    }
    for (const project of projects) {
      events.push(createBackfillEvent({
        type: 'project.created',
        occurredAt: project.createdAt,
        dedupeKey: `backfill:project.created:${project.id}`,
        subject: { domain: 'productivity', type: 'project', id: project.id },
        payload: { title: project.title, status: project.status, priority: project.priority, dueDate: project.dueDate },
      }))
      if (project.status === 'archived') {
        events.push(createBackfillEvent({
          type: 'project.archived',
          occurredAt: project.updatedAt,
          dedupeKey: `backfill:project.archived:${project.id}`,
          subject: { domain: 'productivity', type: 'project', id: project.id },
          payload: { title: project.title, archivedAt: project.updatedAt },
        }))
      }
    }
    for (const podcast of podcasts) {
      events.push(createBackfillEvent({
        type: 'podcast.saved',
        occurredAt: podcast.createdAt,
        dedupeKey: `backfill:podcast.saved:${podcast.id}`,
        subject: { domain: 'life', type: 'lifePodcast', id: podcast.id },
        payload: { name: podcast.name, author: podcast.author, source: podcast.source, collectionId: podcast.collectionId },
      }))
    }

    if (events.length === 0) return 0
    const ordered = events.sort((left, right) => left.occurredAt - right.occurredAt || left.id.localeCompare(right.id))
    let created = 0
    for (const event of ordered) {
      const existing = await domainEventsRepo.getByDedupeKey(event.dedupeKey)
      const saved = await domainEventsRepo.append(event)
      if (!existing) created++
      await finalizeDomainEvent(saved)
    }
    return created
  },
}
