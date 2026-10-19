import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import Database from 'better-sqlite3'
import { createSymbolicRouter } from './symbolic.js'
import { ensureSyncTables, getCloudStorageUsage } from '../sync/store.js'
import { resetSymbolic } from '../symbolic/store.js'
test('API rejects invalid lunar and historical clock inputs before they can block a client pull', async () => {
  const s = await server()
  try {
    const { generation } = (await s.post('pull', {})).body
    for (const patch of [
      { date: '2024-02-01', calendar: 'lunar', leapMonth: true },
      { date: '2024-01-30', calendar: 'lunar' },
      { date: '2100-12-29', calendar: 'lunar' },
      { date: '2024-03-10', time: '02:30', timeZone: 'America/New_York' },
      { date: '2024-11-03', time: '01:30', timeZone: 'America/New_York' },
      { date: '2011-12-30', timeZone: 'Pacific/Apia' },
    ]) {
      assert.equal((await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', { ...profile(), ...patch })] })).status, 400, JSON.stringify(patch))
    }
    assert.equal((await s.post('pull', {})).body.rows.length, 0)
    const valid = { ...profile(), date: '2023-02-01', calendar: 'lunar', leapMonth: true }
    assert.equal((await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', valid)] })).status, 200)
    const pull = (await s.post('pull', {})).body
    assert.equal(pull.rows.length, 1); assert.equal(pull.rows[0].payload.date, '2023-02-01')
  } finally { await s.close() }
})
const now = Date.parse('2026-10-12T08:00:00Z')
const context = { topic: 'general', intent: 'action', question: '', optionA: '', optionB: '' }
const report = { id: 'r', version: '2', title: 'Report', summary: 'Summary', sections: [], dos: [], donts: [], method: [], limitations: [] }
const reading = (card = 'major-0') => ({ id: 'daily:UTC:2026-10-12', createdAt: now, timeZone: 'UTC', dateKey: '2026-10-12', spread: 'daily', question: '', context, cards: [{ id: card, reversed: false, revealed: false }], reflection: '', contentVersion: '2', reports: { zh: report, en: report } })
const profile = () => ({ id: 'birth:a', name: 'A', date: '2000-01-02', time: '', timeZone: 'UTC', calendar: 'solar', leapMonth: false, latitude: null, longitude: null, direction: '', zi: 2, version: 'v1', savedAt: now })
const mutation = (id, kind, payload, baseRevision = 0, operationId = 'op-' + id) => ({ id, kind, payload, updatedAt: now, deleted: false, baseRevision, operationId })
async function server(options = {}) {
  const database = new Database(':memory:'); ensureSyncTables(database)
  const app = express(); app.use(express.json())
  app.use('/symbolic', createSymbolicRouter({ database, now: () => now, authMiddleware: (req, res, next) => {
    if (!req.headers['x-user']) return res.sendStatus(401)
    req.auth = { user: { id: req.headers['x-user'] } }; next()
  }, ...options }))
  const listener = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const post = async (path, body, user = 'owner-a') => {
    const response = await fetch('http://127.0.0.1:' + listener.address().port + '/symbolic/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user': user } : {}) }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { database, post, close: async () => { await new Promise(resolve => listener.close(resolve)); database.close() } }
}
test('symbolic API derives owner from authentication and persists a private paginated dataset', async () => {
  const s = await server()
  try {
    assert.equal((await s.post('pull', {}, '')).status, 401)
    const a = (await s.post('pull', { timeZone: 'UTC' })).body
    const write = await s.post('push', { generation: a.generation, ownerId: 'owner-b', rows: [mutation('birth:a', 'birth-profile', profile()), mutation('profile:v1', 'profile-version', profile())] })
    assert.equal(write.status, 200); assert.equal(write.body.accepted.length, 2)
    const page1 = (await s.post('pull', { generation: a.generation, cursor: 0, limit: 1 })).body
    assert.equal(page1.rows.length, 1); assert.equal(page1.hasMore, true)
    const page2 = (await s.post('pull', { generation: a.generation, cursor: page1.cursor, limit: 1 })).body
    assert.notEqual(page1.rows[0].id, page2.rows[0].id)
    assert.equal((await s.post('pull', {}, 'owner-b')).body.rows.length, 0)
  } finally { await s.close() }
})
test('symbolic CAS conflicts preserve server data and repeated operations are idempotent', async () => {
  const s = await server()
  try {
    const { generation } = (await s.post('pull', {})).body
    const row = mutation('birth:a', 'birth-profile', profile())
    const first = (await s.post('push', { generation, rows: [row] })).body.accepted[0]
    const repeat = (await s.post('push', { generation, rows: [row] })).body.accepted[0]
    assert.equal(first.revision, repeat.revision)
    const conflict = await s.post('push', { generation, rows: [{ ...row, operationId: 'other', payload: { ...profile(), name: 'Other' } }] })
    assert.equal(conflict.body.conflicts[0].remote.payload.name, 'A')
    const reused = await s.post('push', { generation, rows: [{ ...row, payload: { ...profile(), name: 'Forged' } }] })
    assert.equal(reused.status, 400)
  } finally { await s.close() }
})
test('two devices claim one daily card; today cannot bypass claim and original report is immutable', async () => {
  const s = await server()
  try {
    const { generation } = (await s.post('pull', {})).body
    assert.equal((await s.post('push', { generation, rows: [mutation(reading().id, 'tarot', reading())] })).status, 409)
    const draws = await Promise.all(['major-0', 'major-1'].map((card, i) => s.post('daily-claim', { generation, operationId: 'draw-' + i, reading: reading(card) })))
    assert.equal(draws[0].status, 200); assert.deepEqual(draws[0].body.row, draws[1].body.row)
    const fixed = draws[0].body.row
    assert.equal(fixed.payload.serverConfirmed, true)
    const forged = { ...fixed.payload, cards: [{ ...fixed.payload.cards[0], id: 'major-21' }] }
    assert.equal((await s.post('push', { generation, rows: [mutation(fixed.id, 'tarot', forged, fixed.revision, 'tamper')] })).status, 400)
    const reflection = { ...fixed.payload, reflection: 'A thought', cards: fixed.payload.cards.map(c => ({ ...c, revealed: true })) }
    const edited = await s.post('push', { generation, rows: [mutation(fixed.id, 'tarot', reflection, fixed.revision, 'reflect')] })
    assert.equal(edited.status, 200)
  } finally { await s.close() }
})
test('generation blocks a late or offline request after account reset', async () => {
  const s = await server()
  try {
    const { generation } = (await s.post('pull', {})).body
    await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', profile())] })
    resetSymbolic(s.database, 'owner-a')
    const late = await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', profile(), 0, 'late')] })
    assert.equal(late.status, 409)
    const next = (await s.post('pull', { generation, cursor: 1 })).body
    assert.notEqual(next.generation, generation); assert.equal(next.rows.length, 0)
  } finally { await s.close() }
})
test('symbolic records use the shared storage quota and rejected writes roll back', async () => {
  const s = await server({ quotaBytes: 10 })
  try {
    const { generation } = (await s.post('pull', {})).body
    assert.equal((await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', profile())] })).status, 413)
    assert.equal(getCloudStorageUsage(s.database, 'owner-a').usedBytes, 0)
    assert.equal((await s.post('pull', {})).body.rows.length, 0)
  } finally { await s.close() }
})
test('daily claim validates server date and account timezone, not a client-selected date', async () => {
  const s = await server()
  try {
    const { generation } = (await s.post('pull', { timeZone: 'Asia/Shanghai' })).body
    assert.equal((await s.post('daily-claim', { generation, operationId: 'bad', reading: reading() })).status, 400)
    const broken = { ...profile(), timeZone: 'not-a-zone' }
    assert.equal((await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', broken)] })).status, 400)
  } finally { await s.close() }
})
test('expired daily session cannot reuse a current-day claim and poison record identity', async () => {
  const s = await server()
  try {
    const { generation, serverNow, dateKey } = (await s.post('pull', {})).body
    assert.equal(serverNow, now); assert.equal(dateKey, '2026-10-12')
    await s.post('daily-claim', { generation, operationId: 'today', reading: reading() })
    const old = { ...reading(), id: 'daily:UTC:2026-10-11', dateKey: '2026-10-11', createdAt: now - 86400000 }
    assert.equal((await s.post('daily-claim', { generation, operationId: 'yesterday', reading: old })).status, 400)
    assert.equal((await s.post('pull', {})).body.rows.length, 1)
  } finally { await s.close() }
})
test('birth dates, deletion quota and offline tombstones are validated before acceptance', async () => {
  const s = await server()
  try {
    const { generation } = (await s.post('pull', {})).body
    assert.equal((await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', { ...profile(), date: '2024-02-30' })] })).status, 400)
    assert.equal((await s.post('push', { generation, rows: [{ ...mutation('missing', 'birth-profile', null), deleted: true }] })).status, 200)
    const first = (await s.post('push', { generation, rows: [mutation('birth:a', 'birth-profile', profile())] })).body.accepted[0]
    const deleted = await s.post('push', { generation, rows: [{ ...mutation('birth:a', 'birth-profile', null, first.revision, 'delete-a'), deleted: true }] })
    assert.equal(deleted.status, 200); assert.ok(getCloudStorageUsage(s.database, 'owner-a').usedBytes > 128)
  } finally { await s.close() }
})
