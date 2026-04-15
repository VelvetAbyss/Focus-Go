import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import Database from 'better-sqlite3'
import { createSyncRouter } from './sync.js'
import { ensureSyncTables } from '../sync/store.js'

const createDb = () => {
  const db = new Database(':memory:')
  ensureSyncTables(db)
  return db
}

const createServer = async () => {
  const db = createDb()
  const app = express()
  app.use(express.json({ limit: '10mb' }))
  app.use('/sync', createSyncRouter({
    database: db,
    authMiddleware: (req, _res, next) => {
      req.auth = { user: { id: 'user-1' } }
      next()
    },
  }))

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    db,
    baseUrl,
    close: async () => {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      db.close()
    },
  }
}

test('sync route push/pull chain stores blobs and returns hydrated rows', async () => {
  const ctx = await createServer()

  try {
    const pushResponse = await fetch(`${ctx.baseUrl}/sync/rxdb/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'notes',
        rows: [{
          newDocumentState: {
            id: 'note-1',
            title: 'Route Note',
            bodyRefs: { contentMd: 'blob-1' },
            updatedAt: 10,
            _deleted: false,
          },
          assumedMasterState: null,
        }],
        blobs: [{
          hash: 'blob-1',
          contentType: 'text/plain',
          compression: 'gzip',
          rawByteLength: 5,
          byteLength: 5,
          dataBase64: 'eA==',
        }],
      }),
    })

    assert.equal(pushResponse.status, 200)
    assert.deepEqual(await pushResponse.json(), { conflicts: [], blobs: [] })

    const pullResponse = await fetch(`${ctx.baseUrl}/sync/rxdb/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityType: 'notes',
        checkpoint: null,
        limit: 100,
      }),
    })

    assert.equal(pullResponse.status, 200)
    const pullJson = await pullResponse.json()
    assert.equal(pullJson.documents.length, 1)
    assert.equal(pullJson.documents[0].id, 'note-1')
    assert.equal(pullJson.documents[0].title, 'Route Note')
    assert.equal(pullJson.blobs.length, 1)
    assert.equal(pullJson.blobs[0].hash, 'blob-1')
  } finally {
    await ctx.close()
  }
})
