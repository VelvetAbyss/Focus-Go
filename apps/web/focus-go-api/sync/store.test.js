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

test('server sequence delivers an edit even when the second device clock is behind', () => {
  const db = createDb()
  const original = { id: 'note-1', title: 'Device A', updatedAt: 10_000, _deleted: false }
  assert.deepEqual(pushRxdbRows(db, 'user-1', 'notes', [
    { newDocumentState: original, assumedMasterState: null },
  ]).conflicts, [])
  const firstPull = getRxdbPullState(db, 'user-1', 'notes', null, 100)
  assert.equal(firstPull.documents.length, 1)
  assert.equal(typeof firstPull.checkpoint.sequence, 'number')

  const editFromSlowClock = { ...original, title: 'Device B', updatedAt: 100 }
  assert.deepEqual(pushRxdbRows(db, 'user-1', 'notes', [
    { newDocumentState: editFromSlowClock, assumedMasterState: original },
  ]).conflicts, [])
  const nextPull = getRxdbPullState(db, 'user-1', 'notes', firstPull.checkpoint, 100)
  assert.equal(nextPull.documents.length, 1)
  assert.equal(nextPull.documents[0].title, 'Device B')
  assert.ok(nextPull.checkpoint.sequence > firstPull.checkpoint.sequence)
  assert.equal(getRxdbPullState(db, 'user-2', 'notes', null, 100).documents.length, 0)
  db.close()
})

test('server sequence survives tombstone pruning and legacy table migration', () => {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE sync_notes (
    id TEXT NOT NULL, user_id TEXT NOT NULL, payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL, deleted_at INTEGER,
    PRIMARY KEY (user_id, id)
  )`)
  db.prepare('INSERT INTO sync_notes (id, user_id, payload, updated_at) VALUES (?, ?, ?, ?)')
    .run('legacy', 'user-1', JSON.stringify({ id: 'legacy', title: 'Earlier', updatedAt: 500 }), 500)
  ensureSyncTables(db)
  ensureSyncTables(db)
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  const first = getRxdbPullState(db, 'user-1', 'notes', null, 100)
  assert.equal(first.documents[0].title, 'Earlier')
  assert.ok(first.checkpoint.sequence > 0)
  pushRxdbRows(db, 'user-1', 'notes', [
    { newDocumentState: { id: 'legacy', updatedAt: 501, _deleted: true }, assumedMasterState: first.documents[0] },
  ])
  const deleted = getRxdbPullState(db, 'user-1', 'notes', first.checkpoint, 100)
  assert.equal(deleted.documents[0]._deleted, true)
  db.prepare('DELETE FROM sync_notes WHERE id = ?').run('legacy')
  pushRxdbRows(db, 'user-1', 'notes', [
    { newDocumentState: { id: 'replacement', title: 'Later', updatedAt: 1, _deleted: false }, assumedMasterState: null },
  ])
  const next = getRxdbPullState(db, 'user-1', 'notes', deleted.checkpoint, 100)
  assert.equal(next.documents[0].id, 'replacement')
  assert.ok(next.checkpoint.sequence > deleted.checkpoint.sequence)
  // A client carrying the old timestamp/id cursor can still pull from the
  // migrated API while new clients use the monotonic sequence cursor.
  const legacyClient = getRxdbPullState(db, 'user-1', 'notes', { updatedAt: 0, id: '' }, 100)
  assert.equal(legacyClient.documents[0].id, 'replacement')
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
  db.close()
})

test('ensureSyncTables creates sync_domain_events', () => {
  const db = createDb()

  const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_domain_events'").get()
  assert.equal(table.name, 'sync_domain_events')
})

test('pushRxdbRows and getRxdbPullState support domainEvents', () => {
  const db = createDb()

  const result = pushRxdbRows(db, 'user-1', 'domainEvents', [{
    newDocumentState: {
      id: 'event-1',
      type: 'task.completed',
      occurredAt: 20,
      dedupeKey: 'task.completed:task-1:20',
      subject: { domain: 'productivity', type: 'task', id: 'task-1' },
      subjectKey: 'task:task-1',
      related: [],
      payload: { title: 'Task', previousStatus: 'doing', completedAt: 20 },
      schemaVersion: 1,
      updatedAt: 20,
      createdAt: 20,
      _deleted: false,
    },
    assumedMasterState: null,
  }])
  assert.equal(result.conflicts.length, 0)

  const state = getRxdbPullState(db, 'user-1', 'domainEvents', null, 10)
  assert.equal(state.documents.length, 1)
  assert.equal(state.documents[0].dedupeKey, 'task.completed:task-1:20')
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
