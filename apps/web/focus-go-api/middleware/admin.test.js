import test from 'node:test'
import assert from 'node:assert/strict'
import { requireAdmin } from './admin.js'

const runRequireAdmin = (req) => new Promise((resolve) => {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      resolve({ statusCode: this.statusCode, body })
    },
  }
  requireAdmin(req, res, () => resolve({ statusCode: 200, next: true }))
})

test('requireAdmin allows localhost requests outside production without a session', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  try {
    const result = await runRequireAdmin({
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    })
    assert.deepEqual(result, { statusCode: 200, next: true })
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }
})

test('requireAdmin does not allow localhost bypass in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const result = await runRequireAdmin({
      socket: { remoteAddress: '127.0.0.1' },
      headers: {},
    })
    assert.equal(result.statusCode, 403)
    assert.deepEqual(result.body, { error: 'Forbidden' })
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }
})
