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
  for (const tableName of Object.values(SYNC_TABLES)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        PRIMARY KEY (user_id, id)
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at ON ${tableName} (user_id, updated_at)`)
  }
}

const getActiveRowsForUser = (db, userId) => {
  const rows = []
  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    rows.push(
      ...db.prepare(`SELECT payload FROM ${tableName} WHERE user_id = ? AND deleted_at IS NULL`).all(userId).map((row) => ({
        ...row,
        entityType,
      })),
    )
  }
  return rows
}

/**
 * Logical per-account storage usage. Payloads are owned by one account; shared
 * content-addressed blobs are charged once to every account that references
 * them. This keeps the public service predictable without making deduplication
 * across users leak storage accounting details.
 */
export const getCloudStorageUsage = (db, userId) => {
  let payloadBytes = 0
  const hashes = new Set()
  for (const row of getActiveRowsForUser(db, userId)) {
    payloadBytes += Buffer.byteLength(row.payload, 'utf8')
    try {
      const payload = JSON.parse(row.payload)
      for (const hash of collectBlobRefs(row.entityType, payload)) hashes.add(hash)
    } catch {
      // A malformed legacy payload is still charged by its stored byte length.
    }
  }

  let blobBytes = 0
  if (hashes.size > 0) {
    const values = Array.from(hashes)
    const placeholders = values.map(() => '?').join(',')
    const result = db.prepare(`SELECT COALESCE(SUM(byte_length), 0) AS bytes FROM sync_blobs WHERE hash IN (${placeholders})`).get(...values)
    blobBytes = Number(result?.bytes ?? 0)
  }
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
    for (const row of db.prepare(`SELECT payload FROM ${tableName}`).all()) {
      try {
        for (const hash of collectBlobRefs(entityType, JSON.parse(row.payload))) referencedHashes.add(hash)
      } catch {
        // Keep compacting other records if a legacy payload cannot be parsed.
      }
    }
  }

  let blobsDeleted = 0
  const deleteBlob = db.prepare('DELETE FROM sync_blobs WHERE hash = ?')
  for (const { hash } of db.prepare('SELECT hash FROM sync_blobs').all()) {
    if (!referencedHashes.has(hash)) blobsDeleted += deleteBlob.run(hash).changes
  }
  return { tombstonesDeleted, blobsDeleted }
}

export const upsertSyncBlob = (db, blob) => {
  const timestamp = Date.now()
  db.prepare(`
    INSERT INTO sync_blobs (hash, content_type, compression, raw_byte_length, byte_length, data_base64, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hash) DO UPDATE SET
      content_type = excluded.content_type,
      compression = excluded.compression,
      raw_byte_length = excluded.raw_byte_length,
      byte_length = excluded.byte_length,
      data_base64 = excluded.data_base64,
      updated_at = excluded.updated_at
  `).run(
    blob.hash,
    blob.contentType,
    blob.compression,
    blob.rawByteLength,
    blob.byteLength,
    blob.dataBase64,
    timestamp,
    timestamp,
  )
}

const getSyncBlobs = (db, hashes) => {
  if (hashes.length === 0) return []
  const stmt = db.prepare(
    `SELECT hash, content_type, compression, raw_byte_length, byte_length, data_base64 FROM sync_blobs WHERE hash IN (${hashes.map(() => '?').join(',')})`,
  )
  return stmt.all(...hashes).map((row) => ({
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
  if (!checkpoint || !isNumber(checkpoint.updatedAt) || typeof checkpoint.id !== 'string') {
    return db
      .prepare(
        `SELECT id, user_id, payload, updated_at, deleted_at
         FROM ${tableName}
         WHERE user_id = ?
         ORDER BY updated_at ASC, id ASC
         LIMIT ?`,
      )
      .all(userId, limit)
  }
  return db
    .prepare(
      `SELECT id, user_id, payload, updated_at, deleted_at
       FROM ${tableName}
       WHERE user_id = ?
         AND (updated_at > ? OR (updated_at = ? AND id > ?))
       ORDER BY updated_at ASC, id ASC
       LIMIT ?`,
    )
    .all(userId, checkpoint.updatedAt, checkpoint.updatedAt, checkpoint.id, limit)
}

const collectBlobsForPayloads = (db, entityType, rows) => {
  const hashes = new Set()
  for (const row of rows) {
    if (!row || !row.payload) continue
    for (const hash of collectBlobRefs(entityType, row.payload)) hashes.add(hash)
  }
  return getSyncBlobs(db, Array.from(hashes))
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
        }
      : checkpoint ?? null,
    blobs: collectBlobsForPayloads(db, entityType, rows.map(normalizeRow)),
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

    const deletedAt = next._deleted === true ? next.updatedAt : null
    const payload = { ...next }
    delete payload._deleted
    db.prepare(`
      INSERT INTO ${tableName} (id, user_id, payload, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `).run(next.id, userId, JSON.stringify(payload), next.updatedAt, deletedAt)
  }

  return {
    conflicts,
    blobs: collectBlobsForPayloads(
      db,
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
