import { db } from '../db'
import type { LifePerson } from '../models/types'
import type { ProjectPerson } from '../models/types'
import { enqueueSyncOperation } from '../sync/repository'
import { touch, withBase } from './base'

export type ProjectPersonCreateInput = {
  projectId: string
  name: string
  roleType: ProjectPerson['roleType']
  phone?: string
  email?: string
  note?: string
}

const deriveInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

const roleTypeToGroup = (roleType: ProjectPerson['roleType']): LifePerson['group'] =>
  roleType === 'external' ? 'Community' : 'Work'

const roleTypeLabel = (roleType: ProjectPerson['roleType']) =>
  roleType.charAt(0).toUpperCase() + roleType.slice(1)

const syncProjectPersonToLife = async (person: ProjectPerson) => {
  const project = await db.projects.get(person.projectId)
  const existing = await db.lifePeople.where('sourceProjectPersonId').equals(person.id).first()
  const payload = {
    name: person.name,
    group: roleTypeToGroup(person.roleType),
    category: project?.title ?? 'Project',
    role: roleTypeLabel(person.roleType),
    notes: person.note?.trim() || undefined,
    email: person.email?.trim() || undefined,
    phone: person.phone?.trim() || undefined,
    avatarInitials: deriveInitials(person.name) || 'NA',
    sourceProjectId: person.projectId,
    sourceProjectPersonId: person.id,
  } satisfies Omit<LifePerson, 'id' | 'createdAt' | 'updatedAt'>
  if (existing) {
    const next = touch({ ...existing, ...payload })
    await db.lifePeople.put(next)
    await enqueueSyncOperation('lifePeople', 'upsert', next)
    return next
  }
  const created = withBase(payload)
  await db.lifePeople.put(created)
  await enqueueSyncOperation('lifePeople', 'upsert', created)
  return created
}

export const projectPeopleRepo = {
  async listByProject(projectId: string) {
    return db.projectPeople.where('projectId').equals(projectId).sortBy('createdAt')
  },
  async create(data: ProjectPersonCreateInput) {
    const person = withBase({
      projectId: data.projectId,
      name: data.name.trim(),
      roleType: data.roleType,
      phone: data.phone?.trim() ?? '',
      email: data.email?.trim() ?? '',
      note: data.note?.trim() ?? '',
    } satisfies Omit<ProjectPerson, 'id' | 'createdAt' | 'updatedAt'>)
    await db.projectPeople.add(person)
    await enqueueSyncOperation('projectPeople', 'upsert', person)
    await syncProjectPersonToLife(person)
    return person
  },
  async update(id: string, patch: Partial<Omit<ProjectPerson, 'id' | 'createdAt' | 'updatedAt' | 'projectId'>>) {
    const current = await db.projectPeople.get(id)
    if (!current) return null
    const next = touch({
      ...current,
      ...patch,
      name: typeof patch.name === 'string' ? patch.name.trim() : current.name,
      phone: typeof patch.phone === 'string' ? patch.phone.trim() : current.phone,
      email: typeof patch.email === 'string' ? patch.email.trim() : current.email,
      note: typeof patch.note === 'string' ? patch.note.trim() : current.note,
    })
    await db.projectPeople.put(next)
    await enqueueSyncOperation('projectPeople', 'upsert', next)
    await syncProjectPersonToLife(next)
    return next
  },
  async remove(id: string) {
    const current = await db.projectPeople.get(id)
    await db.projectPeople.delete(id)
    if (current) {
      await enqueueSyncOperation('projectPeople', 'delete', { id: current.id, updatedAt: Date.now(), projectId: current.projectId }, Date.now())
    }
    const linked = await db.lifePeople.where('sourceProjectPersonId').equals(id).first()
    if (linked) {
      const deletedAt = Date.now()
      await db.lifePeople.delete(linked.id)
      await enqueueSyncOperation('lifePeople', 'delete', { id: linked.id, updatedAt: deletedAt, sourceProjectPersonId: id }, deletedAt)
    }
  },
}
