import { randomUUID } from 'node:crypto'
import { validRecord, validReading, validZone, validChange, dateKey, same } from './validation.js'
export const ensureSymbolicTables = db => db.exec(`
  CREATE TABLE IF NOT EXISTS symbolic_accounts (
    user_id TEXT PRIMARY KEY, generation TEXT NOT NULL, time_zone TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS symbolic_records (
    user_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT,
    revision INTEGER NOT NULL, operation_id TEXT NOT NULL, updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(user_id, id)
  );
  CREATE INDEX IF NOT EXISTS symbolic_records_revision ON symbolic_records(user_id, revision);
`)
const fail = (message, statusCode = 400, details = {}) => { throw Object.assign(new Error(message), { statusCode, ...details }) }
export const symbolicAccount = (db, userId, zone = 'UTC') => {
  if (!validZone(zone)) fail('invalid_timezone')
  db.prepare('INSERT OR IGNORE INTO symbolic_accounts (user_id,generation,time_zone) VALUES (?,?,?)').run(userId, randomUUID(), zone)
  return db.prepare('SELECT * FROM symbolic_accounts WHERE user_id=?').get(userId)
}
const wire = row => row && ({ id: row.id, kind: row.kind, payload: row.payload === null ? null : JSON.parse(row.payload), revision: row.revision, operationId: row.operation_id, updatedAt: row.updated_at, deleted: !!row.deleted })
const generationCheck = (account, generation) => {
  if (account.generation !== generation) fail('symbolic_generation_changed', 409, { generation: account.generation })
}
const get = (db, userId, id) => wire(db.prepare('SELECT * FROM symbolic_records WHERE user_id=? AND id=?').get(userId, id))
const put = (db, userId, mutation, now) => {
  db.prepare('UPDATE symbolic_accounts SET cursor=cursor+1 WHERE user_id=?').run(userId)
  const revision = db.prepare('SELECT cursor FROM symbolic_accounts WHERE user_id=?').get(userId).cursor
  db.prepare(`INSERT INTO symbolic_records (user_id,id,kind,payload,revision,operation_id,updated_at,deleted)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET
    kind=excluded.kind,payload=excluded.payload,revision=excluded.revision,operation_id=excluded.operation_id,
    updated_at=excluded.updated_at,deleted=excluded.deleted`).run(userId, mutation.id, mutation.kind,
    mutation.deleted ? null : JSON.stringify(mutation.payload), revision, mutation.operationId, now, +mutation.deleted)
  return get(db, userId, mutation.id)
}
export const pullSymbolic = (db, userId, { generation, cursor = 0, timeZone = 'UTC', limit = 100 } = {}, { now = Date.now() } = {}) => {
  const account = symbolicAccount(db, userId, timeZone)
  if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('invalid_checkpoint')
  if (generation && generation !== account.generation) cursor = 0
  if (cursor > account.cursor) fail('invalid_checkpoint')
  const rows = db.prepare('SELECT * FROM symbolic_records WHERE user_id=? AND revision>? ORDER BY revision LIMIT ?').all(userId, cursor, limit + 1)
  return { generation: account.generation, timeZone: account.time_zone, serverNow: now, dateKey: dateKey(new Date(now), account.time_zone), cursor: rows.length ? rows[Math.min(rows.length, limit) - 1].revision : cursor, hasMore: rows.length > limit, rows: rows.slice(0, limit).map(wire) }
}
export const pushSymbolic = (db, userId, body, { now = Date.now(), checkQuota = () => {} } = {}) => db.transaction(() => {
  const account = symbolicAccount(db, userId)
  generationCheck(account, body?.generation)
  if (!Array.isArray(body?.rows) || body.rows.length > 50) fail('invalid_rows')
  if (new Set(body.rows.map(r => r?.id)).size !== body.rows.length) fail('duplicate_rows')
  const accepted = [], conflicts = []
  for (const row of body.rows) {
    if (!validRecord(row) || Buffer.byteLength(JSON.stringify(row), 'utf8') > 256 * 1024) fail('invalid_record')
    const current = get(db, userId, row.id)
    if (current?.operationId === row.operationId) {
      if (current.kind !== row.kind || current.deleted !== row.deleted || !same(current.payload, row.payload)) fail('operation_id_reused')
      accepted.push(current); continue
    }
    if ((current?.revision ?? 0) !== row.baseRevision) { conflicts.push({ id: row.id, remote: current }); continue }
    if (!validChange(current, row)) fail('immutable_record_changed')
    if (row.kind === 'tarot' && !row.deleted && row.payload.spread === 'daily' && !row.payload.archived && !current) {
      // Only past dates can be imported. Today has a separate atomic claim route.
      if (row.payload.dateKey >= dateKey(new Date(now), account.time_zone)) fail('daily_claim_required', 409)
    }
    accepted.push(put(db, userId, row, now))
  }
  checkQuota()
  return { generation: account.generation, accepted, conflicts }
})()
export const claimDaily = (db, userId, body, { now = Date.now(), checkQuota = () => {} } = {}) => db.transaction(() => {
  const account = symbolicAccount(db, userId)
  generationCheck(account, body?.generation)
  const date = dateKey(new Date(now), account.time_zone)
  const id = 'daily:' + account.time_zone + ':' + date
  const current = get(db, userId, id)
  const reading = body?.reading
  if (!validReading(reading) || reading.spread !== 'daily' || reading.archived || reading.timeZone !== account.time_zone || reading.id !== id || reading.dateKey !== date || reading.cards.some(c => c.revealed) || typeof body.operationId !== 'string' || !body.operationId || body.operationId.length > 120 || Buffer.byteLength(JSON.stringify(reading)) > 256 * 1024) fail('invalid_daily_claim')
  if (current && !current.deleted) return { generation: account.generation, row: current }
  const row = put(db, userId, { id, kind: 'tarot', payload: { ...reading, serverConfirmed: true }, deleted: false, operationId: body.operationId }, now)
  checkQuota()
  return { generation: account.generation, row }
})()
/** Keep a changed generation after reset so an offline device cannot resurrect the previous account dataset. */
export const resetSymbolic = (db, userId) => {
  ensureSymbolicTables(db)
  const deleted = db.prepare('DELETE FROM symbolic_records WHERE user_id=?').run(userId).changes
  db.prepare('INSERT INTO symbolic_accounts (user_id,generation,time_zone,cursor) VALUES (?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET generation=excluded.generation,cursor=0').run(userId, randomUUID(), 'UTC')
  return deleted
}
export const purgeSymbolic = (db, userId) => {
  ensureSymbolicTables(db)
  db.prepare('DELETE FROM symbolic_records WHERE user_id=?').run(userId)
  db.prepare('DELETE FROM symbolic_accounts WHERE user_id=?').run(userId)
}
