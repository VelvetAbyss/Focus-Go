import type { DomainEvent, DomainEventPayloadMap, DomainEventType, EntityRef, EventSource } from '../models/types'
import { createId } from '../../shared/utils/ids'
import { domainEventsRepo } from './domainEventsRepo'

export type PublishDomainEventInput<TType extends DomainEventType = DomainEventType> = {
  type: TType
  occurredAt?: number
  actorId?: string | null
  workspaceId?: string | null
  source?: EventSource
  subject: EntityRef
  related?: EntityRef[]
  payload: DomainEventPayloadMap[TType]
  dedupeKey: string
}

export const toSubjectKey = (subject: EntityRef) => `${subject.type}:${subject.id}`

export const publishDomainEvent = async <TType extends DomainEventType>(
  input: PublishDomainEventInput<TType>,
): Promise<DomainEvent<TType>> => {
  const timestamp = Date.now()
  const event: DomainEvent<TType> = {
    id: createId(),
    type: input.type,
    actorId: input.actorId ?? null,
    workspaceId: input.workspaceId ?? null,
    occurredAt: input.occurredAt ?? timestamp,
    source: input.source ?? { kind: 'user' },
    subject: input.subject,
    subjectKey: toSubjectKey(input.subject),
    related: input.related ?? [],
    payload: input.payload,
    schemaVersion: 1,
    dedupeKey: input.dedupeKey,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return domainEventsRepo.append(event) as Promise<DomainEvent<TType>>
}
