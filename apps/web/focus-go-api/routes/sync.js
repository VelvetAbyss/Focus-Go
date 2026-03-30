import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { applySyncOperation, getBootstrapState, getChangesSince } from '../sync/store.js'

const router = Router()

router.use(requireAuth)

router.get('/bootstrap', (req, res) => {
  const userId = String(req.auth.user.id)
  res.json({
    serverTime: Date.now(),
    tables: getBootstrapState(db, userId),
  })
})

router.get('/pull', (req, res) => {
  const userId = String(req.auth.user.id)
  const since = Number(req.query.since ?? 0)
  res.json({
    serverTime: Date.now(),
    tables: getChangesSince(db, userId, Number.isFinite(since) ? since : 0),
  })
})

router.post('/push', (req, res) => {
  const userId = String(req.auth.user.id)
  const operations = Array.isArray(req.body?.operations) ? req.body.operations : []
  let applied = 0

  const tx = db.transaction((items) => {
    for (const operation of items) {
      if (!operation || typeof operation.entityType !== 'string' || typeof operation.entityId !== 'string') continue
      if (typeof operation.updatedAt !== 'number') continue
      if (applySyncOperation(db, userId, operation)) applied += 1
    }
  })

  tx(operations)

  res.json({
    applied,
    serverTime: Date.now(),
  })
})

export default router
