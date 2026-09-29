import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import Database from 'better-sqlite3'
import { createIntegrationsRouter } from './integrations.js'
import { ensureIntegrationTokenTable } from '../auth/integrationTokens.js'

const createServer = async ({ authUserId = 'auth-user-1' } = {}) => {
  const db = new Database(':memory:')
  ensureIntegrationTokenTable(db)
  db.exec('CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT)')
  db.prepare('INSERT INTO user (id, email) VALUES (?, ?)').run(authUserId, 'a@example.com')

  const app = express()
  app.use(express.json())
  app.use('/integrations', createIntegrationsRouter({
    database: db,
    authMiddleware: (req, _res, next) => {
      req.auth = { authUser: { id: authUserId }, user: { id: 1 } }
      next()
    },
  }))

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  return {
    db,
    baseUrl,
    post: (path, body) => fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    close: async () => {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      db.close()
    },
  }
}

test('create returns the plaintext token once, list never does', async () => {
  const ctx = await createServer()
  try {
    const created = await (await ctx.post('/integrations/tokens', { name: 'Obsidian' })).json()
    assert.match(created.token, /^fg_[0-9a-f]{64}$/)

    const { tokens } = await (await fetch(`${ctx.baseUrl}/integrations/tokens`)).json()
    assert.equal(tokens.length, 1)
    assert.equal(tokens[0].name, 'Obsidian')
    assert.equal(tokens[0].token, undefined)
  } finally {
    await ctx.close()
  }
})

test('name is required and length-capped', async () => {
  const ctx = await createServer()
  try {
    assert.equal((await ctx.post('/integrations/tokens', {})).status, 400)
    assert.equal((await ctx.post('/integrations/tokens', { name: '   ' })).status, 400)
    assert.equal((await ctx.post('/integrations/tokens', { name: 'x'.repeat(65) })).status, 400)
  } finally {
    await ctx.close()
  }
})

test('per-user token count is capped', async () => {
  const ctx = await createServer()
  try {
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await ctx.post('/integrations/tokens', { name: `t${i}` })).status, 201)
    }
    const overflow = await ctx.post('/integrations/tokens', { name: 'one too many' })
    assert.equal(overflow.status, 409)
    assert.equal((await overflow.json()).error, 'token_limit_reached')
  } finally {
    await ctx.close()
  }
})

test('revoking an unknown token id is a 404', async () => {
  const ctx = await createServer()
  try {
    const response = await fetch(`${ctx.baseUrl}/integrations/tokens/nope`, { method: 'DELETE' })
    assert.equal(response.status, 404)
  } finally {
    await ctx.close()
  }
})

test('revoke removes the token from the list', async () => {
  const ctx = await createServer()
  try {
    const created = await (await ctx.post('/integrations/tokens', { name: 'Obsidian' })).json()
    const response = await fetch(`${ctx.baseUrl}/integrations/tokens/${created.id}`, { method: 'DELETE' })
    assert.equal(response.status, 200)

    const { tokens } = await (await fetch(`${ctx.baseUrl}/integrations/tokens`)).json()
    assert.deepEqual(tokens, [])
  } finally {
    await ctx.close()
  }
})
