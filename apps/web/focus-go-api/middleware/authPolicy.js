import { fromNodeHeaders } from 'better-auth/node'

export const hasVerifiedEmail = (authUser) => authUser?.emailVerified === true || authUser?.emailVerified === 1

const assertActiveUser = (user) => {
  if (user.status !== 'active') throw Object.assign(new Error('account_not_active'), { statusCode: 403 })
}

export const createRequireAuth = ({ database: db, auth }) => {
  const upsertBusinessUser = (authUser) => {
    const email = authUser.email ?? null
    const existingByAuthId = db.prepare('SELECT * FROM users WHERE auth_user_id = ?').get(authUser.id)
    if (existingByAuthId) {
      assertActiveUser(existingByAuthId)
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, existingByAuthId.id)
      return db.prepare('SELECT * FROM users WHERE id = ?').get(existingByAuthId.id)
    }

    if (email) {
      const existingByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND auth_user_id IS NULL').get(email)
      if (existingByEmail) {
        assertActiveUser(existingByEmail)
        if (!hasVerifiedEmail(authUser)) {
          const error = new Error('email_verification_required_for_migration')
          error.statusCode = 403
          throw error
        }
        const result = db.prepare("UPDATE users SET auth_user_id = ?, email = ? WHERE id = ? AND auth_user_id IS NULL AND status = 'active'")
          .run(authUser.id, email, existingByEmail.id)
        if (result.changes !== 1) throw Object.assign(new Error('legacy_account_migration_conflict'), { statusCode: 403 })
        return db.prepare('SELECT * FROM users WHERE id = ?').get(existingByEmail.id)
      }
    }

    db.prepare(`
      INSERT INTO users (authing_id, auth_user_id, email, plan)
      VALUES (?, ?, ?, 'free')
    `).run(`better:${authUser.id}`, authUser.id, email)
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

  const requireAuth = async (req, res, next) => {
    try {
      const authSession = await getAuthSession(req)
      if (!authSession?.user) {
        return res.status(401).json({ error: 'Missing or invalid session' })
      }

      const user = upsertBusinessUser(authSession.user)
      req.auth = { authUser: authSession.user, session: authSession.session, user }
      return next()
    } catch (error) {
      if (error.statusCode === 403) return res.status(403).json({ error: error.message })
      console.error(error)
      return res.status(401).json({ error: error.message })
    }
  }

  return requireAuth

}
