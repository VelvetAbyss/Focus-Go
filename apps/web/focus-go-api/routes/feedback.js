import { Router } from 'express'
import { randomUUID } from 'crypto'
import db from '../db/init.js'

const router = Router()

const NOW = () => Date.now()
const VALID_TYPES = ['feature_request', 'bug', 'confusion', 'praise']

// Simple in-memory rate limiter: max 5 submissions per IP per hour
const rateLimitMap = new Map()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60 * 60 * 1000

const checkRateLimit = (ip) => {
  const now = NOW()
  const key = ip ?? 'unknown'
  const entry = rateLimitMap.get(key)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// POST /feedback — public, no auth required
router.post('/', (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? null

    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many submissions, please try again later' })
    }

    const { type, title, body, pageContext, email, userAgent } = req.body ?? {}

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` })
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' })
    }
    if (title.trim().length > 200) {
      return res.status(400).json({ error: 'title too long (max 200 chars)' })
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'body is required' })
    }
    if (body.trim().length > 5000) {
      return res.status(400).json({ error: 'body too long (max 5000 chars)' })
    }

    // resolve user_id from optional email or auth header
    let userId = null
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        // best-effort user lookup — non-fatal if it fails
        const token = authHeader.slice(7)
        const sessionRow = db.prepare('SELECT userId FROM session WHERE token = ? AND expiresAt > ?').get(token, new Date().toISOString())
        if (sessionRow) {
          const betterAuthUser = db.prepare('SELECT email FROM user WHERE id = ?').get(sessionRow.userId)
          if (betterAuthUser) {
            const appUser = db.prepare('SELECT id FROM users WHERE email = ?').get(betterAuthUser.email)
            userId = appUser ? String(appUser.id) : null
          }
        }
      } catch { /* non-fatal */ }
    }

    const now = NOW()
    const id = randomUUID()
    db.prepare(`
      INSERT INTO user_feedback (id, user_id, email, type, title, body, page_context, user_agent, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', 'normal', ?, ?)
    `).run(
      id, userId,
      email ? String(email).slice(0, 200) : null,
      type, title.trim(), body.trim(),
      pageContext ? String(pageContext).slice(0, 500) : null,
      userAgent ? String(userAgent).slice(0, 500) : null,
      now, now,
    )

    res.json({ ok: true, id })
  } catch (err) {
    console.error('[feedback/submit]', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /feedback/mine — returns status of feedback submitted by logged-in user
router.get('/mine', (req, res) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.json({ feedback: [] })

    let userId = null
    try {
      const token = authHeader.slice(7)
      const sessionRow = db.prepare('SELECT userId FROM session WHERE token = ? AND expiresAt > ?').get(token, new Date().toISOString())
      if (sessionRow) {
        const betterAuthUser = db.prepare('SELECT email FROM user WHERE id = ?').get(sessionRow.userId)
        if (betterAuthUser) {
          const appUser = db.prepare('SELECT id FROM users WHERE email = ?').get(betterAuthUser.email)
          userId = appUser ? String(appUser.id) : null
        }
      }
    } catch { /* non-fatal */ }

    if (!userId) return res.json({ feedback: [] })

    const rows = db.prepare('SELECT id, type, title, status, created_at FROM user_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').all(userId)
    res.json({ feedback: rows.map((r) => ({ id: r.id, type: r.type, title: r.title, status: r.status, createdAt: r.created_at })) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
