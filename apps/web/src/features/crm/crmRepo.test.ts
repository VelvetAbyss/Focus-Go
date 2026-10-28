// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import '../../data/events/timelineProjection'
import { crmRepo, type CustomerInput } from './crmRepo'
import { exportCustomers, nextTasks, parseCsv, totalsByCurrency } from './crmModel'
import { installFeature, removeFeature, restoreFeature } from '../labs/labsApi'
import { SYNC_DATA_UPDATED_EVENT, SYNC_ENTITY_TABLES } from '../../data/sync/constants'
import type { CrmDeal } from '../../data/models/crm'

const customer = (patch: Partial<CustomerInput> = {}): CustomerInput => ({ mode: 'b2b', name: 'Acme', email: '', phone: '', source: '', industry: '', needs: '', owner: '', tags: [], contacts: [], doNotContact: false, ...patch })
beforeEach(async () => { await db.delete({ disableAutoOpen: false }); await db.open() })
afterEach(async () => { vi.restoreAllMocks(); await db.delete({ disableAutoOpen: false }) })

describe('CRM working data', () => {
  it('creates once, normalizes duplicates, and keeps B2B and B2C independent', async () => {
    await crmRepo.saveCustomer(customer({ email: ' Sales@Acme.com ' }))
    await expect(crmRepo.saveCustomer(customer({ name: 'ACME' }))).rejects.toMatchObject({ code: 'duplicate' })
    await expect(crmRepo.saveCustomer(customer({ name: 'Another', email: 'sales@acme.com' }))).rejects.toMatchObject({ code: 'duplicate' })
    await crmRepo.saveCustomer(customer({ mode: 'b2c', name: 'Acme' }))
    expect(await db.crmCustomers.count()).toBe(2)
  })
  it('preserves a newer archive and protected identity when an old editor saves', async () => {
    const c = await crmRepo.saveCustomer(customer())
    await crmRepo.archive([c.id], true)
    const saved = await crmRepo.saveCustomer({ ...c, name: 'Acme updated' }, c.id)
    expect(saved.archivedAt).toBeTypeOf('number')
    expect(saved.id).toBe(c.id)
    await expect(crmRepo.saveCustomer(customer({ contacts: [{ id: 'c', name: '', role: '', phone: '123', email: '' }] }))).rejects.toMatchObject({ code: 'contactNameRequired' })
  })
  it('creates a single shared task, timeline event and durable outbox with idempotent activity saves', async () => {
    const c = await crmRepo.saveCustomer(customer())
    const input = { customerId: c.id, kind: 'call' as const, body: 'Interested in an annual agreement', nextAction: 'Send quote', dueDate: '2027-01-12', requestId: 'request-1' }
    const a = await crmRepo.logActivity(input)
    await crmRepo.logActivity(input)
    const tasks = await db.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: a.taskId, dueDate: '2027-01-12', status: 'todo' })
    expect(await db.crmActivities.count()).toBe(1)
    expect(await db.domainEvents.count()).toBe(1)
    await vi.waitFor(async () => expect(await db.timelineItems.count()).toBe(1))
    const changes = await db.pendingSyncChanges.toArray()
    expect(changes.map(c => c.entityType)).toEqual(expect.arrayContaining(['crmCustomers', 'crmActivities', 'tasks']))
    expect(nextTasks(c.id, [a], tasks)).toHaveLength(1)
    await crmRepo.completeTask(tasks[0].id)
    expect(nextTasks(c.id, [a], await db.tasks.toArray())).toHaveLength(0)
  })
  it('rolls back the task and event when its CRM activity fails to save', async () => {
    const c = await crmRepo.saveCustomer(customer())
    const before = await db.pendingSyncChanges.count()
    const notified = vi.fn()
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, notified)
    vi.spyOn(db.crmActivities, 'add').mockRejectedValueOnce(new Error('disk full'))
    try {
      await expect(crmRepo.logActivity({ customerId: c.id, kind: 'call', body: 'Hello', nextAction: 'Call again', dueDate: '2027-01-12', requestId: 'failure' })).rejects.toThrow('disk full')
      expect(notified).not.toHaveBeenCalled()
    } finally { window.removeEventListener(SYNC_DATA_UPDATED_EVENT, notified) }
    expect(await db.tasks.count()).toBe(0)
    expect(await db.domainEvents.count()).toBe(0)
    expect(await db.timelineItems.count()).toBe(0)
    expect(await db.pendingSyncChanges.count()).toBe(before)
  })
  it('rejects invalid dates, loss without reason, and new outreach to opted-out customers', async () => {
    const c = await crmRepo.saveCustomer(customer({ doNotContact: true }))
    const input = { customerId: c.id, kind: 'note' as const, body: 'Note', nextAction: 'Call', dueDate: '2026-02-31', requestId: 'date' }
    await expect(crmRepo.logActivity(input)).rejects.toMatchObject({ code: 'invalidDate' })
    await expect(crmRepo.logActivity({ ...input, dueDate: '2027-01-12' })).rejects.toMatchObject({ code: 'doNotContact' })
    await crmRepo.logActivity({ ...input, dueDate: undefined, nextAction: '' })
    await expect(crmRepo.saveDeal({ customerId: c.id, title: 'New deal', amount: 10, currency: 'USD', stage: 'lost', lossReason: '', expectedCloseDate: '' })).rejects.toMatchObject({ code: 'lossReasonRequired' })
  })
  it('links notes idempotently and uninstall/restore retains working records', async () => {
    const c = await crmRepo.saveCustomer(customer())
    const note = await crmRepo.createNote(c.id, 'Call notes', 'note-1')
    expect((await crmRepo.createNote(c.id, 'Call notes', 'note-1')).id).toBe(note.id)
    expect(await db.notes.count()).toBe(1)
    expect(await db.crmActivities.count()).toBe(1)
    await installFeature('crm'); await removeFeature('crm'); await restoreFeature('crm')
    expect(await db.crmCustomers.count()).toBe(1)
    expect(await db.notes.count()).toBe(1)
    expect(SYNC_ENTITY_TABLES.crmCustomers).toBe('crm_customers')
  })
})

