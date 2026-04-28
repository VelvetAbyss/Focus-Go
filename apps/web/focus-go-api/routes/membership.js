import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { isAdminEmail } from '../middleware/admin.js'
import { getMembershipStatus } from '../services/payments.js'

const router = Router()

router.get('/status', requireAuth, (req, res) => {
  const membership = getMembershipStatus(db, req.auth.user.id)
  res.json({
    id: req.auth.user.id,
    email: req.auth.user.email,
    ...membership,
    isAdmin: isAdminEmail(req.auth.user.email),
  })
})

export default router
