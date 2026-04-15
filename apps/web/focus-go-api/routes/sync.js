import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { applySyncOperation, getBootstrapState, getChangesSince, upsertSyncBlob } from '../sync/store.js'

const router = Router()

router.use(requireAuth)

router.get('/bootstrap', (req, res) => {
  const userId = String(req.auth.user.id)
  const wantBlobs = Array.isArray(req.query.wantBlobs)
    ? req.query.wantBlobs.map(String)
    : typeof req.query.wantBlobs === 'string'
      ? [req.query.wantBlobs]
      : []
  const snapshot = getBootstrapState(db, userId, wantBlobs)
  res.json({
    serverTime: Date.now(),
    ...snapshot,
  })
})

router.get('/pull', (req, res) => {
  const userId = String(req.auth.user.id)
  const since = Number(req.query.since ?? 0)
  const wantBlobs = Array.isArray(req.query.wantBlobs)
    ? req.query.wantBlobs.map(String)
    : typeof req.query.wantBlobs === 'string'
      ? [req.query.wantBlobs]
      : []
  const changes = getChangesSince(db, userId, Number.isFinite(since) ? since : 0, wantBlobs)
  res.json({
    serverTime: Date.now(),
    ...changes,
  })
})

router.post('/push', (req, res) => {
  const userId = String(req.auth.user.id)
  const entities = Array.isArray(req.body?.entities) ? req.body.entities : []
  const blobs = Array.isArray(req.body?.blobs) ? req.body.blobs : []
  let applied = 0
  const missingBlobs = new Set()

  const tx = db.transaction((items, blobItems) => {
    for (const blob of blobItems) {
      if (!blob || typeof blob.hash !== 'string' || typeof blob.dataBase64 !== 'string') continue
      upsertSyncBlob(db, blob)
    }
    for (const operation of items) {
      if (!operation || typeof operation.entityType !== 'string' || typeof operation.entityId !== 'string') continue
      if (typeof operation.updatedAt !== 'number') continue
      if (applySyncOperation(db, userId, operation)) applied += 1
      if (operation.op !== 'delete' && operation.payload?.bodyRefs) {
        for (const hash of Object.values(operation.payload.bodyRefs)) {
          if (typeof hash !== 'string') continue
          const exists = db.prepare('SELECT hash FROM sync_blobs WHERE hash = ?').get(hash)
          if (!exists) missingBlobs.add(hash)
        }
      }
    }
  })

  tx(entities, blobs)

  res.json({
    applied,
    serverTime: Date.now(),
    missingBlobs: Array.from(missingBlobs),
  })
})

export default router
