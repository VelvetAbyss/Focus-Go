import { Router } from 'express'
import { statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import os from 'os'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin, isLocalhostRequest } from '../middleware/admin.js'
import { SYNC_TABLES } from '../sync/config.js'
import { grantManualEntitlement, markOrderAbnormal } from '../services/payments.js'

const router = Router()

router.use((req, res, next) => {
  if (isLocalhostRequest(req)) return requireAdmin(req, res, next)
  return requireAuth(req, res, () => requireAdmin(req, res, next))
})

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../data/focusgo.db')

// ── helpers ──────────────────────────────────────────────────────────────────

const getDbFileSize = () => {
  try { return statSync(DB_PATH).size } catch { return null }
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
  db.prepare('SELECT id, authing_id, auth_user_id, email, plan, status, created_at, premium_expires_at, deletion_requested_at, deletion_pending_at, tags FROM users ORDER BY created_at DESC').all()

const buildSyncStatsPerUser = () => {
  const statsByUser = {}
  const initUser = (userId) => {
    if (!statsByUser[userId]) statsByUser[userId] = { recordCount: 0, payloadBytes: 0, lastActiveAt: 0, byType: {} }
  }
  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    let rows
    try {
      rows = db.prepare(`SELECT user_id, COUNT(*) as cnt, SUM(LENGTH(payload)) as total_bytes, MAX(updated_at) as max_updated FROM ${tableName} GROUP BY user_id`).all()
    } catch { continue }
    for (const row of rows) {
      initUser(row.user_id)
      statsByUser[row.user_id].recordCount += row.cnt ?? 0
      statsByUser[row.user_id].payloadBytes += row.total_bytes ?? 0
      if ((row.max_updated ?? 0) > statsByUser[row.user_id].lastActiveAt) statsByUser[row.user_id].lastActiveAt = row.max_updated
      statsByUser[row.user_id].byType[entityType] = { count: row.cnt ?? 0, bytes: row.total_bytes ?? 0 }
    }
  }
  return statsByUser
}

const getBlobStats = () => {
  try {
    const row = db.prepare('SELECT COUNT(*) as cnt, SUM(byte_length) as total_bytes FROM sync_blobs').get()
    return { count: row?.cnt ?? 0, totalBytes: row?.total_bytes ?? 0 }
  } catch { return { count: 0, totalBytes: 0 } }
}

const NOW = () => Date.now()
const MS_7D = 7 * 24 * 60 * 60 * 1000
const MS_30D = 30 * 24 * 60 * 60 * 1000
const MS_90D = 90 * 24 * 60 * 60 * 1000

const parseTagsSafe = (raw) => { try { return JSON.parse(raw || '[]') } catch { return [] } }

const computeHealthScore = (user, stats) => {
  const now = NOW()
  if (user.status === 'suspended' || user.status === 'deletion_pending') return 'risk'
  if (stats.recordCount === 0 && user.plan !== 'premium') return 'empty'
  if (!stats.lastActiveAt || now - stats.lastActiveAt > MS_90D) return 'dormant'
  return 'healthy'
}

