import { gunzipSync } from 'node:zlib'
import { SYNC_TABLES } from './config.js'
import { collectBlobRefs } from './protocol.js'

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const normalizeRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  payload: JSON.parse(row.payload),
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
})

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`
}

const normalizeDocumentForCompare = (document) => {
  if (!document || typeof document !== 'object') return null
  // Always represent _deleted as an explicit boolean so the comparison is
  // symmetric with buildConflictDocument (which always emits _deleted as a
  // boolean derived from deleted_at). Without this, a client-sent
  // assumedMasterState carrying { _deleted: false } would never match the
  // server's current view of a live row, and every non-create push (especially
  // deletes) would silently dead-end in the conflict path — the user would see
  // creates sync but updates/deletes get reverted by RxDB's master-wins resolve.
  return { ...document, _deleted: Boolean(document._deleted) }
}

const buildConflictDocument = (row, fallback = null) => {
  if (!row) return fallback ? { ...fallback, _deleted: true } : null
  const normalized = normalizeRow(row)
  return {
    ...normalized.payload,
    _deleted: Boolean(normalized.deletedAt),
  }
}

const documentsMatch = (current, assumedMasterState) => {
  if (!current) return assumedMasterState == null
  if (!assumedMasterState) return false
  return stableStringify(buildConflictDocument(current)) === stableStringify(normalizeDocumentForCompare(assumedMasterState))
}

const getTableName = (entityType) => {
  const tableName = SYNC_TABLES[entityType]
  if (!tableName) {
    throw new Error(`Unsupported sync entity type: ${entityType}`)
  }
  return tableName
}

export const ensureSyncTables = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_revision_counters (
      table_name TEXT PRIMARY KEY,
      revision INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_blobs (
      hash TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      compression TEXT NOT NULL,
      raw_byte_length INTEGER NOT NULL,
      byte_length INTEGER NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_user_blobs (
      user_id TEXT NOT NULL, hash TEXT NOT NULL, content_type TEXT NOT NULL,
      compression TEXT NOT NULL, raw_byte_length INTEGER NOT NULL, byte_length INTEGER NOT NULL,
      data_base64 TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, hash)
    );
    CREATE TABLE IF NOT EXISTS sync_storage_migrations (id TEXT PRIMARY KEY);
  `)
  for (const tableName of Object.values(SYNC_TABLES)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        server_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, id)
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at ON ${tableName} (user_id, updated_at)`)
    // Existing installations predate the server sequence. Give their rows a
    // stable initial order, then retain a counter even after tombstone pruning.
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
    if (!columns.some((column) => column.name === 'server_seq')) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN server_seq INTEGER NOT NULL DEFAULT 0`)
    }
    db.exec(`UPDATE ${tableName} SET server_seq = rowid WHERE server_seq = 0`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_server_seq ON ${tableName} (user_id, server_seq)`)
    db.prepare(`
      INSERT INTO sync_revision_counters (table_name, revision)
      VALUES (?, (SELECT COALESCE(MAX(server_seq), 0) FROM ${tableName}))
      ON CONFLICT(table_name) DO UPDATE SET revision = MAX(revision, excluded.revision)
    `).run(tableName)
  }
  // One-time, non-destructive ownership backfill from existing documents only.
  // Never fall back to the global table during requests or repeat this on restart.
  db.transaction(() => {
    if (db.prepare('SELECT id FROM sync_storage_migrations WHERE id = ?').get('tenant-blobs-v1')) return
    const legacy = db.prepare('SELECT * FROM sync_blobs WHERE hash = ?')
    const insert = db.prepare(`INSERT OR IGNORE INTO sync_user_blobs
      (user_id, hash, content_type, compression, raw_byte_length, byte_length, data_base64, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
      for (const row of db.prepare(`SELECT user_id, payload FROM ${tableName}`).all()) {
        let payload
        try { payload = JSON.parse(row.payload) } catch { continue }
        for (const hash of collectBlobRefs(entityType, payload)) {
          const blob = legacy.get(hash)
          if (blob) insert.run(row.user_id, hash, blob.content_type, blob.compression,
            blob.raw_byte_length, Buffer.from(blob.data_base64, 'base64').length,
            blob.data_base64, blob.created_at, blob.updated_at)
        }
      }
    }
    db.prepare('INSERT INTO sync_storage_migrations (id) VALUES (?)').run('tenant-blobs-v1')
  })()

}

const nextServerSequence = (db, tableName) => {
  db.prepare('UPDATE sync_revision_counters SET revision = revision + 1 WHERE table_name = ?').run(tableName)
  return db.prepare('SELECT revision FROM sync_revision_counters WHERE table_name = ?').get(tableName).revision
}

const getStoredRowsForUser = (db, userId) => {
  const rows = []
  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    rows.push(
      ...db.prepare(`SELECT payload FROM ${tableName} WHERE user_id = ?`).all(userId).map((row) => ({
        ...row,
        entityType,
      })),
    )
  }
  return rows
}

