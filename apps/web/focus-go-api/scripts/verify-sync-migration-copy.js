import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { SYNC_TABLES } from '../sync/config.js'
import { ensureSyncTables } from '../sync/store.js'

// Run only on a separately prepared SQLite snapshot. This script mutates the
// supplied snapshot so the real API database cannot be accidentally migrated.
const path = process.argv[2] ? resolve(process.argv[2]) : ''
if (!path.endsWith('.migration-copy.db') || !existsSync(path)) {
  throw new Error('Pass an existing SQLite snapshot ending in .migration-copy.db')
}

const database = new Database(path)
try {
  const integrity = () => database.pragma('integrity_check', { simple: true })
  assert.equal(integrity(), 'ok', 'Source snapshot failed SQLite integrity_check')
  const existingTables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name))
  const counts = new Map(Object.values(SYNC_TABLES).filter((name) => existingTables.has(name)).map((name) => [
    name,
    database.prepare(`SELECT COUNT(*) AS total FROM ${name}`).get().total,
  ]))

  ensureSyncTables(database)
  ensureSyncTables(database)
  assert.equal(integrity(), 'ok', 'Migrated snapshot failed SQLite integrity_check')
  for (const table of Object.values(SYNC_TABLES)) {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all()
    assert.ok(columns.some((column) => column.name === 'server_seq'), `${table} is missing server_seq`)
    const afterCount = database.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total
    assert.equal(afterCount, counts.get(table) ?? 0, `${table} row count changed`)
    const unsequenced = database.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE server_seq <= 0`).get().total
    assert.equal(unsequenced, 0, `${table} contains rows without a server sequence`)
  }
  process.stdout.write(`${JSON.stringify({ status: 'passed', syncTables: Object.keys(SYNC_TABLES).length, existingRows: [...counts.values()].reduce((sum, count) => sum + count, 0) })}\n`)
} finally {
  database.close()
}
