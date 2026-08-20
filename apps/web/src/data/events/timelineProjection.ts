import type { DomainEvent, DomainEventPayloadMap, EntityRef, TimelineItem, TimelineKind, TimelineVisibility } from '../models/types'
import { db } from '../db'
import { dispatchSyncDataUpdated } from '../sync/constants'
import { registerDomainEventProjection } from './projections'

export const TIMELINE_PROJECTION_VERSION = 1

const subjectKey = (ref: EntityRef) => `${ref.type}:${ref.id}`

const routeFor = (event: DomainEvent) => {
  if (event.subject.type === 'project') return `/projects/${event.subject.id}`
  if (event.subject.type === 'task') return '/tasks'
  if (event.subject.type === 'note') return '/note'
  if (event.subject.type === 'diaryEntry') return '/diary'
  if (event.subject.type === 'focusSession') return '/focus'
  return undefined
}

const createTimelineItem = (
  event: DomainEvent,
  input: {
    kind: TimelineKind
    title: string
    summary?: string
    visibility?: TimelineVisibility
    icon?: string
    accent?: string
    route?: string
  },
): TimelineItem => {
  const now = Date.now()
  return {
    id: `tl_${event.id}`,
    eventId: event.id,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    occurredAt: event.occurredAt,
    subject: event.subject,
    subjectKey: subjectKey(event.subject),
    related: event.related,
    domain: event.subject.domain,
    entityType: event.subject.type,
    entityId: event.subject.id,
    visibility: input.visibility ?? 'default',
    pinned: false,
    route: input.route ?? routeFor(event),
    icon: input.icon,
    accent: input.accent,
    source: {
      eventType: event.type,
      eventSchemaVersion: event.schemaVersion,
      projectionVersion: TIMELINE_PROJECTION_VERSION,
    },
    createdAt: now,
    updatedAt: now,
  }
}

const mapEventToTimelineItem = (event: DomainEvent): TimelineItem | null => {
  switch (event.type) {
    case 'task.created':
      {
        const payload = event.payload as DomainEventPayloadMap['task.created']
      return createTimelineItem(event, {
        kind: 'task',
        title: 'Created task',
        summary: payload.title,
        icon: 'list-todo',
        accent: '#6B8C7A',
      })
      }
    case 'task.completed':
      {
        const payload = event.payload as DomainEventPayloadMap['task.completed']
      return createTimelineItem(event, {
        kind: 'task',
        title: 'Completed task',
        summary: payload.title,
        icon: 'check-circle',
        accent: '#6B8C7A',
      })
      }
    case 'focus.started':
      {
        const payload = event.payload as DomainEventPayloadMap['focus.started']
      return createTimelineItem(event, {
        kind: 'focus',
        title: 'Started focus session',
        summary: `${payload.plannedMinutes} min${payload.goal ? ` · ${payload.goal}` : ''}`,
        visibility: 'quiet',
        icon: 'timer',
        accent: '#7C8E9A',
      })
      }
    case 'focus.completed':
      {
        const payload = event.payload as DomainEventPayloadMap['focus.completed']
      return createTimelineItem(event, {
        kind: 'focus',
        title: 'Completed focus session',
        summary: `${payload.actualMinutes} min${payload.goal ? ` · ${payload.goal}` : ''}`,
        icon: 'timer',
        accent: '#7C8E9A',
      })
      }
    case 'note.created':
      {
        const payload = event.payload as DomainEventPayloadMap['note.created']
      return createTimelineItem(event, {
        kind: 'note',
        title: 'Created note',
        summary: [payload.title || 'Untitled', payload.collection, ...payload.tagNames].filter(Boolean).join(' · '),
        icon: 'notebook',
        accent: '#9B7E55',
      })
      }
    case 'note.updated': {
      const payload = event.payload as DomainEventPayloadMap['note.updated']
      const significant = payload.changedFields.some((field) => field === 'title' || field === 'tags' || field === 'collection')
      return createTimelineItem(event, {
        kind: 'note',
        title: 'Updated note',
        summary: payload.title || payload.changedFields.join(', '),
        visibility: significant ? 'default' : 'quiet',
        icon: 'notebook',
        accent: '#9B7E55',
      })
    }
    case 'project.created':
      {
        const payload = event.payload as DomainEventPayloadMap['project.created']
      return createTimelineItem(event, {
        kind: 'project',
        title: 'Created project',
        summary: payload.title,
        icon: 'panels',
        accent: '#8D7A9A',
      })
      }
    case 'project.archived':
      {
        const payload = event.payload as DomainEventPayloadMap['project.archived']
      return createTimelineItem(event, {
        kind: 'project',
        title: 'Archived project',
        summary: payload.title,
        icon: 'archive',
        accent: '#8D7A9A',
      })
      }
    case 'diary.created':
      {
        const payload = event.payload as DomainEventPayloadMap['diary.created']
      return createTimelineItem(event, {
        kind: 'diary',
        title: 'Created diary entry',
        summary: [payload.dateKey, ...payload.tagNames].filter(Boolean).join(' · '),
        icon: 'notebook-pen',
        accent: '#B48362',
      })
      }
    case 'podcast.saved':
      {
        const payload = event.payload as DomainEventPayloadMap['podcast.saved']
      return createTimelineItem(event, {
        kind: 'podcast',
        title: 'Saved podcast',
        summary: `${payload.name}${payload.author ? ` · ${payload.author}` : ''}`,
        icon: 'headphones',
        accent: '#7E8F72',
        route: '/',
      })
      }
    case 'news.saved':
      {
        const payload = event.payload as DomainEventPayloadMap['news.saved']
      return createTimelineItem(event, {
        kind: 'news',
        title: 'Saved news',
        summary: payload.title,
        icon: 'newspaper',
        accent: '#7F8795',
        route: '/',
      })
      }
    case 'payment.success':
      {
        const payload = event.payload as DomainEventPayloadMap['payment.success']
      return createTimelineItem(event, {
        kind: 'payment',
        title: 'Payment succeeded',
        summary: `${payload.entitlement} · ${payload.amount} ${payload.currency}`,
        icon: 'credit-card',
        accent: '#877159',
        route: '/membership',
      })
      }
    case 'sync.finished':
      {
        const payload = event.payload as DomainEventPayloadMap['sync.finished']
      return createTimelineItem(event, {
        kind: 'sync',
        title: 'Sync finished',
        summary: `${payload.pushedCount ?? 0} pushed · ${payload.pulledCount ?? 0} pulled`,
        visibility: 'hidden',
        icon: 'refresh',
        accent: '#77736E',
      })
      }
    default:
      return null
  }
}

export const projectTimelineEvent = async (event: DomainEvent) => {
  const item = mapEventToTimelineItem(event)
  if (!item) return
  const existing = await db.timelineItems.get(item.id)
  await db.timelineItems.put({
    ...item,
    pinned: existing?.pinned ?? item.pinned,
    visibility: existing?.visibility ?? item.visibility,
    createdAt: existing?.createdAt ?? item.createdAt,
    updatedAt: Date.now(),
  })
  dispatchSyncDataUpdated('timelineItems')
}

registerDomainEventProjection({
  name: 'timeline-items',
  project: projectTimelineEvent,
})
