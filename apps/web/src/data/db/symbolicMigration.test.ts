import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, expect, it } from 'vitest'
import { db } from './index'
import { DB_NAME, DB_VERSION, TABLES, schemaV47 } from './schema'

afterAll(() => db.close())
it('upgrades V47 to V48 without losing trash or the durable sync queue', async () => {
  await db.delete({ disableAutoOpen: false })
  const previous = new Dexie(DB_NAME)
  previous.version(47).stores(schemaV47)
  await previous.open()
  const trash = { id:'deleted-task', deletedAt:100, task:{ title:'Recoverable task' } }
  const queued = { id:1, entityType:'tasks', entityId:'task-1', op:'upsert', payload:{ title:'Pending task' } }
  await previous.table(TABLES.taskTrash).put(trash)
  await previous.table(TABLES.pendingSyncChanges).put(queued)
  previous.close()
  await db.open()
  expect(db.verno).toBe(DB_VERSION)
  expect(await db.taskTrash.get(trash.id)).toEqual(trash)
  expect(await db.pendingSyncChanges.get(1)).toEqual(queued)
  await db.localSymbolic.put({ownerId:'guest',id:'selection',kind:'settings',schemaVersion:1,updatedAt:1,payload:{profileId:null}})
  expect(await db.localSymbolic.count()).toBe(1)
})
