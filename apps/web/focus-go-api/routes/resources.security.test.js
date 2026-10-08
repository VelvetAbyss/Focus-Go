import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createFeedbackRouter } from './feedback.js'
import { createPodcastRouter } from './podcasts.js'
import { createIpRateLimiter, createConcurrencyLimiter } from '../middleware/resourceLimits.js'

const serve = async (router) => {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use(router)
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }
}
test('forged leftmost XFF does not reset feedback quota behind one trusted proxy', async () => {
  const database = { prepare: () => ({ run() {}, get() { return null } }) }
  const ctx = await serve(createFeedbackRouter({ database }))
  try {
    for (let i = 0; i < 6; i++) {
      const response = await fetch(ctx.base, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Forwarded-For': `forged-${i}, 192.0.2.1`,
      }, body: JSON.stringify({ type: 'bug', title: 'Test', body: 'Test' }) })
      assert.equal(response.status, i < 5 ? 200 : 429)
    }
  } finally { await ctx.close() }
})

test('resource buckets remain bounded, expire, and release concurrency once', () => {
  let now = 0
  const rate = createIpRateLimiter({ limit: 1, windowMs: 10, maxEntries: 1, now: () => now })
  assert.equal(rate({ ip: 'a' }), true)
  assert.equal(rate({ ip: 'b' }), false)
  now = 10
  assert.equal(rate({ ip: 'b' }), true)
  const acquire = createConcurrencyLimiter({ perIp: 1, total: 1 })
  const release = acquire({ ip: 'a' })
  assert.equal(acquire({ ip: 'b' }), null)
  release(); release()
  assert.equal(typeof acquire({ ip: 'b' }), 'function')
})

test('podcast proxy enforces byte caps, aborts upstream and preserves normal range responses', async () => {
  let signal
  const ctx = await serve(createPodcastRouter({
    maxStreamBytes: 5,
    resolveAudio: async () => 'https://music.126.net/a.mp3',
    fetchImpl: async (_url, options) => {
      signal = options.signal
      if (options.headers) return new Response('abc', { status: 206, headers: { 'Content-Range': 'bytes 0-2/20' } })
      return new Response('too large', { headers: { 'Content-Length': '9' } })
    },
  }))
  try {
    assert.equal((await fetch(`${ctx.base}/netease/stream?programId=1`)).status, 413)
    assert.equal(signal.aborted, true)
    const normal = await fetch(`${ctx.base}/netease/stream?programId=1`, { headers: { Range: 'bytes=0-2' } })
    assert.equal(normal.status, 206)
    assert.equal(await normal.text(), 'abc')
  } finally { await ctx.close() }
})