// Must be called inside a db.transaction() — audit log and mutation share the same transaction.
const writeAuditLog = ({ adminEmail, userId, action, oldValue, newValue, reason, ip }) => {
  db.prepare(`
    INSERT INTO admin_audit_logs (id, admin_email, user_id, action, old_value, new_value, reason, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), adminEmail ?? 'unknown', String(userId), action,
    oldValue != null ? JSON.stringify(oldValue) : null,
    newValue != null ? JSON.stringify(newValue) : null,
    reason ?? null, ip ?? null, NOW(),
  )
}

const getAdminEmail = (req) => req.auth?.user?.email ?? 'localhost-admin'
const getIp = (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? null

const serializeFeedback = (row) => ({
  id: row.id, userId: row.user_id, email: row.email, type: row.type,
  title: row.title, body: row.body, pageContext: row.page_context,
  userAgent: row.user_agent, status: row.status, adminReply: row.admin_reply,
  priority: row.priority, createdAt: row.created_at, updatedAt: row.updated_at,
})

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
        id: u.id, email: u.email, plan: u.plan, status: u.status,
        createdAt: u.created_at, premiumExpiresAt: u.premium_expires_at ?? null,
        deletionRequestedAt: u.deletion_requested_at ?? null,
        deletionPendingAt: u.deletion_pending_at ?? null,
        tags: parseTagsSafe(u.tags),
        lastActiveAt,
        active7d: stats.lastActiveAt > 0 && now - stats.lastActiveAt < MS_7D,
        active30d: stats.lastActiveAt > 0 && now - stats.lastActiveAt < MS_30D,
        syncRecordCount: stats.recordCount, syncPayloadBytes: stats.payloadBytes, syncByType: stats.byType,
        healthScore: computeHealthScore(u, stats),
      }
    })

    res.json({
      totals: {
        totalUsers: users.length,
        premiumUsers: users.filter((u) => u.plan === 'premium').length,
        active7dCount: userRows.filter((u) => u.active7d).length,
        active30dCount: userRows.filter((u) => u.active30d).length,
      },
      users: userRows,
      syncTotals: {
        grandTotalPayloadBytes: userRows.reduce((s, u) => s + u.syncPayloadBytes, 0),
        blobCount: blobStats.count, blobTotalBytes: blobStats.totalBytes,
      },
      server: getServerMetrics(),
    })
  } catch (err) {
    console.error('[admin/overview]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /admin/users/:userId/detail ──────────────────────────────────────────

router.get('/users/:userId/detail', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const entitlements = db.prepare('SELECT * FROM membership_entitlements WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(String(user.id))
    const notes = db.prepare('SELECT * FROM admin_user_notes WHERE user_id = ? ORDER BY created_at DESC').all(String(user.id))
    const auditLogs = db.prepare('SELECT * FROM admin_audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(String(user.id))
    const feedbackCount = db.prepare('SELECT COUNT(*) as cnt FROM user_feedback WHERE user_id = ?').get(String(user.id))?.cnt ?? 0

    const diagnostics = {}
    let totalRecords = 0
    let lastActiveAt = 0
    for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as cnt, MAX(updated_at) as last_updated FROM ${tableName} WHERE user_id = ?`).get(String(user.id))
        diagnostics[entityType] = { count: row?.cnt ?? 0, lastUpdated: row?.last_updated ?? null }
        totalRecords += row?.cnt ?? 0
        if ((row?.last_updated ?? 0) > lastActiveAt) lastActiveAt = row.last_updated
      } catch {
        diagnostics[entityType] = { count: 0, lastUpdated: null }
      }
    }

    res.json({
      user: {
        id: user.id, email: user.email, plan: user.plan, status: user.status,
        createdAt: user.created_at, premiumExpiresAt: user.premium_expires_at ?? null,
        suspensionReason: user.suspension_reason ?? null,
        deletionRequestedAt: user.deletion_requested_at ?? null,
        deletionPendingAt: user.deletion_pending_at ?? null,
        tags: parseTagsSafe(user.tags),
        healthScore: computeHealthScore(user, { recordCount: totalRecords, lastActiveAt }),
      },
      entitlements: entitlements.map((e) => ({
        id: e.id, planId: e.plan_id, source: e.source, startsAt: e.starts_at,
        expiresAt: e.expires_at, isLifetime: e.is_lifetime === 1, note: e.note, createdAt: e.created_at,
      })),
      notes: notes.map((n) => ({ id: n.id, adminEmail: n.admin_email, body: n.body, createdAt: n.created_at, updatedAt: n.updated_at })),
      auditLogs: auditLogs.map((l) => ({
        id: l.id, adminEmail: l.admin_email, action: l.action,
        oldValue: l.old_value ? JSON.parse(l.old_value) : null,
        newValue: l.new_value ? JSON.parse(l.new_value) : null,
        reason: l.reason, ip: l.ip, createdAt: l.created_at,
      })),
      diagnostics,
      feedbackCount,
    })
  } catch (err) {
    console.error('[admin/users/detail]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /admin/users/:userId/entitlements ────────────────────────────────────

router.post('/users/:userId/entitlements', (req, res) => {
  try {
    const { planId = 'pro_monthly', months, note, reason } = req.body ?? {}
    const adminEmail = getAdminEmail(req)
    const ip = getIp(req)

    const user = db.prepare('SELECT id, plan, premium_expires_at FROM users WHERE id = ? OR authing_id = ? OR auth_user_id = ?').get(
      req.params.userId, req.params.userId, req.params.userId
    )
    if (!user) return res.status(400).json({ error: 'user not found' })

    const result = db.transaction(() => {
      const status = grantManualEntitlement(db, { userId: req.params.userId, planId, months: Number(months) || undefined, note })
      writeAuditLog({
        adminEmail, userId: user.id, action: 'grant_entitlement',
        oldValue: { plan: user.plan, premiumExpiresAt: user.premium_expires_at },
        newValue: { planId, months, note, expiresAt: status.expiresAt },
        reason, ip,
      })
      return status
    })()

    res.json(result)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ── POST /admin/users/:userId/revoke-entitlement ──────────────────────────────

router.post('/users/:userId/revoke-entitlement', (req, res) => {
  try {
    const { entitlementId, reason } = req.body ?? {}
    if (!entitlementId) return res.status(400).json({ error: 'entitlementId required' })

    const user = db.prepare('SELECT id, plan, premium_expires_at FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const entitlement = db.prepare('SELECT * FROM membership_entitlements WHERE id = ? AND user_id = ?').get(entitlementId, String(user.id))
    if (!entitlement) return res.status(404).json({ error: 'entitlement not found' })

    db.transaction(() => {
      db.prepare('DELETE FROM membership_entitlements WHERE id = ?').run(entitlementId)
      const remaining = db.prepare("SELECT * FROM membership_entitlements WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY expires_at DESC LIMIT 1").get(String(user.id), NOW())
      const newPlan = remaining ? 'premium' : 'free'
      const newExpiry = remaining?.expires_at ?? null
      db.prepare('UPDATE users SET plan = ?, premium_expires_at = ? WHERE id = ?').run(newPlan, newExpiry, user.id)
      writeAuditLog({
        adminEmail: getAdminEmail(req), userId: user.id, action: 'revoke_entitlement',
        oldValue: { entitlementId, planId: entitlement.plan_id, expiresAt: entitlement.expires_at },
        newValue: { plan: newPlan, premiumExpiresAt: newExpiry },
        reason, ip: getIp(req),
      })
    })()

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /admin/users/:userId/suspend ────────────────────────────────────────

router.post('/users/:userId/suspend', (req, res) => {
  try {
    const { reason } = req.body ?? {}
    const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const result = db.prepare("UPDATE users SET status = 'suspended', suspension_reason = ? WHERE id = ? AND status = 'active'").run(reason ?? null, user.id)
    if (result.changes === 0) return res.status(409).json({ error: `Cannot suspend: current status is '${user.status}'` })

    writeAuditLog({ adminEmail: getAdminEmail(req), userId: user.id, action: 'suspend', oldValue: { status: user.status }, newValue: { status: 'suspended', reason }, reason, ip: getIp(req) })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /admin/users/:userId/suspend (unsuspend) ──────────────────────────

router.delete('/users/:userId/suspend', (req, res) => {
  try {
    const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const result = db.prepare("UPDATE users SET status = 'active', suspension_reason = NULL WHERE id = ? AND status = 'suspended'").run(user.id)
    if (result.changes === 0) return res.status(409).json({ error: `Cannot unsuspend: current status is '${user.status}'` })

    writeAuditLog({ adminEmail: getAdminEmail(req), userId: user.id, action: 'unsuspend', oldValue: { status: 'suspended' }, newValue: { status: 'active' }, ip: getIp(req) })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /admin/users/:userId/deletion-preview ────────────────────────────────

router.get('/users/:userId/deletion-preview', (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, plan, status, created_at, premium_expires_at, authing_id FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    // all 27 sync counts in a single read transaction
    const syncCounts = db.transaction(() => {
      const counts = {}
      for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
        try { counts[entityType] = db.prepare(`SELECT COUNT(*) as cnt FROM ${tableName} WHERE user_id = ?`).get(String(user.id))?.cnt ?? 0 }
        catch { counts[entityType] = 0 }
      }
      return counts
    })()

    const totalSyncRows = Object.values(syncCounts).reduce((s, n) => s + n, 0)
    const blobRow = db.prepare('SELECT COUNT(*) as cnt, SUM(byte_length) as total_bytes FROM sync_blobs WHERE user_id = ?').get(String(user.id))
    const feedbackCount = db.prepare('SELECT COUNT(*) as cnt FROM user_feedback WHERE user_id = ?').get(String(user.id))?.cnt ?? 0
    const noteCount = db.prepare('SELECT COUNT(*) as cnt FROM admin_user_notes WHERE user_id = ?').get(String(user.id))?.cnt ?? 0
    const auditCount = db.prepare('SELECT COUNT(*) as cnt FROM admin_audit_logs WHERE user_id = ?').get(String(user.id))?.cnt ?? 0
    const betterAuthUser = db.prepare('SELECT id FROM user WHERE email = ?').get(user.email)
    const sessionCount = betterAuthUser ? db.prepare('SELECT COUNT(*) as cnt FROM session WHERE userId = ?').get(betterAuthUser.id)?.cnt ?? 0 : 0

    res.json({
      userId: user.id, email: user.email, plan: user.plan, status: user.status,
      createdAt: user.created_at, premiumExpiresAt: user.premium_expires_at ?? null,
      syncCounts, totalSyncRows,
      blobCount: blobRow?.cnt ?? 0, blobBytes: blobRow?.total_bytes ?? 0,
      feedbackCount, adminNoteCount: noteCount, auditLogCount: auditCount, sessionCount,
      willRetain: { auditLogs: auditCount, paymentOrders: 'minimum audit fields only' },
      willPurge: ['sync rows', 'blobs', 'auth sessions', 'better-auth user/account records'],
    })
  } catch (err) {
    console.error('[admin/deletion-preview]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /admin/users/:userId/request-deletion ───────────────────────────────

router.post('/users/:userId/request-deletion', (req, res) => {
  try {
    const { reason } = req.body ?? {}
    const now = NOW()
    const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })
    if (!['active', 'suspended'].includes(user.status)) return res.status(409).json({ error: `Cannot request deletion: current status is '${user.status}'` })

    const result = db.prepare("UPDATE users SET status = 'deletion_pending', deletion_requested_at = ?, deletion_pending_at = ? WHERE id = ? AND status IN ('active', 'suspended')").run(now, now, user.id)
    if (result.changes === 0) return res.status(409).json({ error: 'Status changed concurrently, please retry' })

    writeAuditLog({ adminEmail: getAdminEmail(req), userId: user.id, action: 'request_deletion', oldValue: { status: user.status }, newValue: { status: 'deletion_pending', deletionPendingAt: now }, reason, ip: getIp(req) })
    res.json({ ok: true, deletionEligibleAt: now + MS_7D })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /admin/users/:userId/request-deletion (cancel) ────────────────────

router.delete('/users/:userId/request-deletion', (req, res) => {
  try {
    const user = db.prepare('SELECT id, status FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const result = db.prepare("UPDATE users SET status = 'active', deletion_requested_at = NULL, deletion_pending_at = NULL WHERE id = ? AND status = 'deletion_pending'").run(user.id)
    if (result.changes === 0) return res.status(409).json({ error: `Cannot cancel deletion: current status is '${user.status}'` })

    writeAuditLog({ adminEmail: getAdminEmail(req), userId: user.id, action: 'cancel_deletion', oldValue: { status: 'deletion_pending' }, newValue: { status: 'active' }, ip: getIp(req) })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /admin/users/:userId/purge ──────────────────────────────────────────

router.post('/users/:userId/purge', (req, res) => {
  try {
    const { confirmEmail, reason } = req.body ?? {}
    const user = db.prepare('SELECT id, email, status, deletion_pending_at, authing_id FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })
    if (user.status !== 'deletion_pending') return res.status(409).json({ error: "User must be in 'deletion_pending' status to purge" })

    if (!confirmEmail || confirmEmail.trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
      return res.status(400).json({ error: 'confirmEmail does not match user email' })
    }

    const now = NOW()
    const pendingAt = user.deletion_pending_at ?? 0
    if (now - pendingAt < MS_7D) {
      return res.status(400).json({ error: 'Cooling window not elapsed', remainingMs: MS_7D - (now - pendingAt), eligibleAt: pendingAt + MS_7D })
    }

    db.transaction(() => {
      for (const tableName of Object.values(SYNC_TABLES)) {
        try { db.prepare(`DELETE FROM ${tableName} WHERE user_id = ?`).run(String(user.id)) } catch { /* ignore */ }
      }
      try { db.prepare('DELETE FROM sync_blobs WHERE user_id = ?').run(String(user.id)) } catch { /* ignore */ }

      const betterAuthUser = db.prepare('SELECT id FROM user WHERE email = ?').get(user.email)
      if (betterAuthUser) db.prepare('DELETE FROM user WHERE id = ?').run(betterAuthUser.id)

      db.prepare("UPDATE payment_orders SET email = '[deleted]' WHERE user_id = ? OR user_id = ?").run(String(user.id), user.authing_id ?? '')

      // tombstone audit log written BEFORE deleting the user row
      writeAuditLog({ adminEmail: getAdminEmail(req), userId: user.id, action: 'purge', oldValue: { email: user.email, status: user.status }, newValue: { purgedAt: now }, reason, ip: getIp(req) })

      db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
    })()

    res.json({ ok: true, purgedAt: now })
  } catch (err) {
    console.error('[admin/purge]', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Admin user notes ──────────────────────────────────────────────────────────

router.get('/users/:userId/notes', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM admin_user_notes WHERE user_id = ? ORDER BY created_at DESC').all(req.params.userId)
    res.json(notes.map((n) => ({ id: n.id, adminEmail: n.admin_email, body: n.body, createdAt: n.created_at, updatedAt: n.updated_at })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/users/:userId/notes', (req, res) => {
  try {
    const { body } = req.body ?? {}
    if (!body || typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'body required' })
    if (body.trim().length > 2000) return res.status(400).json({ error: 'note too long (max 2000 chars)' })

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    const now = NOW()
    const id = randomUUID()
    db.prepare('INSERT INTO admin_user_notes (id, user_id, admin_email, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, String(user.id), getAdminEmail(req), body.trim(), now, now)
    res.json({ id, createdAt: now })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/users/:userId/notes/:noteId', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM admin_user_notes WHERE id = ? AND user_id = ?').run(req.params.noteId, req.params.userId)
    if (result.changes === 0) return res.status(404).json({ error: 'note not found' })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Admin user tags ───────────────────────────────────────────────────────────

router.put('/users/:userId/tags', (req, res) => {
  try {
    const { tags } = req.body ?? {}
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be array' })
    const validated = tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().toLowerCase()).slice(0, 10)

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId)
    if (!user) return res.status(404).json({ error: 'user not found' })

    db.prepare('UPDATE users SET tags = ? WHERE id = ?').run(JSON.stringify(validated), user.id)
    res.json({ tags: validated })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Feedback inbox ────────────────────────────────────────────────────────────

router.get('/feedback', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const clauses = []
    const params = []
    if (req.query.status && req.query.status !== 'all') { clauses.push('status = ?'); params.push(req.query.status) }
    if (req.query.type && req.query.type !== 'all') { clauses.push('type = ?'); params.push(req.query.type) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

    const rows = db.prepare(`SELECT * FROM user_feedback ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM user_feedback ${where}`).get(...params)?.cnt ?? 0
    res.json({ total, feedback: rows.map(serializeFeedback) })
  } catch (err) {
    console.error('[admin/feedback]', err)
    res.status(500).json({ error: err.message })
  }
})

router.patch('/feedback/:id', (req, res) => {
  try {
    const { status, adminReply, priority } = req.body ?? {}
    const VALID_STATUSES = ['new', 'reviewing', 'planned', 'shipped', 'closed']
    const VALID_PRIORITIES = ['low', 'normal', 'high']

    const row = db.prepare('SELECT id FROM user_feedback WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'feedback not found' })

    const sets = []
    const vals = []
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })
      sets.push('status = ?'); vals.push(status)
    }
    if (adminReply !== undefined) { sets.push('admin_reply = ?'); vals.push(adminReply) }
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'invalid priority' })
      sets.push('priority = ?'); vals.push(priority)
    }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' })

    sets.push('updated_at = ?'); vals.push(NOW())
    db.prepare(`UPDATE user_feedback SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.params.id)
    res.json(serializeFeedback(db.prepare('SELECT * FROM user_feedback WHERE id = ?').get(req.params.id)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Audit log viewer ──────────────────────────────────────────────────────────

router.get('/audit-logs', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const where = req.query.userId ? 'WHERE user_id = ?' : ''
    const params = req.query.userId ? [req.query.userId] : []
    const rows = db.prepare(`SELECT * FROM admin_audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM admin_audit_logs ${where}`).get(...params)?.cnt ?? 0
    res.json({
      total,
      logs: rows.map((l) => ({
        id: l.id, adminEmail: l.admin_email, userId: l.user_id, action: l.action,
        oldValue: l.old_value ? JSON.parse(l.old_value) : null,
        newValue: l.new_value ? JSON.parse(l.new_value) : null,
        reason: l.reason, ip: l.ip, createdAt: l.created_at,
      })),
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Orders (existing, unchanged) ─────────────────────────────────────────────

const toIso = (value) => value ? new Date(value).toISOString() : null

const serializeAdminOrder = (row) => ({
  orderNo: row.order_no ?? row.out_trade_no,
  userId: row.user_id,
  email: row.email ?? null,
  planId: row.plan_id ?? (row.sku === 'lifetime' ? 'lifetime' : 'pro_monthly'),
  amount: row.gross_amount ?? row.amount,
  feeAmount: row.fee_amount ?? null,
  netAmount: row.net_amount ?? null,
  currency: row.currency ?? 'CNY',
  channel: row.channel ?? row.pay_type,
  status: row.status,
  providerOrderId: row.provider_order_id ?? null,
  providerPaymentId: row.provider_payment_id ?? row.zpay_trade_no ?? null,
  paidAt: toIso(row.paid_at),
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at ?? row.created_at),
  abnormalReason: row.abnormal_reason ?? null,
})

const orderWhere = (query) => {
  const clauses = []
  const params = {}
  if (query.status && query.status !== 'all') { clauses.push('o.status = @status'); params.status = query.status }
  if (query.channel && query.channel !== 'all') { clauses.push('COALESCE(o.channel, o.pay_type) = @channel'); params.channel = query.channel }
  if (query.currency && query.currency !== 'all') { clauses.push('COALESCE(o.currency, "CNY") = @currency'); params.currency = query.currency }
  if (query.q) { clauses.push('(o.order_no LIKE @q OR o.out_trade_no LIKE @q OR u.email LIKE @q OR o.provider_order_id LIKE @q OR o.provider_payment_id LIKE @q)'); params.q = `%${query.q}%` }
  if (query.from) { clauses.push('o.created_at >= @from'); params.from = new Date(query.from).getTime() }
  if (query.to) { clauses.push('o.created_at <= @to'); params.to = new Date(query.to).getTime() + 24 * 60 * 60 * 1000 - 1 }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

router.get('/orders', (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const where = orderWhere(req.query)
    const rows = db.prepare(`
      SELECT o.*, u.email
      FROM payment_orders o
      LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
      ${where.sql} ORDER BY o.created_at DESC LIMIT @limit OFFSET @offset
    `).all({ ...where.params, limit, offset })
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM payment_orders o
      LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
      ${where.sql}
    `).get(where.params)?.count ?? 0
    const summaryRows = db.prepare(`
      SELECT COALESCE(o.channel, o.pay_type) as channel, COALESCE(o.currency, 'CNY') as currency, COUNT(*) as count, SUM(CAST(COALESCE(o.gross_amount, o.amount) AS REAL)) as gross
      FROM payment_orders o
      LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
      ${where.sql} GROUP BY COALESCE(o.channel, o.pay_type), COALESCE(o.currency, 'CNY')
    `).all(where.params)
    res.json({
      total,
      orders: rows.map(serializeAdminOrder),
      summary: summaryRows.map((row) => ({ channel: row.channel, currency: row.currency, count: row.count, gross: Number(row.gross ?? 0).toFixed(2) })),
    })
  } catch (err) {
    console.error('[admin/orders]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/orders/export', (req, res) => {
  const where = orderWhere(req.query)
  const rows = db.prepare(`
    SELECT o.*, u.email FROM payment_orders o
    LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
    ${where.sql} ORDER BY o.created_at DESC
  `).all(where.params).map(serializeAdminOrder)
  const columns = ['orderNo', 'email', 'userId', 'planId', 'amount', 'feeAmount', 'netAmount', 'currency', 'channel', 'status', 'providerOrderId', 'providerPaymentId', 'paidAt', 'createdAt', 'abnormalReason']
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [columns.join(','), ...rows.map((row) => columns.map((key) => escape(row[key])).join(','))].join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="focusgo-orders.csv"')
  res.send(csv)
})

router.get('/orders/:orderNo', (req, res) => {
  const row = db.prepare(`
    SELECT o.*, u.email FROM payment_orders o
    LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
    WHERE o.order_no = ? OR o.out_trade_no = ?
  `).get(req.params.orderNo, req.params.orderNo)
  if (!row) return res.status(404).json({ error: 'order not found' })
  const events = db.prepare('SELECT event_key, channel, event_type, raw_payload, created_at FROM payment_events WHERE order_no = ? ORDER BY created_at DESC').all(req.params.orderNo)
  res.json({
    order: serializeAdminOrder(row),
    rawPayload: row.raw_notify_payload ? JSON.parse(row.raw_notify_payload) : null,
    events: events.map((event) => ({ ...event, createdAt: toIso(event.created_at), rawPayload: event.raw_payload ? JSON.parse(event.raw_payload) : null })),
  })
})

router.post('/orders/:orderNo/mark-abnormal', (req, res) => {
  try {
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'manual abnormal mark'
    markOrderAbnormal(db, { orderNo: req.params.orderNo, reason })
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
