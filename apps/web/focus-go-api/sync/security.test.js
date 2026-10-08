import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { ensureSyncTables, upsertSyncBlob, pushRxdbRows, getRxdbPullState, getCloudStorageUsage } from './store.js'

const blob = (text) => ({ hash: 'known-hash', contentType: 'text/plain', compression: 'none',
  dataBase64: Buffer.from(text).toString('base64'), byteLength: 0, rawByteLength: 0 })
const row = { newDocumentState: { id: 'note', updatedAt: 1, bodyRefs: { contentMd: 'known-hash' } }, assumedMasterState: null }

test('a known victim hash cannot be read or overwritten across accounts', () => {
  const db = new Database(':memory:')
  try {
    ensureSyncTables(db)
    upsertSyncBlob(db, 'victim', blob('private'))
    pushRxdbRows(db, 'victim', 'notes', [row])
    assert.throws(() => pushRxdbRows(db, 'attacker', 'notes', [row]), /sync_blob_not_owned/)
    upsertSyncBlob(db, 'attacker', blob('replacement'))
    pushRxdbRows(db, 'attacker', 'notes', [row])
    assert.equal(Buffer.from(getRxdbPullState(db, 'victim', 'notes', null).blobs[0].dataBase64, 'base64').toString(), 'private')
    assert.equal(Buffer.from(getRxdbPullState(db, 'attacker', 'notes', null).blobs[0].dataBase64, 'base64').toString(), 'replacement')
    assert.throws(() => upsertSyncBlob(db, 'victim', blob('replacement')), /sync_blob_hash_conflict/)
  } finally { db.close() }
})

test('quota charges actual bytes for orphan blobs and tombstoned payloads', () => {
  const db = new Database(':memory:')
  try {
    ensureSyncTables(db)
    upsertSyncBlob(db, 'user', blob('123456789'))
    assert.ok(getCloudStorageUsage(db, 'user').blobBytes >= 9)
    const before = getCloudStorageUsage(db, 'user').blobBytes
    upsertSyncBlob(db, 'user', { ...blob(''), hash: 'empty-file' })
    assert.ok(getCloudStorageUsage(db, 'user').blobBytes >= before + 128)
    pushRxdbRows(db, 'user', 'notes', [{ newDocumentState: { id: 'deleted', updatedAt: 1, _deleted: true, title: 'retained' }, assumedMasterState: null }])
    assert.ok(getCloudStorageUsage(db, 'user').payloadBytes > 0)
    assert.throws(() => upsertSyncBlob(db, 'user', { ...blob('x'), hash: 'bad', dataBase64: 'not base64!' }), /invalid_sync_blob/)
    assert.throws(() => upsertSyncBlob(db, 'user', { ...blob('x'), hash: 'bad', compression: 'gzip' }), /invalid_sync_blob_compression/)
  } finally { db.close() }
})

test('legacy migration preserves existing ownership and never grants new references on restart', () => {
  const db = new Database(':memory:')
  try {
    ensureSyncTables(db)
    db.prepare('DELETE FROM sync_storage_migrations').run()
    db.prepare('INSERT INTO sync_blobs VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('known-hash', 'text/plain', 'none', 7, 0, Buffer.from('private').toString('base64'), 1, 1)
    db.prepare('INSERT INTO sync_notes (id,user_id,payload,updated_at) VALUES (?, ?, ?, ?)')
      .run('old', 'victim', JSON.stringify(row.newDocumentState), 1)
    ensureSyncTables(db)
    assert.equal(getRxdbPullState(db, 'victim', 'notes', null).blobs.length, 1)
    assert.ok(getCloudStorageUsage(db, 'victim').blobBytes >= 7)
    db.prepare('INSERT INTO sync_notes (id,user_id,payload,updated_at) VALUES (?, ?, ?, ?)')
      .run('forged', 'attacker', JSON.stringify(row.newDocumentState), 1)
    ensureSyncTables(db)
    assert.equal(getRxdbPullState(db, 'attacker', 'notes', null).blobs.length, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sync_blobs').get().count, 1)
  } finally { db.close() }
})
