import { getUserInfo } from '../services/authing.js'
import db from '../db/init.js'

const TRIAL_DAYS = 7
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000

const normalizePremiumStatus = (user) => {
  if (!user) return null
  if (user.plan !== 'premium') return user
  if (typeof user.premium_expires_at !== 'number' || user.premium_expires_at > Date.now()) return user

  db.prepare(`
    UPDATE users
    SET plan = 'free', premium_expires_at = NULL
    WHERE authing_id = ?
  `).run(user.authing_id)

  return db.prepare('SELECT * FROM users WHERE authing_id = ?').get(user.authing_id)
}

const upsertUser = (authingId, email) => {
  const trialExpiresAt = Date.now() + TRIAL_DURATION_MS
  db.prepare(`
    INSERT INTO users (authing_id, email, plan, premium_expires_at)
    VALUES (?, ?, 'premium', ?)
    ON CONFLICT(authing_id) DO UPDATE SET email = excluded.email
  `).run(authingId, email ?? null, trialExpiresAt)
  return db.prepare('SELECT * FROM users WHERE authing_id = ?').get(authingId)
}

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }

  try {
    const accessToken = authHeader.slice(7)
    const authingUser = await getUserInfo(accessToken)
    const user = normalizePremiumStatus(upsertUser(authingUser.sub, authingUser.email))
    req.auth = { authingUser, user }
    return next()
  } catch (error) {
    console.error(error)
    return res.status(401).json({ error: error.message })
  }
}
