import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import Database from 'better-sqlite3'
import { createAnonymousCountsRouter, readAnonymousCounts } from './anonymousCounts.js'

const clock = Date.parse('2026-10-22T12:00:00Z')
async function fixture(options = {}) {
  const database = new Database(':memory:'), app = express()
  app.use('/api/public-counts', createAnonymousCountsRouter({ database, now: () => clock, ...options }))
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  return { database, async post(body = { event: 'website_view', page: '/', language: 'en' }, headers = {}, suffix = '') {
    return fetch(`http://127.0.0.1:${server.address().port}/api/public-counts${suffix}`, { method: 'POST', headers: { Origin: 'https://nestflow.art', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  }, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); database.close() } }
}

test('stores only daily allowlisted aggregate dimensions; no user records or response cookies', async () => {
  const f = await fixture()
  try {
    for (let i = 0; i < 2; i++) { const r = await f.post(); assert.equal(r.status, 204); assert.equal(r.headers.get('set-cookie'), null) }
    assert.deepEqual(readAnonymousCounts(f.database, 28, clock).rows, [{ day: '2026-10-22', event: 'website_view', page: '/', language: 'en', count: 2 }])
    assert.deepEqual(f.database.prepare('PRAGMA table_info(anonymous_daily_counts)').all().map(c => c.name), ['day','event','page','language','count'])
  } finally { await f.close() }
})

test('rejects arbitrary properties, private paths, wrong source and credentials', async () => {
  const f = await fixture()
  try {
    const valid = { event: 'website_view', page: '/', language: 'en' }
    for (const body of [{ ...valid, email: 'private@example.test' }, { ...valid, page: '/tasks/private-id' }, { ...valid, page: '/?q=private' }, { ...valid, event: 'first_success', page: 'app' }, { ...valid, language: 'zh-CN' }]) assert.equal((await f.post(body)).status, 400)
    assert.equal((await f.post(valid, { Origin: 'https://evil.example' })).status, 403)
    assert.equal((await f.post(valid, { Origin: '' })).status, 403)
    assert.equal((await f.post(valid, { Cookie: 'session=private' })).status, 400)
    assert.equal((await f.post(valid, { Authorization: 'Bearer private' })).status, 400)
    assert.equal((await f.post(valid, {}, '?user=private')).status, 400)
    assert.equal(readAnonymousCounts(f.database, 28, clock).rows.length, 0)
  } finally { await f.close() }
})

test('accepts only app first success and valid website stages; honors privacy signals', async () => {
  const f = await fixture()
  try {
    assert.equal((await f.post({ event: 'first_success', page: 'app', language: 'zh-CN' }, { Origin: 'https://app.nestflow.art' })).status, 204)
    assert.equal((await f.post({ event: 'app_open', page: '/zh/', language: 'zh-CN' })).status, 204)
    for (const headers of [{ DNT: '1' }, { 'Sec-GPC': '1' }]) assert.equal((await f.post(undefined, headers)).status, 204)
    assert.equal(readAnonymousCounts(f.database, 28, clock).rows.reduce((sum,r)=>sum+r.count,0), 2)
  } finally { await f.close() }
})

test('bounds rate and body size without storing network identifiers', async () => {
  const f = await fixture({ limitPerMinute: 2 })
  try { assert.equal((await f.post()).status, 204); assert.equal((await f.post()).status, 204); assert.equal((await f.post()).status, 429) }
  finally { await f.close() }
  const large = await fixture()
  try { assert.equal((await large.post({ data: 'x'.repeat(1000) })).status, 413) }
  finally { await large.close() }
})

test('prunes aggregates older than ninety UTC days and bounds report window', async () => {
  const f = await fixture()
  try {
    f.database.prepare('INSERT INTO anonymous_daily_counts VALUES (?,?,?,?,?)').run('2026-01-01','website_view','/','en',100)
    assert.equal((await f.post()).status, 204)
    assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM anonymous_daily_counts').get().n, 1)
    assert.equal(readAnonymousCounts(f.database, 10000, clock).days, 90)
  } finally { await f.close() }
})
