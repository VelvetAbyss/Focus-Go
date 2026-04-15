import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ensureSyncTables, getRxdbPullState, pushRxdbRows, upsertSyncBlob } from './store.js'

const createDb = () => {
  const db = new Database(':memory:')
  ensureSyncTables(db)
  return db
}

test('pushRxdbRows stores a newer record and reports older writes as conflicts', () => {
  const db = createDb()

  let result = pushRxdbRows(db, 'user-1', 'tasks', [{
    newDocumentState: { id: 'task-1', title: 'First', updatedAt: 10, _deleted: false },
    assumedMasterState: null,
  }])
  assert.equal(result.conflicts.length, 0)

  result = pushRxdbRows(db, 'user-1', 'tasks', [{
    newDocumentState: { id: 'task-1', title: 'Older', updatedAt: 9, _deleted: false },
    assumedMasterState: null,
  }])
  assert.equal(result.conflicts.length, 1)
  assert.equal(result.conflicts[0].title, 'First')
})

test('pushRxdbRows writes tombstones for deletes', () => {
  const db = createDb()

  pushRxdbRows(db, 'user-1', 'notes', [{
    newDocumentState: { id: 'note-1', updatedAt: 20, _deleted: true },
    assumedMasterState: null,
  }])

  const state = getRxdbPullState(db, 'user-1', 'notes', null, 10)
  assert.equal(state.documents[0]._deleted, true)
})

test('getRxdbPullState returns rows after checkpoint in stable order', () => {
  const db = createDb()

  pushRxdbRows(db, 'user-1', 'habits', [
    { newDocumentState: { id: 'habit-1', title: 'A', updatedAt: 10, _deleted: false }, assumedMasterState: null },
    { newDocumentState: { id: 'habit-2', title: 'B', updatedAt: 30, _deleted: false }, assumedMasterState: null },
  ])

  const changes = getRxdbPullState(db, 'user-1', 'habits', { updatedAt: 15, id: 'habit-1' }, 10)
  assert.equal(changes.documents.length, 1)
  assert.equal(changes.documents[0].id, 'habit-2')
})

test('getRxdbPullState returns blobs referenced by pulled documents', () => {
  const db = createDb()
  upsertSyncBlob(db, {
    hash: 'blob-1',
    contentType: 'text/plain',
    compression: 'gzip',
    rawByteLength: 5,
    byteLength: 5,
    dataBase64: 'eA==',
  })

  pushRxdbRows(db, 'user-1', 'notes', [{
    newDocumentState: { id: 'note-1', title: 'A', bodyRefs: { contentMd: 'blob-1' }, updatedAt: 10, _deleted: false },
    assumedMasterState: null,
  }])

  const result = getRxdbPullState(db, 'user-1', 'notes', null, 10)
  assert.equal(result.blobs.length, 1)
  assert.equal(result.blobs[0].hash, 'blob-1')
})
