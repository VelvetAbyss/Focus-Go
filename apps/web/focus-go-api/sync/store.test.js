import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { applySyncOperation, ensureSyncTables, getBootstrapState, getChangesSince } from './store.js'

const createDb = () => {
  const db = new Database(':memory:')
  ensureSyncTables(db)
  return db
}

test('applySyncOperation stores a newer record and ignores an older one', () => {
  const db = createDb()

  assert.equal(
    applySyncOperation(db, 'user-1', {
      entityType: 'tasks',
      entityId: 'task-1',
      op: 'upsert',
      payload: { id: 'task-1', title: 'First', updatedAt: 10 },
      updatedAt: 10,
    }),
    true,
  )

  assert.equal(
    applySyncOperation(db, 'user-1', {
      entityType: 'tasks',
      entityId: 'task-1',
      op: 'upsert',
      payload: { id: 'task-1', title: 'Older', updatedAt: 9 },
      updatedAt: 9,
    }),
    false,
  )

  const state = getBootstrapState(db, 'user-1')
  assert.equal(state.tasks[0].payload.title, 'First')
})

test('applySyncOperation writes tombstones for deletes', () => {
  const db = createDb()

  applySyncOperation(db, 'user-1', {
    entityType: 'notes',
    entityId: 'note-1',
    op: 'delete',
    payload: { id: 'note-1', deletedAt: 20 },
    updatedAt: 20,
  })

  const state = getBootstrapState(db, 'user-1')
  assert.equal(state.notes[0].deletedAt, 20)
})

test('getChangesSince returns only rows newer than the marker', () => {
  const db = createDb()

  applySyncOperation(db, 'user-1', {
    entityType: 'habits',
    entityId: 'habit-1',
    op: 'upsert',
    payload: { id: 'habit-1', title: 'A' },
    updatedAt: 10,
  })
  applySyncOperation(db, 'user-1', {
    entityType: 'habits',
    entityId: 'habit-2',
    op: 'upsert',
    payload: { id: 'habit-2', title: 'B' },
    updatedAt: 30,
  })

  const changes = getChangesSince(db, 'user-1', 15)
  assert.equal(changes.habits.length, 1)
  assert.equal(changes.habits[0].id, 'habit-2')
})
