import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { isAdminEmail } from '../middleware/admin.js'

const router = Router()

// GET /user/profile — validate Bearer token, return id + email + plan + isAdmin
router.get('/profile', requireAuth, async (req, res) => {
  let { user } = req.auth
  const now = Date.now()

  if (user.plan === 'premium' && user.premium_expires_at && user.premium_expires_at <= now) {
    db.prepare(`
      UPDATE users
      SET plan = 'free', premium_expires_at = NULL
      WHERE id = ?
    `).run(user.id)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
  }

  const expiresAt = user.premium_expires_at ? new Date(user.premium_expires_at).toISOString() : null
  res.json({ id: user.id, email: user.email, plan: user.plan, expiresAt, isAdmin: isAdminEmail(user.email) })
})

export default router
