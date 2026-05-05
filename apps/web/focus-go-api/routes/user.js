import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { backfillRegion } from '../middleware/region.js'
import { isAdminEmail } from '../middleware/admin.js'
import { getMembershipStatus } from '../services/payments.js'

const router = Router()

// GET /user/profile — validate Bearer token, return id + email + plan + isAdmin + country_code
router.get('/profile', requireAuth, backfillRegion, async (req, res) => {
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

  const membership = getMembershipStatus(db, user.id)
  res.json({
    id: user.id,
    email: user.email,
    ...membership,
    isAdmin: isAdminEmail(user.email),
    // country_code: ISO 3166-1 alpha-2 (e.g. 'CN', 'US'). null = not yet detected.
    // Frontend uses this to set the default payment channel.
    country_code: user.country_code ?? null,
  })
})

export default router