/** Charge the account for every retained payload and owned blob. */
export const getCloudStorageUsage = (db, userId) => {
  let payloadBytes = 0
  for (const row of getStoredRowsForUser(db, userId)) payloadBytes += Buffer.byteLength(row.payload, 'utf8')

  // SQLite retains base64 text and metadata, not just the decoded file bytes.
  // A conservative per-record allowance also prevents millions of empty blobs
  // from bypassing quota through zero-length data.
  const blobBytes = Number(db.prepare(`SELECT COALESCE(SUM(
    length(CAST(data_base64 AS BLOB)) + length(CAST(hash AS BLOB))
    + length(CAST(content_type AS BLOB)) + length(CAST(user_id AS BLOB)) + 128
  ), 0) AS bytes FROM sync_user_blobs WHERE user_id = ?`).get(userId).bytes)

  return { usedBytes: payloadBytes + blobBytes, payloadBytes, blobBytes }
}

/**
 * Compact expired tombstones and blobs that are no longer referenced by any
 * remaining document. This is deliberately safe to run after a write: live
 * tombstones keep their attachment references until their retention window
 * passes, so a lagging client can still pull a consistent deletion record.
 */
export const pruneSyncStorage = (db, { tombstoneRetentionMs = 90 * 24 * 60 * 60 * 1000, now = Date.now() } = {}) => {
  const expiresBefore = now - tombstoneRetentionMs
  let tombstonesDeleted = 0
  for (const tableName of Object.values(SYNC_TABLES)) {
    tombstonesDeleted += db.prepare(`DELETE FROM ${tableName} WHERE deleted_at IS NOT NULL AND deleted_at < ?`).run(expiresBefore).changes
  }

  const referencedHashes = new Set()
  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    for (const row of db.prepare(`SELECT user_id, payload FROM ${tableName}`).all()) {
      try {
        for (const hash of collectBlobRefs(entityType, JSON.parse(row.payload))) referencedHashes.add(JSON.stringify([row.user_id, hash]))
      } catch {
        // Keep compacting other records if a legacy payload cannot be parsed.
      }
    }
  }

  let blobsDeleted = 0
  const deleteBlob = db.prepare('DELETE FROM sync_user_blobs WHERE user_id = ? AND hash = ?')
  for (const { user_id, hash } of db.prepare('SELECT user_id, hash FROM sync_user_blobs').all()) {
    if (!referencedHashes.has(JSON.stringify([user_id, hash]))) blobsDeleted += deleteBlob.run(user_id, hash).changes
  }
  return { tombstonesDeleted, blobsDeleted }
}

const invalidBlob = (message) => Object.assign(new Error(message), { statusCode: 400 })

