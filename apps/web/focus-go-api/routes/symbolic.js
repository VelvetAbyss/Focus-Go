import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { getCloudStorageUsage } from '../sync/store.js'
import { ensureSymbolicTables, pullSymbolic, pushSymbolic, claimDaily } from '../symbolic/store.js'

export const createSymbolicRouter = ({ database = db, authMiddleware = requireAuth, quotaBytes = Number(process.env.FREE_SYNC_QUOTA_BYTES) || 250 * 1024 * 1024, now = () => Date.now() } = {}) => {
  ensureSymbolicTables(database)
  const router = Router()
  const requests = new Map()
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.use(authMiddleware)
  router.use((req, res, next) => {
    const owner = String(req.auth.user.id), timestamp = now()
    if (requests.size > 5000) for (const [key, value] of requests) if (timestamp - value.start >= 60000) requests.delete(key)
    const previous = requests.get(owner), bucket = previous && timestamp - previous.start < 60000 ? previous : { start: timestamp, count: 0 }
    bucket.count++; requests.set(owner, bucket)
    if (bucket.count > 300) return res.status(429).set('Retry-After', '60').json({ error: 'symbolic_rate_limited' })
    next()
  })
  const handler = action => (req, res) => {
    try {
      const userId = String(req.auth.user.id)
      const checkQuota = () => {
        const usage = getCloudStorageUsage(database, userId)
        if (usage.usedBytes > quotaBytes) throw Object.assign(new Error('cloud_storage_quota_exceeded'), { statusCode: 413 })
      }
      res.json(action(database, userId, req.body, { now: now(), checkQuota }))
    } catch (error) {
      if (!error.statusCode) console.error('[symbolic]', error)
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'symbolic_request_failed', ...(error.generation ? { generation: error.generation } : {}) })
    }
  }
  router.post('/pull', handler(pullSymbolic))
  router.post('/push', handler(pushSymbolic))
  router.post('/daily-claim', handler(claimDaily))
  return router
}
