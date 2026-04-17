import { Router } from 'express'
import { statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin, isLocalhostRequest } from '../middleware/admin.js'
import { SYNC_TABLES } from '../sync/config.js'

const router = Router()

// localhost bypasses auth entirely; production requires a valid Bearer token + admin check
router.use((req, res, next) => {
  if (isLocalhostRequest(req)) return requireAdmin(req, res, next)
  return requireAuth(req, res, () => requireAdmin(req, res, next))
})

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../data/focusgo.db')

// ── helpers ──────────────────────────────────────────────────────────────────

const getDbFileSize = () => {
  try {
    return statSync(DB_PATH).size
  } catch {
    return null
  }
}

const getServerMetrics = () => {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const memUsage = process.memoryUsage()
  const loadAvg = os.loadavg()
  return {
    uptimeSeconds: Math.floor(process.uptime()),
    loadAvg1: loadAvg[0],
    loadAvg5: loadAvg[1],
    loadAvg15: loadAvg[2],
    totalMemBytes: totalMem,
    freeMemBytes: freeMem,
    usedMemBytes: usedMem,
    processRssBytes: memUsage.rss,
    processHeapUsedBytes: memUsage.heapUsed,
    processHeapTotalBytes: memUsage.heapTotal,
    dbFileSizeBytes: getDbFileSize(),
  }
}

const getAllUsers = () =>
  db.prepare('SELECT id, authing_id, email, plan, status, created_at, premium_expires_at FROM users ORDER BY created_at DESC').all()

const buildSyncStatsPerUser = () => {
  // For each sync table, aggregate per-user record count + payload byte size
  const statsByUser = {}

  const initUser = (userId) => {
    if (!statsByUser[userId]) {
      statsByUser[userId] = { recordCount: 0, payloadBytes: 0, lastActiveAt: 0, byType: {} }
    }
  }

  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    let rows
    try {
      rows = db
        .prepare(`SELECT user_id, COUNT(*) as cnt, SUM(LENGTH(payload)) as total_bytes, MAX(updated_at) as max_updated FROM ${tableName} GROUP BY user_id`)
        .all()
    } catch {
      continue
    }
    for (const row of rows) {
      const userId = row.user_id
      initUser(userId)
      statsByUser[userId].recordCount += row.cnt ?? 0
      statsByUser[userId].payloadBytes += row.total_bytes ?? 0
      if ((row.max_updated ?? 0) > statsByUser[userId].lastActiveAt) {
        statsByUser[userId].lastActiveAt = row.max_updated
      }
      statsByUser[userId].byType[entityType] = {
        count: row.cnt ?? 0,
        bytes: row.total_bytes ?? 0,
      }
    }
  }

  return statsByUser
}

const getBlobStats = () => {
  try {
    const row = db
      .prepare('SELECT COUNT(*) as cnt, SUM(byte_length) as total_bytes FROM sync_blobs')
      .get()
    return { count: row?.cnt ?? 0, totalBytes: row?.total_bytes ?? 0 }
  } catch {
    return { count: 0, totalBytes: 0 }
  }
}

const NOW = () => Date.now()
const MS_7D = 7 * 24 * 60 * 60 * 1000
const MS_30D = 30 * 24 * 60 * 60 * 1000

// ── GET /admin/overview ───────────────────────────────────────────────────────

router.get('/overview', (_req, res) => {
  try {
    const users = getAllUsers()
    const syncStats = buildSyncStatsPerUser()
    const blobStats = getBlobStats()
    const now = NOW()

    const userRows = users.map((u) => {
      const stats = syncStats[String(u.id)] ?? { recordCount: 0, payloadBytes: 0, lastActiveAt: 0, byType: {} }
      const lastActiveAt = stats.lastActiveAt ? new Date(stats.lastActiveAt).toISOString() : null
      return {
        id: u.id,
        email: u.email,
        plan: u.plan,
        status: u.status,
        createdAt: u.created_at,
        premiumExpiresAt: u.premium_expires_at ?? null,
        lastActiveAt,
        active7d: stats.lastActiveAt > 0 && now - stats.lastActiveAt < MS_7D,
        active30d: stats.lastActiveAt > 0 && now - stats.lastActiveAt < MS_30D,
        syncRecordCount: stats.recordCount,
        syncPayloadBytes: stats.payloadBytes,
        syncByType: stats.byType,
      }
    })

    const totalUsers = users.length
    const premiumUsers = users.filter((u) => u.plan === 'premium').length
    const active7dCount = userRows.filter((u) => u.active7d).length
    const active30dCount = userRows.filter((u) => u.active30d).length
    const grandTotalPayloadBytes = userRows.reduce((s, u) => s + u.syncPayloadBytes, 0)

    res.json({
      totals: {
        totalUsers,
        premiumUsers,
        active7dCount,
        active30dCount,
      },
      users: userRows,
      syncTotals: {
        grandTotalPayloadBytes,
        blobCount: blobStats.count,
        blobTotalBytes: blobStats.totalBytes,
      },
      server: getServerMetrics(),
    })
  } catch (err) {
    console.error('[admin/overview]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
