import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createFxRouter, FX_UPSTREAM, pickRates } from './fx.js'

const UPSTREAM_BODY = {
  result: 'success',
  base_code: 'USD',
  time_last_update_unix: 1791590400,
  rates: { USD: 1, CNY: 7.12, CAD: 1.38, EUR: 0.92, XYZ: 3 },
}

const serve = async (router) => {
  const app = express()
  app.use('/fx', router)
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const base = `http://127.0.0.1:${server.address().port}`
  return { get: (path) => fetch(`${base}${path}`), close: () => new Promise((resolve) => server.close(resolve)) }
}

test('pickRates keeps the app currencies and rejects odd bodies', () => {
  const picked = pickRates(UPSTREAM_BODY)
  assert.deepEqual(picked.rates, { USD: 1, CNY: 7.12, CAD: 1.38, EUR: 0.92 })
  assert.equal(picked.updatedAt, 1791590400 * 1000)
  assert.equal(pickRates({ result: 'error' }), null)
  assert.equal(pickRates({ ...UPSTREAM_BODY, base_code: 'EUR' }), null)
  assert.equal(pickRates({ ...UPSTREAM_BODY, rates: { USD: 1 } }), null)
})

test('serves the fixed upstream, caches it, and falls back to the stale copy', async () => {
  let clock = 1_000_000
  let calls = 0
  let fail = false
  const fetchImpl = async (url) => {
    calls += 1
    assert.equal(url, FX_UPSTREAM)
    if (fail) throw new Error('down')
    return new Response(JSON.stringify(UPSTREAM_BODY), { status: 200 })
  }
  const api = await serve(createFxRouter({ fetchImpl, now: () => clock }))
  try {
    const first = await api.get('/fx/latest')
    assert.equal(first.status, 200)
    assert.equal((await first.json()).rates.CNY, 7.12)
    await api.get('/fx/latest')
    assert.equal(calls, 1, 'second request within six hours is cached')

    clock += 7 * 60 * 60 * 1000
    fail = true
    const stale = await api.get('/fx/latest')
    assert.equal(stale.status, 200)
    assert.equal((await stale.json()).stale, true)
  } finally {
    await api.close()
  }
})

test('answers 502 when there is nothing to fall back on', async () => {
  const api = await serve(createFxRouter({ fetchImpl: async () => new Response('nope', { status: 500 }) }))
  try {
    assert.equal((await api.get('/fx/latest')).status, 502)
  } finally {
    await api.close()
  }
})