describe('CRM data portability and amounts', () => {
  it('imports quoted text atomically, skips duplicates and preserves contact preferences', async () => {
    const result = await crmRepo.importCustomers('mode,name,email,needs,doNotContact\r\nb2c,"Doe, Jane",jane@example.test,"Line 1\nLine 2", TRUE \r\nb2c,"Doe, Jane",jane@example.test,,false')
    expect(result).toEqual({ added: 1, skipped: 1 })
    expect((await db.crmCustomers.toArray())[0]).toMatchObject({ name: 'Doe, Jane', needs: 'Line 1\nLine 2', doNotContact: true })
    await expect(crmRepo.importCustomers('mode,name,doNotContact\nb2b,Valid,false\nb2c,Invalid,perhaps')).rejects.toMatchObject({ code: 'csvRow:3' })
    expect(await db.crmCustomers.count()).toBe(1)
  })
  it('exports formula-like cells safely and round-trips them', async () => {
    const c = await crmRepo.saveCustomer(customer({ name: '=SUM(A1)', phone: '+86 123', needs: 'Quoted "text"\nnext' }))
    const csv = exportCustomers([c])
    expect(csv).toContain("'=SUM(A1)")
    expect(parseCsv(csv)[1][6]).toBe('Quoted "text"\nnext')
    const result = await crmRepo.importCustomers(csv)
    expect(result).toEqual({ added: 0, skipped: 1 })
  })
  it('never adds different currencies together', () => {
    expect(totalsByCurrency([{ amount: 20, currency: 'USD' }, { amount: 30, currency: 'CNY' }, { amount: 5, currency: 'USD' }] as CrmDeal[])).toEqual({ USD: 25, CNY: 30 })
  })
})

it('rejects malformed CSV quoting without saving partial customer rows', async () => {
  await expect(crmRepo.importCustomers('mode,name\nb2b,Valid\nb2b,"Invalid"suffix')).rejects.toMatchObject({ code: 'invalidCsv' })
  expect(await db.crmCustomers.count()).toBe(0)
})
