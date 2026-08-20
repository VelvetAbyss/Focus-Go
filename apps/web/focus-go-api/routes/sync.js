import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { getCloudStorageUsage, getRxdbPullState, pushRxdbRows, upsertSyncBlob } from '../sync/store.js'

export const DEFAULT_CLOUD_SYNC_QUOTA_BYTES = 250 * 1024 * 1024
export const DEFAULT_SYNC_RATE_LIMITS = { pull: 120, push: 60 }

const readPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const createRateLimiter = ({ limits = DEFAULT_SYNC_RATE_LIMITS, now = () => Date.now() } = {}) => {
  const buckets = new Map()
  return (kind, userId) => {
    const key = `${kind}:${userId}`
    const timestamp = now()
    const current = buckets.get(key)
    const count = current && timestamp - current.startedAt < 60_000 ? current.count + 1 : 1
    const startedAt = current && timestamp - current.startedAt < 60_000 ? current.startedAt : timestamp
    buckets.set(key, { startedAt, count })
    return { allowed: count <= limits[kind], retryAfterSeconds: Math.max(1, Math.ceil((startedAt + 60_000 - timestamp) / 1000)) }
  }
}

export const createSyncRouter = ({
  database = db,
  authMiddleware = requireAuth,
  quotaBytes = readPositiveInt(process.env.FREE_SYNC_QUOTA_BYTES, DEFAULT_CLOUD_SYNC_QUOTA_BYTES),
  rateLimiter = createRateLimiter({
    limits: {
      pull: readPositiveInt(process.env.SYNC_PULLS_PER_MINUTE, DEFAULT_SYNC_RATE_LIMITS.pull),
      push: readPositiveInt(process.env.SYNC_PUSHES_PER_MINUTE, DEFAULT_SYNC_RATE_LIMITS.push),
    },
  }),
} = {}) => {
  const router = Router()

  router.use(authMiddleware)
  const enforceRateLimit = (kind) => (req, res, next) => {
    const decision = rateLimiter(kind, String(req.auth.user.id))
    if (decision.allowed) return next()
    res.set('Retry-After', String(decision.retryAfterSeconds))
    return res.status(429).json({ error: 'sync_rate_limited', retryAfterSeconds: decision.retryAfterSeconds })
  }

  router.post('/rxdb/pull', enforceRateLimit('pull'), (req, res) => {
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

  router.post('/rxdb/push', enforceRateLimit('push'), (req, res) => {
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
        const result = pushRxdbRows(database, userId, entityType, writeRows)
        const usage = getCloudStorageUsage(database, userId)
        if (usage.usedBytes > quotaBytes) {
          const error = new Error('cloud_storage_quota_exceeded')
          error.code = 'cloud_storage_quota_exceeded'
          error.usage = usage
          throw error
        }
        return { ...result, quota: { ...usage, limitBytes: quotaBytes } }
      })

      res.json(tx(blobs, rows))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('Unsupported sync entity type')) {
        return res.status(400).json({ error: message })
      }
      if (error?.code === 'cloud_storage_quota_exceeded') {
        return res.status(413).json({
          error: 'cloud_storage_quota_exceeded',
          usedBytes: error.usage.usedBytes,
          limitBytes: quotaBytes,
        })
      }
      console.error(`[sync] rxdb/push failed entity=${entityType} userId=${userId}`, error)
      return res.status(500).json({ error: message })
    }
  })

  return router
}

export default createSyncRouter()
