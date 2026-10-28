import { db } from '../../data/db'
import type { CrmActivity, CrmCustomer, CrmDeal } from '../../data/models/crm'
import { createTask } from '../tasks/application/taskActions'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { notesRepo } from '../../data/repositories/notesRepo'
import { emitTasksChanged } from '../tasks/taskSync'
import { CURRENCIES, CSV_HEADERS, customerRoute, duplicateCustomer, parseCsv, STAGES } from './crmModel'

export type CustomerInput = Omit<CrmCustomer, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>
export type DealInput = Omit<CrmDeal, 'id' | 'createdAt' | 'updatedAt' | 'closedAt'>
export class CrmError extends Error {
  code: string
  existingId?: string
  constructor(code: string, existingId?: string) { super(code); this.code = code; this.existingId = existingId }
}
const base = () => ({ id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() })
const text = (value: string, max = 500) => value.trim().slice(0, max)
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const validateCustomer = (input: CustomerInput): CustomerInput => {
  if (!input.name.trim()) throw new CrmError('nameRequired')
  if (!['b2b', 'b2c'].includes(input.mode)) throw new CrmError('invalidData')
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new CrmError('invalidEmail')
  if (input.contacts.some(c => !c.name.trim() && [c.role, c.email, c.phone].some(v => v.trim()))) throw new CrmError('contactNameRequired')
  if (input.contacts.some(c => c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()))) throw new CrmError('invalidEmail')
  return { mode: input.mode, doNotContact: input.doNotContact === true, name: text(input.name, 160), email: text(input.email).toLowerCase(), phone: text(input.phone, 80), source: text(input.source), industry: text(input.industry), needs: text(input.needs, 10000), owner: text(input.owner), tags: [...new Set(input.tags.map(t => text(t, 50)).filter(Boolean))].slice(0, 20), contacts: input.contacts.map(c => ({ id: c.id, name: text(c.name, 160), role: text(c.role), email: text(c.email), phone: text(c.phone, 80) })).filter(c => c.name) }
}
export const crmRepo = {
  async saveCustomer(input: CustomerInput, id?: string) {
    const clean = validateCustomer(input)
    return db.transaction('rw', db.crmCustomers, async () => {
      const previous = id ? await db.crmCustomers.get(id) : undefined
      if (id && !previous) throw new CrmError('notFound')
      const duplicate = duplicateCustomer(clean, (await db.crmCustomers.toArray()).filter(c => c.id !== id))
      if (duplicate) throw new CrmError('duplicate', duplicate.id)
      const row: CrmCustomer = { ...(previous ?? { ...base(), archivedAt: null }), ...clean, updatedAt: Date.now() }
      await db.crmCustomers.put(row)
      return row
    })
  },
  async archive(ids: string[], archived: boolean) {
    await db.transaction('rw', db.crmCustomers, async () => {
      for (const id of ids) await db.crmCustomers.update(id, { archivedAt: archived ? Date.now() : null, updatedAt: Date.now() })
    })
  },
  async saveDeal(input: DealInput, id?: string) {
    if (!input.title.trim() || !Number.isFinite(input.amount) || input.amount < 0 || !CURRENCIES.includes(input.currency) || !STAGES.includes(input.stage)) throw new CrmError('invalidDeal')
    if (input.expectedCloseDate && !validDay(input.expectedCloseDate)) throw new CrmError('invalidDate')
    if (input.stage === 'lost' && !input.lossReason.trim()) throw new CrmError('lossReasonRequired')
    return db.transaction('rw', db.crmCustomers, db.crmDeals, db.crmActivities, async () => {
      const customer = await db.crmCustomers.get(input.customerId)
      if (!customer || customer.archivedAt) throw new CrmError('notFound')
      const previous = id ? await db.crmDeals.get(id) : undefined
      if (id && (!previous || previous.customerId !== input.customerId)) throw new CrmError('notFound')
      const closed = ['won', 'lost'].includes(input.stage)
      const row: CrmDeal = { ...(previous ?? base()), customerId: input.customerId, stage: input.stage, amount: input.amount, currency: input.currency, expectedCloseDate: input.expectedCloseDate, title: text(input.title, 200), lossReason: input.stage === 'lost' ? text(input.lossReason, 2000) : '', closedAt: closed ? (previous?.closedAt ?? Date.now()) : null, updatedAt: Date.now() }
      await db.crmDeals.put(row)
      if (previous && previous.stage !== row.stage) await db.crmActivities.add({ ...base(), customerId: row.customerId, dealId: row.id, kind: 'stage', body: `${previous.stage}:${row.stage}`, occurredAt: Date.now() })
      return row
    })
  },
  async logActivity(input: { customerId: string; kind: CrmActivity['kind']; body: string; nextAction?: string; dueDate?: string; reminderAt?: number; requestId: string }) {
    if (!input.body.trim() && !input.nextAction?.trim()) throw new CrmError('activityRequired')
    if (input.nextAction?.trim() && !input.dueDate) throw new CrmError('dateRequired')
    if (input.dueDate && !validDay(input.dueDate)) throw new CrmError('invalidDate')
    if (input.reminderAt !== undefined && (!Number.isFinite(input.reminderAt) || input.reminderAt <= Date.now())) throw new CrmError('futureReminder')
    const result = await db.transaction('rw', [db.crmCustomers, db.crmActivities, db.tasks, db.domainEvents, db.timelineItems, db.pendingSyncChanges], async () => {
      const previous = await db.crmActivities.get(input.requestId)
      if (previous) { if (previous.customerId !== input.customerId) throw new CrmError('invalidData'); return previous }
      const customer = await db.crmCustomers.get(input.customerId)
      if (!customer || customer.archivedAt) throw new CrmError('notFound')
      if (customer.doNotContact && input.nextAction?.trim()) throw new CrmError('doNotContact')
      const task = input.nextAction?.trim() ? await createTask({ title: `${customer.name} · ${text(input.nextAction, 200)}`, description: text(input.body, 10000), dueDate: input.dueDate, reminderAt: input.reminderAt, tags: ['CRM'] }) : undefined
      const row: CrmActivity = { ...base(), id: input.requestId, customerId: customer.id, kind: input.body.trim() ? input.kind : 'followup', body: text(input.body, 10000) || text(input.nextAction ?? ''), occurredAt: Date.now(), ...(task ? { taskId: task.id } : {}) }
      await db.crmActivities.add(row)
      return row
    })
    emitTasksChanged('crm:followup')
    return result
  },
  async completeTask(id: string) {
    await tasksRepo.updateStatus(id, 'done')
    emitTasksChanged('crm:complete-followup')
  },
  async createNote(customerId: string, title: string, requestId: string) {
    // The stable note id makes a retry safe even when the link save was interrupted.
    const customer = await db.crmCustomers.get(customerId)
    if (!customer || customer.archivedAt) throw new CrmError('notFound')
    const id = `crm-note:${customerId}:${requestId}`
    let note = await db.notes.get(id)
    if (!note) note = await notesRepo.create({ id, title, contentMd: `[${customer.name.replace(/[[\]]/g, '')}](${customerRoute(customer)})\n\n`, collection: 'work', tags: ['CRM'] })
    const activityId = `crm-link:${customerId}:${requestId}`
    if (!await db.crmActivities.get(activityId)) await db.crmActivities.put({ ...base(), id: activityId, customerId, kind: 'note', body: title, noteId: note.id, occurredAt: Date.now() })
    return note
  },
  async importCustomers(source: string) {
    if (source.length > 2_000_000) throw new CrmError('importTooLarge')
    let rows: string[][]
    try { rows = parseCsv(source) } catch { throw new CrmError('invalidCsv') }
    const headers = rows.shift()?.map(s => s.trim()) ?? []
    if (!headers.includes('name') || !headers.includes('mode') || headers.some(h => !CSV_HEADERS.includes(h)) || new Set(headers).size !== headers.length) throw new CrmError('csvHeaders')
    if (rows.length > 5000) throw new CrmError('importTooLarge')
    const inputs = rows.map((row, i) => {
      if (row.length !== headers.length) throw new CrmError(`csvRow:${i + 2}`)
      const data = Object.fromEntries(headers.map((h, index) => [h, row[index].replace(/^'(?=[\s]*[=+\-@\t\r])/, '')]))
      const consent = (data.doNotContact ?? '').trim().toLowerCase()
      if (!['', 'true', 'false', '1', '0'].includes(consent)) throw new CrmError(`csvRow:${i + 2}`)
      try { return validateCustomer({ mode: data.mode as CrmCustomer['mode'], name: data.name, email: data.email ?? '', phone: data.phone ?? '', source: data.source ?? '', industry: data.industry ?? '', needs: data.needs ?? '', owner: data.owner ?? '', tags: (data.tags ?? '').split(';').filter(Boolean), contacts: [], doNotContact: consent === 'true' || consent === '1' }) } catch { throw new CrmError(`csvRow:${i + 2}`) }
    })
    return db.transaction('rw', db.crmCustomers, async () => {
      const existing = await db.crmCustomers.toArray(); let added = 0; let skipped = 0
      for (const input of inputs) {
        if (duplicateCustomer(input, existing)) { skipped++; continue }
        const row = { ...base(), ...input, archivedAt: null }
        await db.crmCustomers.add(row); existing.push(row); added++
      }
      return { added, skipped }
    })
  },
}
