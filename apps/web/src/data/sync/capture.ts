import Dexie, { type DBCoreTransaction } from 'dexie'
import { TABLES } from '../db/schema'
import { LOCAL_ACCOUNT_OWNER_KEY } from '../../config/accountOwnership'
import { SYNC_ENTITY_TABLES } from './constants'
import type { SyncEntityType } from './types'

export const SYNC_LOCAL_COMMIT_EVENT = 'focusgo:sync-local-commit'
const suppressed = new WeakSet<object>()
const observed = new WeakSet<object>()
const changedEntities = new WeakMap<object, Set<SyncEntityType>>()

// Call inside the transaction applying a remote result or clearing account data.
// This is transaction-local, so concurrent user writes remain captured.
export const suppressSyncCapture = () => {
  const transaction = Dexie.currentTransaction
  if (!transaction) throw new Error('Sync capture suppression requires a transaction')
  suppressed.add(transaction.idbtrans)
}

const owner = () => typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY)
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const installSyncCapture = (database: Dexie) => {
  const entities = new Map(Object.entries(SYNC_ENTITY_TABLES).map(([entity, name]) => [name, entity as SyncEntityType]))
  database.use({
    stack: 'dbcore', name: 'durable-sync-capture', level: 5,
    create: (core) => ({
      ...core,
      transaction: (stores, mode, options) => core.transaction(
        mode === 'readwrite' && stores.some(name => entities.has(name)) && core.schema.tables.some(t => t.name === TABLES.pendingSyncChanges)
          ? [...new Set([...stores, TABLES.pendingSyncChanges])]
          : stores,
        mode, options,
      ),
      table: (name) => {
        const table = core.table(name)
        const entityType = entities.get(name)
        if (!entityType) return table
        return {
          ...table,
          mutate: async (request) => {
            if (suppressed.has(request.trans)) return table.mutate(request)
            const deleting = request.type === 'delete' || request.type === 'deleteRange'
            const before = request.type === 'deleteRange'
              ? (await table.query({ trans: request.trans, values: true, query: { index: table.schema.primaryKey, range: request.range } })).result
              : await table.getMany({ trans: request.trans, keys: request.type === 'delete' ? request.keys : request.values.map(value => value.id) })
            const result = await table.mutate(request)
            const values = deleting ? before : ('values' in request ? request.values : [])
            const timestamp = Date.now()
            const changes = values.flatMap((value, index) => {
              if (!value || result.failures[index] || (!deleting && same(before[index], value))) return []
              const payload = deleting ? {
                id: value.id,
                updatedAt: Math.max(timestamp, (value.updatedAt ?? 0) + 1),
                ...(typeof value.title === 'string' ? { title: value.title } : {}),
              } : value
              return [{ entityType, entityId: value.id, op: deleting ? 'delete' : 'upsert', payload,
                ...(deleting ? { deletedAt: payload.updatedAt } : {}), accountId: owner() }]
            })
            if (changes.length) {
              try {
                const logged = await core.table(TABLES.pendingSyncChanges).mutate({ type: 'add', trans: request.trans, values: changes })
                if (logged.numFailures) throw new Error('Could not persist sync outbox')
              } catch (error) {
                request.trans.abort()
                throw error
              }
              const changed = changedEntities.get(request.trans) ?? new Set<SyncEntityType>()
              changed.add(entityType)
              changedEntities.set(request.trans, changed)
              notifyOnCommit(request.trans)
            }
            return result
          },
        }
      },
    }),
  })
}

const notifyOnCommit = (transaction: DBCoreTransaction) => {
  if (observed.has(transaction)) return
  observed.add(transaction)
  // DBCore uses the underlying IDBTransaction. Avoid overriding Dexie's handlers.
  ;(transaction as IDBTransaction).addEventListener('complete', () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_LOCAL_COMMIT_EVENT, {
      detail: { entityTypes: [...(changedEntities.get(transaction) ?? [])] },
    }))
  })
}
