import { db } from '../db'
import type { ProjectPerson } from '../models/types'
import { touch, withBase } from './base'

export type ProjectPersonCreateInput = {
  projectId: string
  name: string
  roleType: ProjectPerson['roleType']
  phone?: string
  email?: string
  note?: string
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
    return next
  },
  async remove(id: string) {
    await db.projectPeople.delete(id)
  },
}
