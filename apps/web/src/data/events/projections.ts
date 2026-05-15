import type { DomainEvent } from '../models/types'

export type DomainEventProjection = {
  name: string
  project(event: DomainEvent): Promise<void> | void
}

const projections: DomainEventProjection[] = []

export const registerDomainEventProjection = (projection: DomainEventProjection) => {
  if (projections.some((item) => item.name === projection.name)) return
  projections.push(projection)
}

export const runDomainEventProjections = async (event: DomainEvent) => {
  for (const projection of projections) {
    try {
      await projection.project(event)
    } catch (error) {
      console.error(`[domain-events] projection "${projection.name}" failed`, error)
    }
  }
}

export const rebuildProjections = async (events: DomainEvent[]) => {
  const ordered = [...events].sort((left, right) => left.occurredAt - right.occurredAt || left.createdAt - right.createdAt || left.id.localeCompare(right.id))
  for (const event of ordered) {
    await runDomainEventProjections(event)
  }
}
