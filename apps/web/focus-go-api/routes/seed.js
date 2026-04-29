import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// POST /seed/claim — atomically claim the right to seed initial sample data.
// Returns { shouldSeed: true, seededAt } only for the first caller; every
// subsequent call (any device, any session) returns { shouldSeed: false }.
router.post('/claim', requireAuth, (req, res) => {
  const userId = req.auth.user.id
  const result = db.prepare(`
    UPDATE users
    SET initial_seeded_at = CURRENT_TIMESTAMP
    WHERE id = ? AND initial_seeded_at IS NULL
  `).run(userId)

  if (result.changes === 1) {
    const row = db.prepare('SELECT initial_seeded_at FROM users WHERE id = ?').get(userId)
    return res.json({ shouldSeed: true, seededAt: row?.initial_seeded_at ?? null })
  }

  const row = db.prepare('SELECT initial_seeded_at FROM users WHERE id = ?').get(userId)
  return res.json({ shouldSeed: false, seededAt: row?.initial_seeded_at ?? null })
})

export default router
