import { Router } from 'express'
import { statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin, isLocalhostRequest } from '../middleware/admin.js'
import { SYNC_TABLES } from '../sync/config.js'
import { grantManualEntitlement, markOrderAbnormal } from '../services/payments.js'

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
  db.prepare('SELECT id, authing_id, auth_user_id, email, plan, status, created_at, premium_expires_at FROM users ORDER BY created_at DESC').all()

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
  if (query.status && query.status !== 'all') {
    clauses.push('o.status = @status')
    params.status = query.status
  }
  if (query.channel && query.channel !== 'all') {
    clauses.push('COALESCE(o.channel, o.pay_type) = @channel')
    params.channel = query.channel
  }
  if (query.currency && query.currency !== 'all') {
    clauses.push('COALESCE(o.currency, "CNY") = @currency')
    params.currency = query.currency
  }
  if (query.q) {
    clauses.push('(o.order_no LIKE @q OR o.out_trade_no LIKE @q OR u.email LIKE @q OR o.provider_order_id LIKE @q OR o.provider_payment_id LIKE @q)')
    params.q = `%${query.q}%`
  }
  if (query.from) {
    clauses.push('o.created_at >= @from')
    params.from = new Date(query.from).getTime()
  }
  if (query.to) {
    clauses.push('o.created_at <= @to')
    params.to = new Date(query.to).getTime() + 24 * 60 * 60 * 1000 - 1
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  }
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
      ${where.sql}
      ORDER BY o.created_at DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...where.params, limit, offset })
    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM payment_orders o
      LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
      ${where.sql}
    `).get(where.params)?.count ?? 0
    const summaryRows = db.prepare(`
      SELECT COALESCE(o.channel, o.pay_type) as channel, COALESCE(o.currency, 'CNY') as currency, COUNT(*) as count, SUM(CAST(COALESCE(o.gross_amount, o.amount) AS REAL)) as gross
      FROM payment_orders o
      LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
      ${where.sql}
      GROUP BY COALESCE(o.channel, o.pay_type), COALESCE(o.currency, 'CNY')
    `).all(where.params)
    res.json({
      total,
      orders: rows.map(serializeAdminOrder),
      summary: summaryRows.map((row) => ({
        channel: row.channel,
        currency: row.currency,
        count: row.count,
        gross: Number(row.gross ?? 0).toFixed(2),
      })),
    })
  } catch (err) {
    console.error('[admin/orders]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/orders/export', (req, res) => {
  const where = orderWhere(req.query)
  const rows = db.prepare(`
    SELECT o.*, u.email
    FROM payment_orders o
    LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
    ${where.sql}
    ORDER BY o.created_at DESC
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
    SELECT o.*, u.email
    FROM payment_orders o
    LEFT JOIN users u ON CAST(u.id AS TEXT) = o.user_id OR u.authing_id = o.user_id OR u.auth_user_id = o.user_id
    WHERE o.order_no = ? OR o.out_trade_no = ?
  `).get(req.params.orderNo, req.params.orderNo)
  if (!row) return res.status(404).json({ error: 'order not found' })
  const events = db.prepare('SELECT event_key, channel, event_type, raw_payload, created_at FROM payment_events WHERE order_no = ? ORDER BY created_at DESC').all(req.params.orderNo)
  res.json({
    order: serializeAdminOrder(row),
    rawPayload: row.raw_notify_payload ? JSON.parse(row.raw_notify_payload) : null,
    events: events.map((event) => ({
      ...event,
      createdAt: toIso(event.created_at),
      rawPayload: event.raw_payload ? JSON.parse(event.raw_payload) : null,
    })),
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

router.post('/users/:userId/entitlements', (req, res) => {
  try {
    const { planId = 'pro_monthly', months, note } = req.body ?? {}
    const status = grantManualEntitlement(db, {
      userId: req.params.userId,
      planId,
      months: Number(months) || undefined,
      note,
    })
    res.json(status)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
