import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { getRxdbPullState, pushRxdbRows, upsertSyncBlob } from '../sync/store.js'

const router = Router()

router.use(requireAuth)

router.post('/rxdb/pull', (req, res) => {
  const userId = String(req.auth.user.id)
  const entityType = typeof req.body?.entityType === 'string' ? req.body.entityType : ''
  const checkpoint = req.body?.checkpoint && typeof req.body.checkpoint === 'object' ? req.body.checkpoint : null
  const limit = Number(req.body?.limit ?? 100)
  const result = getRxdbPullState(db, userId, entityType, checkpoint, limit)
  res.json(result)
})

router.post('/rxdb/push', (req, res) => {
  const userId = String(req.auth.user.id)
  const entityType = typeof req.body?.entityType === 'string' ? req.body.entityType : ''
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : []
  const blobs = Array.isArray(req.body?.blobs) ? req.body.blobs : []

  const tx = db.transaction((blobItems, writeRows) => {
    for (const blob of blobItems) {
      if (!blob || typeof blob.hash !== 'string' || typeof blob.dataBase64 !== 'string') continue
      upsertSyncBlob(db, blob)
    }
    return pushRxdbRows(db, userId, entityType, writeRows)
  })

  res.json(tx(blobs, rows))
})

export default router
