import type { LifePersonCreateInput, LifePersonUpdateInput } from '@focus-go/core'
import { db } from '../db'
import type { LifePerson, ProjectPerson } from '../models/types'
import { enqueueSyncOperationInBackground } from '../sync/repository'
import { dbService } from '../services/dbService'
import { touch } from './base'

let cache: Awaited<ReturnType<typeof dbService.lifePeople.list>> | null = null

const copy = <T,>(rows: T[]) => [...rows]
const deriveInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

const projectRoleToLifeGroup = (roleType: 'owner' | 'collaborator' | 'reviewer' | 'external') =>
  roleType === 'external' ? 'Community' : 'Work'

const projectRoleLabel = (roleType: 'owner' | 'collaborator' | 'reviewer' | 'external') =>
  roleType.charAt(0).toUpperCase() + roleType.slice(1)

const toProjectRoleType = (role?: string): ProjectPerson['roleType'] =>
  role?.toLowerCase() === 'owner'
    ? 'owner'
    : role?.toLowerCase() === 'external'
      ? 'external'
      : role?.toLowerCase() === 'reviewer'
        ? 'reviewer'
        : 'collaborator'

const syncProjectPeopleBackfill = async () => {
  const [projectPeople, projects, lifePeople] = await Promise.all([
    db.projectPeople.toArray(),
    db.projects.toArray(),
    db.lifePeople.toArray(),
  ])
  const projectTitleMap = new Map(projects.map((project) => [project.id, project.title] as const))
  const linkedMap = new Map<string, LifePerson>()
  const duplicateIds: string[] = []
  for (const item of lifePeople) {
    if (!item.sourceProjectPersonId) continue
    const current = linkedMap.get(item.sourceProjectPersonId)
    if (!current) {
      linkedMap.set(item.sourceProjectPersonId, item)
      continue
    }
    if (current.updatedAt >= item.updatedAt) duplicateIds.push(item.id)
    else {
      duplicateIds.push(current.id)
      linkedMap.set(item.sourceProjectPersonId, item)
    }
  }
  if (duplicateIds.length) {
    const deletedAt = Date.now()
    await db.lifePeople.bulkDelete(duplicateIds)
    duplicateIds.forEach((id) => enqueueSyncOperationInBackground('lifePeople', 'delete', { id, updatedAt: deletedAt }, deletedAt))
  }
  const writes = projectPeople.map((person) => {
    const current = linkedMap.get(person.id)
    const next = {
      name: person.name,
      group: projectRoleToLifeGroup(person.roleType),
      category: projectTitleMap.get(person.projectId) ?? 'Project',
      role: projectRoleLabel(person.roleType),
      notes: person.note?.trim() || undefined,
      email: person.email?.trim() || undefined,
      phone: person.phone?.trim() || undefined,
      avatarInitials: (current?.avatarInitials || deriveInitials(person.name) || 'NA').slice(0, 3),
      sourceProjectId: person.projectId,
      sourceProjectPersonId: person.id,
    } satisfies Omit<LifePerson, 'id' | 'createdAt' | 'updatedAt'>
    return current ? touch({ ...current, ...next }) : { ...next, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }
  })
  if (writes.length) {
    await db.lifePeople.bulkPut(writes)
    writes.forEach((row) => enqueueSyncOperationInBackground('lifePeople', 'upsert', row))
  }
}

export const peopleRepo = {
  async list() {
    await syncProjectPeopleBackfill()
    cache = null
    cache = await dbService.lifePeople.list()
    return copy(cache)
  },
  async create(data: LifePersonCreateInput) {
    const created = await dbService.lifePeople.create(data)
    cache = cache ? [created, ...cache.filter((item) => item.id !== created.id)] : null
    return created
  },
  async update(id: string, patch: LifePersonUpdateInput) {
    const updated = await dbService.lifePeople.update(id, patch)
    if (!updated) return updated
    if (updated.sourceProjectPersonId) {
      const current = await db.projectPeople.get(updated.sourceProjectPersonId)
      if (current) {
        const nextProjectPerson = touch({
          ...current,
          name: updated.name,
          roleType: toProjectRoleType(updated.role),
          phone: updated.phone ?? '',
          email: updated.email ?? '',
          note: updated.notes ?? '',
        })
        await db.projectPeople.put(nextProjectPerson)
        enqueueSyncOperationInBackground('projectPeople', 'upsert', nextProjectPerson)
      }
    }
    cache = cache ? [updated, ...cache.filter((item) => item.id !== id)] : null
    return updated
  },
  async remove(id: string) {
    const current = await db.lifePeople.get(id)
    if (current?.sourceProjectPersonId) {
      const deletedAt = Date.now()
      await db.projectPeople.delete(current.sourceProjectPersonId)
      enqueueSyncOperationInBackground(
        'projectPeople',
        'delete',
        { id: current.sourceProjectPersonId, updatedAt: deletedAt, projectId: current.sourceProjectId ?? '' },
        deletedAt,
      )
    }
    await dbService.lifePeople.remove(id)
    cache = cache?.filter((item) => item.id !== id) ?? null
  },
}