export const upsertSyncBlob = (db, userId, blob) => {
  if (!userId || !blob || typeof blob.hash !== 'string' || !blob.hash || blob.hash.length > 200
      || typeof blob.contentType !== 'string' || blob.contentType.length > 200
      || typeof blob.dataBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(blob.dataBase64)
      || !['gzip', 'none'].includes(blob.compression)) throw invalidBlob('invalid_sync_blob')
  const bytes = Buffer.from(blob.dataBase64, 'base64')
  let raw
  try { raw = blob.compression === 'gzip' ? gunzipSync(bytes, { maxOutputLength: 8 * 1024 * 1024 }) : bytes }
  catch { throw invalidBlob('invalid_sync_blob_compression') }
  if (bytes.length > 8 * 1024 * 1024 || raw.length > 8 * 1024 * 1024) throw invalidBlob('sync_blob_too_large')
  const existing = db.prepare('SELECT * FROM sync_user_blobs WHERE user_id = ? AND hash = ?').get(userId, blob.hash)
  if (existing) {
    // Content keys are immutable within an account; another account has its own key space.
    let existingRaw
    try {
      const stored = Buffer.from(existing.data_base64, 'base64')
      existingRaw = existing.compression === 'gzip' ? gunzipSync(stored, { maxOutputLength: 8 * 1024 * 1024 }) : stored
    } catch { throw invalidBlob('sync_blob_hash_conflict') }
    if (!existingRaw.equals(raw) || existing.content_type !== blob.contentType) throw invalidBlob('sync_blob_hash_conflict')
    return
  }
  const timestamp = Date.now()
  db.prepare(`INSERT INTO sync_user_blobs
    (user_id, hash, content_type, compression, raw_byte_length, byte_length, data_base64, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, blob.hash, blob.contentType, blob.compression, raw.length, bytes.length, blob.dataBase64, timestamp, timestamp)
}

const getSyncBlobs = (db, userId, hashes) => {
  if (hashes.length === 0) return []
  const stmt = db.prepare(
    `SELECT hash, content_type, compression, raw_byte_length, byte_length, data_base64 FROM sync_user_blobs WHERE user_id = ? AND hash IN (${hashes.map(() => '?').join(',')})`,
  )
  return stmt.all(userId, ...hashes).map((row) => ({
    hash: row.hash,
    contentType: row.content_type,
    compression: row.compression,
    rawByteLength: row.raw_byte_length,
    byteLength: row.byte_length,
    dataBase64: row.data_base64,
  }))
}

const getRowsForEntityType = (db, userId, entityType, checkpoint, limit) => {
  const tableName = getTableName(entityType)
  if (checkpoint && isNumber(checkpoint.sequence)) {
    return db.prepare(`
      SELECT id, user_id, payload, updated_at, deleted_at, server_seq
      FROM ${tableName} WHERE user_id = ? AND server_seq > ?
      ORDER BY server_seq ASC LIMIT ?
    `).all(userId, checkpoint.sequence, limit)
  }
  if (!checkpoint || !isNumber(checkpoint.updatedAt) || typeof checkpoint.id !== 'string') {
    return db
      .prepare(
        `SELECT id, user_id, payload, updated_at, deleted_at, server_seq
         FROM ${tableName}
         WHERE user_id = ?
         ORDER BY server_seq ASC
         LIMIT ?`,
      )
      .all(userId, limit)
  }
  return db
    .prepare(
      `SELECT id, user_id, payload, updated_at, deleted_at, server_seq
       FROM ${tableName}
       WHERE user_id = ?
         AND (updated_at > ? OR (updated_at = ? AND id > ?))
       ORDER BY updated_at ASC, id ASC
       LIMIT ?`,
    )
    .all(userId, checkpoint.updatedAt, checkpoint.updatedAt, checkpoint.id, limit)
}

const collectBlobsForPayloads = (db, userId, entityType, rows) => {
  const hashes = new Set()
  for (const row of rows) {
    if (!row || !row.payload) continue
    for (const hash of collectBlobRefs(entityType, row.payload)) hashes.add(hash)
  }
  return getSyncBlobs(db, userId, Array.from(hashes))
}

export const getRxdbPullState = (db, userId, entityType, checkpoint, limit = 100) => {
  const rows = getRowsForEntityType(db, userId, entityType, checkpoint, Math.max(1, Math.min(500, limit)))
  const documents = rows.map((row) => {
    const normalized = normalizeRow(row)
    return {
      ...normalized.payload,
      _deleted: Boolean(normalized.deletedAt),
    }
  })
  const last = rows.at(-1)
  return {
    documents,
    checkpoint: last
      ? {
          updatedAt: last.updated_at,
          id: last.id,
          sequence: last.server_seq,
        }
      : checkpoint ?? null,
    blobs: collectBlobsForPayloads(db, userId, entityType, rows.map(normalizeRow)),
  }
}

export const pushRxdbRows = (db, userId, entityType, rows) => {
  const tableName = getTableName(entityType)
  const conflicts = []

  for (const row of rows) {
    const next = row?.newDocumentState
    if (!next || typeof next.id !== 'string' || !isNumber(next.updatedAt)) continue
    const current = db
      .prepare(`SELECT id, user_id, payload, updated_at, deleted_at FROM ${tableName} WHERE user_id = ? AND id = ?`)
      .get(userId, next.id)

    if (!documentsMatch(current, row?.assumedMasterState ?? null)) {
      const conflict = buildConflictDocument(current, row?.assumedMasterState ?? null)
      if (conflict) conflicts.push(conflict)
      continue
    }

    // Tombstone-priority sanity check: refuse to resurrect a deleted row from
    // an upsert whose updatedAt isn't strictly newer than the tombstone. Stops
    // a client with a skewed clock (or replaying a stale queued op) from
    // un-deleting a row that another device has already deleted. Idempotent
    // re-deletes (incoming _deleted=true) are allowed through.
    if (current && current.deleted_at && next._deleted !== true && next.updatedAt <= current.deleted_at) {
      const conflict = buildConflictDocument(current)
      if (conflict) conflicts.push(conflict)
      continue
    }

    for (const hash of collectBlobRefs(entityType, next)) {
      if (!db.prepare('SELECT 1 FROM sync_user_blobs WHERE user_id = ? AND hash = ?').get(userId, hash)) {
        throw invalidBlob('sync_blob_not_owned')
      }
    }

    const deletedAt = next._deleted === true ? next.updatedAt : null
    const payload = { ...next }
    delete payload._deleted
    const serverSequence = nextServerSequence(db, tableName)
    db.prepare(`
      INSERT INTO ${tableName} (id, user_id, payload, updated_at, deleted_at, server_seq)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        server_seq = excluded.server_seq
    `).run(next.id, userId, JSON.stringify(payload), next.updatedAt, deletedAt, serverSequence)
  }

  return {
    conflicts,
    blobs: collectBlobsForPayloads(
      db,
      userId,
      entityType,
      conflicts.map((document) => ({
        id: document.id,
        userId,
        payload: document,
        updatedAt: document.updatedAt,
        deletedAt: document._deleted ? document.updatedAt : null,
      })),
    ),
  }
}
