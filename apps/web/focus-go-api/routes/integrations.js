import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import {
  createIntegrationToken,
  listIntegrationTokens,
  revokeIntegrationToken,
} from '../auth/integrationTokens.js'

const MAX_TOKENS_PER_USER = 10
const MAX_NAME_LENGTH = 64

export const createIntegrationsRouter = ({ database = db, authMiddleware = requireAuth } = {}) => {
  const router = Router()
  router.use(authMiddleware)

  // The better-auth user id owns the token; `req.auth.user` is the business row.
  const ownerId = (req) => String(req.auth.authUser.id)

  router.get('/tokens', (req, res) => {
    res.json({ tokens: listIntegrationTokens(database, ownerId(req)) })
  })

  router.post('/tokens', (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    if (!name) return res.status(400).json({ error: 'name is required' })
    if (name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `name must be at most ${MAX_NAME_LENGTH} characters` })
    }

    const existing = listIntegrationTokens(database, ownerId(req))
    if (existing.length >= MAX_TOKENS_PER_USER) {
      return res.status(409).json({ error: 'token_limit_reached', limit: MAX_TOKENS_PER_USER })
    }

    // `token` is plaintext and is never retrievable again — the client must
    // surface it to the user immediately.
    const created = createIntegrationToken(database, ownerId(req), name)
    res.status(201).json(created)
  })

  router.delete('/tokens/:id', (req, res) => {
    const revoked = revokeIntegrationToken(database, ownerId(req), req.params.id)
    if (!revoked) return res.status(404).json({ error: 'token not found' })
    res.json({ ok: true })
  })

  return router
}

export default createIntegrationsRouter()
