import { fromNodeHeaders } from 'better-auth/node'
import db from '../db/init.js'
import { auth } from '../auth/betterAuth.js'
import { getMembershipStatus } from '../services/payments.js'

const TRIAL_DAYS = 14
const TRIAL_DURATION_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000

const normalizePremiumStatus = (user) => {
  if (!user) return null
  const membership = getMembershipStatus(db, user.id)
  if (membership.plan === 'premium' && user.plan !== 'premium') {
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('premium', user.id)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
  }
  if (user.plan !== 'premium') return user
  if (membership.plan === 'premium') {
    return { ...user, plan: 'premium' }
  }
  if (typeof user.premium_expires_at !== 'number' || user.premium_expires_at > Date.now()) return user

  db.prepare(`
    UPDATE users
    SET plan = 'free', premium_expires_at = NULL
    WHERE id = ?
  `).run(user.id)

  return db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
}

const upsertBusinessUser = (authUser) => {
  const email = authUser.email ?? null
  const existingByAuthId = db.prepare('SELECT * FROM users WHERE auth_user_id = ?').get(authUser.id)
  if (existingByAuthId) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, existingByAuthId.id)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(existingByAuthId.id)
  }

  if (email) {
    const existingByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND auth_user_id IS NULL').get(email)
    if (existingByEmail) {
      db.prepare('UPDATE users SET auth_user_id = ?, email = ? WHERE id = ?').run(authUser.id, email, existingByEmail.id)
      return db.prepare('SELECT * FROM users WHERE id = ?').get(existingByEmail.id)
    }
  }

  const trialExpiresAt = Date.now() + TRIAL_DURATION_MS
  db.prepare(`
    INSERT INTO users (authing_id, auth_user_id, email, plan, premium_expires_at)
    VALUES (?, ?, ?, 'premium', ?)
  `).run(`better:${authUser.id}`, authUser.id, email, trialExpiresAt)
  return db.prepare('SELECT * FROM users WHERE auth_user_id = ?').get(authUser.id)
}

const getSessionFromBearerToken = (token) => {
  if (!token) return null
  const session = db.prepare('SELECT * FROM session WHERE token = ?').get(token)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    db.prepare('DELETE FROM session WHERE token = ?').run(token)
    return null
  }
  const user = db.prepare('SELECT * FROM user WHERE id = ?').get(session.userId)
  if (!user) return null
  return { session, user }
}

const getAuthSession = async (req) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return getSessionFromBearerToken(authHeader.slice(7))
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  })
  if (!session?.user) return null
  return session
}

export const requireAuth = async (req, res, next) => {
  try {
    const authSession = await getAuthSession(req)
    if (!authSession?.user) {
      return res.status(401).json({ error: 'Missing or invalid session' })
    }

    const user = normalizePremiumStatus(upsertBusinessUser(authSession.user))
    req.auth = { authUser: authSession.user, session: authSession.session, user }
    return next()
  } catch (error) {
    console.error(error)
    return res.status(401).json({ error: error.message })
  }
}
