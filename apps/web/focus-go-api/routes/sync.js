import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { getRxdbPullState, pushRxdbRows, upsertSyncBlob } from '../sync/store.js'

export const createSyncRouter = ({
  database = db,
  authMiddleware = requireAuth,
} = {}) => {
  const router = Router()

  router.use(authMiddleware)
  router.use((req, res, next) => {
    if (req.auth?.user?.plan !== 'premium') {
      return res.status(403).json({ error: 'Cloud sync requires premium' })
    }
    return next()
  })

  router.post('/rxdb/pull', (req, res) => {
    const userId = String(req.auth.user.id)
    const entityType = typeof req.body?.entityType === 'string' ? req.body.entityType : ''
    const checkpoint = req.body?.checkpoint && typeof req.body.checkpoint === 'object' ? req.body.checkpoint : null
    const limit = Number(req.body?.limit ?? 100)
    try {
      const result = getRxdbPullState(database, userId, entityType, checkpoint, limit)
      res.json(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Schema mismatch (e.g. client knows an entityType the server does not) is
      // client-fault, not a 500. Return JSON so the client can surface it
      // instead of busy-looping against a generic Express HTML 500 page.
      if (message.startsWith('Unsupported sync entity type')) {
        return res.status(400).json({ error: message })
      }
      console.error(`[sync] rxdb/pull failed entity=${entityType} userId=${userId}`, error)
      return res.status(500).json({ error: message })
    }
  })

  router.post('/rxdb/push', (req, res) => {
    const userId = String(req.auth.user.id)
    const entityType = typeof req.body?.entityType === 'string' ? req.body.entityType : ''
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : []
    const blobs = Array.isArray(req.body?.blobs) ? req.body.blobs : []

    try {
      const tx = database.transaction((blobItems, writeRows) => {
        for (const blob of blobItems) {
          if (!blob || typeof blob.hash !== 'string' || typeof blob.dataBase64 !== 'string') continue
          upsertSyncBlob(database, blob)
        }
        return pushRxdbRows(database, userId, entityType, writeRows)
      })

      res.json(tx(blobs, rows))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('Unsupported sync entity type')) {
        return res.status(400).json({ error: message })
      }
      console.error(`[sync] rxdb/push failed entity=${entityType} userId=${userId}`, error)
      return res.status(500).json({ error: message })
    }
  })

  return router
}

export default createSyncRouter()
