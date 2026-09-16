import JSZip from 'jszip'
import type Dexie from 'dexie'
import { encodeSyncPayload, decodeSyncPayload, encodeBackupBlobBytes, collectBlobRefs } from '../../data/sync/content'
import { SYNC_ENTITY_TABLES } from '../../data/sync/constants'
import type { SyncEntityType, SyncWireBlob } from '../../data/sync/types'

export const LOCAL_BACKUP_FORMAT = 'focus-go-local-backup'
export const LOCAL_BACKUP_V2_FORMAT = 'focus-go-local-backup-v2'
export const LOCAL_BACKUP_SCHEMA_VERSION = 2
export const PROTECTED_STORAGE_KEYS = new Set(['auth', 'oauth_state', 'pkce_verifier', 'focusgo.local-data-owner.v1'])

type SerializablePrimitive = string | number | boolean | null
type SerializedBlob = {
  __type: 'blob'
  mimeType: string
  base64: string
}

type SerializableValue =
  | SerializablePrimitive
  | SerializedBlob
  | SerializableValue[]
  | { [key: string]: SerializableValue | undefined }

type LegacyLocalBackupPayload = {
  format: typeof LOCAL_BACKUP_FORMAT
  schemaVersion: number
  createdAt: number
  db: {
    name: string
    version: number
    tables: Record<string, SerializableValue[]>
  }
  localStorage: Record<string, string>
}

type LocalBackupManifest = {
  format: typeof LOCAL_BACKUP_V2_FORMAT
  schemaVersion: number
  createdAt: number
  db: {
    name: string
    version: number
    tables: Record<string, SerializableValue[]>
  }
  blobs: Record<string, Omit<SyncWireBlob, 'hash' | 'dataBase64'>>
}

export type LocalBackupPayload = {
  manifest: LocalBackupManifest
  localStorage: Record<string, string>
  blobs: Record<string, SyncWireBlob>
}

export type ParsedLocalBackup = LocalBackupPayload | LegacyLocalBackupPayload
export type BackupDownload = {
  blob: Blob
  url: string
  fileName: string
}

export type LocalBackupDatabaseAdapter = {
  exportTables: (tableNames: string[]) => Promise<Record<string, unknown[]>>
  replaceTables: (tables: Record<string, unknown[]>, beforeCommit?: () => void) => Promise<void>
}

export type LocalBackupStorageAdapter = {
  readAll: () => Record<string, string>
  replaceAll: (entries: Record<string, string>) => void
}

type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'clear' | 'setItem'>

type ExportOptions = {
  db: LocalBackupDatabaseAdapter
  storage: LocalBackupStorageAdapter
  tableNames: string[]
  dbName: string
  dbVersion: number
  createdAt?: number
}

type ImportOptions = {
  prepareTables?: (tables: Record<string, unknown[]>) => Record<string, unknown[]>
  db: LocalBackupDatabaseAdapter
  storage: LocalBackupStorageAdapter
  tableNames: string[]
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Blob)

const isSerializedBlob = (value: unknown): value is SerializedBlob =>
  isPlainObject(value) &&
  value.__type === 'blob' &&
  typeof value.mimeType === 'string' &&
  typeof value.base64 === 'string'

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return btoa(binary)
}

const base64ToBytes = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

const serializeValue = async (value: unknown): Promise<SerializableValue> => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer())
    return {
      __type: 'blob',
      mimeType: value.type,
      base64: bytesToBase64(bytes),
    }
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => serializeValue(item)))
  }

  if (isPlainObject(value)) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, nested]) => [key, await serializeValue(nested)] as const),
    )
    return Object.fromEntries(entries)
  }

  return String(value)
}

const deserializeValue = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item))
  }

  if (isSerializedBlob(value)) {
    return new Blob([base64ToBytes(value.base64)], { type: value.mimeType })
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, deserializeValue(nested)]))
  }

  return value
}

const transientTables = new Set(['sync_state', 'sync_blob_cache'])
const tableToEntityType = new Map<string, SyncEntityType>(
  Object.entries(SYNC_ENTITY_TABLES).map(([entityType, tableName]) => [tableName, entityType as SyncEntityType]),
)

const isLegacyPayload = (value: unknown): value is LegacyLocalBackupPayload =>
  isPlainObject(value) &&
  value.format === LOCAL_BACKUP_FORMAT &&
  isPlainObject(value.db) &&
  isPlainObject(value.localStorage) &&
  isPlainObject(value.db.tables)

const isV2Manifest = (value: unknown): value is LocalBackupManifest =>
  isPlainObject(value) &&
  value.format === LOCAL_BACKUP_V2_FORMAT &&
  isPlainObject(value.db) &&
  isPlainObject(value.db.tables) &&
  isPlainObject(value.blobs)

export const exportLocalBackup = async ({
  db,
  storage,
  tableNames,
  dbName,
  dbVersion,
  createdAt = Date.now(),
}: ExportOptions): Promise<LocalBackupPayload> => {
  const rawTables = await db.exportTables(tableNames.filter((name) => !transientTables.has(name)))
  const blobMap = new Map<string, SyncWireBlob>()

  const serializedEntries = await Promise.all(
    Object.entries(rawTables).map(async ([tableName, rows]) => {
      const entityType = tableToEntityType.get(tableName)
      const serializedRows = await Promise.all(
        rows.map(async (row) => {
          const encoded = entityType ? await encodeSyncPayload(entityType, row as never) : { payload: row, blobs: [] }
          for (const blob of encoded.blobs) blobMap.set(blob.hash, blob)
          return serializeValue(encoded.payload)
        }),
      )
      return [tableName, serializedRows] as const
    }),
  )

  return {
    manifest: {
      format: LOCAL_BACKUP_V2_FORMAT,
      schemaVersion: LOCAL_BACKUP_SCHEMA_VERSION,
      createdAt,
      db: {
        name: dbName,
        version: dbVersion,
        tables: Object.fromEntries(serializedEntries),
      },
      blobs: Object.fromEntries(
        Array.from(blobMap.values()).map((blob) => [
          blob.hash,
          {
            contentType: blob.contentType,
            compression: blob.compression,
            rawByteLength: blob.rawByteLength,
            byteLength: blob.byteLength,
          },
        ]),
      ),
    },
    localStorage: Object.fromEntries(
      Object.entries(storage.readAll()).filter(([key]) => !PROTECTED_STORAGE_KEYS.has(key)),
    ),
    blobs: Object.fromEntries(Array.from(blobMap.values()).map((blob) => [blob.hash, blob])),
  }
}

const MAX_BACKUP_BYTES = 256 * 1024 * 1024
const MAX_BACKUP_ENTRY_BYTES = 64 * 1024 * 1024
const MAX_BACKUP_JSON_BYTES = 16 * 1024 * 1024

const validateBlobBytes = async (blob: SyncWireBlob) => {
  if (blob.compression === 'none') {
    if (blob.byteLength !== blob.rawByteLength) throw new Error('Backup blob size mismatch')
    return
  }
  const reader = new Blob([base64ToBytes(blob.dataBase64)]).stream().pipeThrough(new DecompressionStream('gzip')).getReader()
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > blob.rawByteLength || size > MAX_BACKUP_ENTRY_BYTES) {
        await reader.cancel()
        throw new Error('Backup blob exceeds declared size')
      }
    }
    if (size !== blob.rawByteLength) throw new Error('Backup blob size mismatch')
  } finally { reader.releaseLock() }
}

const readZipEntry = (entry: JSZip.JSZipObject | null, limit: number): Promise<Uint8Array> => {
  if (!entry) return Promise.reject(new Error('Missing backup entry'))
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    // JSZip 3 exposes this browser stream API but omits it from JSZipObject's types.
    const stream = (entry as JSZip.JSZipObject & { internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array> }).internalStream('uint8array')
    stream.on('data', (chunk: Uint8Array) => {
      size += chunk.byteLength
      if (size > limit) { stream.pause(); reject(new Error('Backup entry exceeds size limit')); return }
      chunks.push(chunk)
    }).on('error', reject).on('end', () => {
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      resolve(bytes)
    }).resume()
  })
}

export const readBackupFile = async (file: File): Promise<ParsedLocalBackup> => {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds size limit')
  if (file.name.toLowerCase().endsWith('.json')) {
    if (file.size > MAX_BACKUP_JSON_BYTES) throw new Error('Backup JSON exceeds size limit')
    const parsed = JSON.parse(await file.text()) as unknown
    if (!isLegacyPayload(parsed)) throw new Error('Invalid backup file')
    return parsed
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const decoder = new TextDecoder()
  const manifestText = decoder.decode(await readZipEntry(zip.file('manifest.json'), MAX_BACKUP_JSON_BYTES))
  const localStorageText = decoder.decode(await readZipEntry(zip.file('localStorage/settings.json'), MAX_BACKUP_JSON_BYTES))
  if (!manifestText || !localStorageText) throw new Error('Invalid backup file')
  const manifest = JSON.parse(manifestText) as unknown
  const localStorage = JSON.parse(localStorageText) as unknown
  if (!isV2Manifest(manifest) || !isPlainObject(localStorage)) throw new Error('Invalid backup file')

  const blobs: Record<string, SyncWireBlob> = {}
  let totalBytes = 0
  for (const [hash, meta] of Object.entries(manifest.blobs)) {
    if (!/^[a-f0-9]{64}$/.test(hash) || !isPlainObject(meta)) throw new Error('Invalid backup blob metadata')
    const bytes = await readZipEntry(zip.file(`blobs/${hash}.bin`), MAX_BACKUP_ENTRY_BYTES)
    totalBytes += bytes.byteLength
    if (totalBytes > MAX_BACKUP_BYTES) throw new Error('Backup exceeds size limit')
    blobs[hash] = {
      hash,
      contentType: meta.contentType,
      compression: meta.compression,
      rawByteLength: meta.rawByteLength,
      byteLength: meta.byteLength,
      dataBase64: bytesToBase64(bytes),
    }
  }

  return {
    manifest,
    localStorage: Object.fromEntries(
      Object.entries(localStorage).filter(([key, value]) => typeof key === 'string' && typeof value === 'string'),
    ) as Record<string, string>,
    blobs,
  }
}

export const importLocalBackup = async (payload: ParsedLocalBackup, { db, storage, tableNames, prepareTables }: ImportOptions) => {
  const legacy = isLegacyPayload(payload)
  if (!legacy && (!isPlainObject(payload) || !isV2Manifest(payload.manifest) || !isPlainObject(payload.localStorage) || !isPlainObject(payload.blobs))) {
    throw new Error('Invalid backup file')
  }
  const envelope = legacy ? payload : payload.manifest
  if (envelope.schemaVersion !== (legacy ? 1 : LOCAL_BACKUP_SCHEMA_VERSION)) {
    throw new Error('Unsupported backup version')
  }
  if (Object.values(payload.localStorage).some((value) => typeof value !== 'string')) {
    throw new Error('Invalid backup settings')
  }
  if (!legacy) {
    let totalRawBytes = 0
    for (const [hash, blob] of Object.entries(payload.blobs)) {
      if (!isPlainObject(blob) || blob.hash !== hash || !/^[a-f0-9]{64}$/.test(hash) || !['gzip', 'none'].includes(blob.compression) ||
        typeof blob.dataBase64 !== 'string' || !Number.isSafeInteger(blob.rawByteLength) || blob.rawByteLength < 0 ||
        blob.rawByteLength > MAX_BACKUP_ENTRY_BYTES || base64ToBytes(blob.dataBase64).byteLength !== blob.byteLength) {
        throw new Error('Invalid backup blob')
      }
      totalRawBytes += blob.rawByteLength
      if (totalRawBytes > MAX_BACKUP_BYTES) throw new Error('Backup exceeds size limit')
      const metadata = payload.manifest.blobs[hash]
      if (!metadata || metadata.byteLength !== blob.byteLength || metadata.rawByteLength !== blob.rawByteLength ||
        metadata.compression !== blob.compression || metadata.contentType !== blob.contentType) throw new Error('Backup blob metadata mismatch')
      await validateBlobBytes(blob)
    }
    if (Object.keys(payload.manifest.blobs).some((hash) => !payload.blobs[hash])) throw new Error('Missing backup blob')
  }
  const knownTables = new Set(tableNames.filter((name) => !transientTables.has(name)))
  const blobs = new Map(!legacy ? Object.values(payload.blobs).map((blob) => [blob.hash, blob] as const) : [])
  // Decode and validate every row before opening a write transaction.
  const entries = await Promise.all(Object.entries(envelope.db.tables).map(async ([name, rows]) => {
    if (!Array.isArray(rows)) throw new Error(`Invalid backup table: ${name}`)
    if (!knownTables.has(name)) return null
    const ids = new Set<string>()
    const restored = await Promise.all(rows.map(async (row: unknown) => {
      if (!isPlainObject(row) || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) {
        throw new Error(`Invalid or duplicate record in backup table: ${name}`)
      }
      ids.add(row.id)
      const value = deserializeValue(row)
      const entity = tableToEntityType.get(name)
      if (!legacy && entity && collectBlobRefs(entity, value as Record<string, unknown>).some((hash) => !blobs.has(hash))) {
        throw new Error(`Missing blob in backup table: ${name}`)
      }
      return !legacy && entity ? decodeSyncPayload(entity, value as Record<string, unknown>, blobs) : value
    }))
    return [name, restored] as const
  }))
  const decodedTables = Object.fromEntries(entries.filter((entry) => entry !== null))
  const restoredTables = prepareTables ? prepareTables(decodedTables) : decodedTables
  const previousStorage = storage.readAll()
  const nextStorage = {
    ...Object.fromEntries(Object.entries(payload.localStorage).filter(([key]) => !PROTECTED_STORAGE_KEYS.has(key))),
    ...Object.fromEntries(Object.entries(previousStorage).filter(([key]) => PROTECTED_STORAGE_KEYS.has(key))),
  }
  let storageChanged = false
  try {
    await db.replaceTables(restoredTables, () => {
      storageChanged = true
      storage.replaceAll(nextStorage)
    })
  } catch (error) {
    if (storageChanged) {
      try { storage.replaceAll(previousStorage) } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Restore failed; browser settings could not be recovered')
      }
    }
    throw error
  }
}

export const createBackupDownload = async (payload: LocalBackupPayload): Promise<BackupDownload> => {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(payload.manifest, null, 2))
  zip.file('localStorage/settings.json', JSON.stringify(payload.localStorage, null, 2))
  for (const blob of Object.values(payload.blobs)) {
    zip.file(`blobs/${blob.hash}.bin`, await encodeBackupBlobBytes(blob))
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true })
  const url = URL.createObjectURL(blob)
  const stamp = new Date(payload.manifest.createdAt).toISOString().replace(/[:.]/g, '-')
  return {
    blob,
    url,
    fileName: `focus-go-backup-${stamp}.zip`,
  }
}

export const downloadBackupFile = (download: BackupDownload) => {
  const link = document.createElement('a')
  link.href = download.url
  link.download = download.fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(download.url), 60000)
}

export const createTableDatabaseAdapter = (
  database: Dexie,
  tableNames: string[],
): LocalBackupDatabaseAdapter => ({
  async exportTables(names) {
    const entries = await Promise.all(
      names.map(async (name) => [name, await database.table(name).toArray()] as const),
    )
    return Object.fromEntries(entries)
  },
  async replaceTables(tables, beforeCommit) {
    await database.transaction('rw', tableNames.map((name) => database.table(name)), async () => {
      for (const name of tableNames) await database.table(name).clear()
      for (const [name, rows] of Object.entries(tables)) {
        if (!tableNames.includes(name)) throw new Error(`Unknown restore table: ${name}`)
        if (rows.length) await database.table(name).bulkPut(rows)
      }
      beforeCommit?.()
    })
  },
})

export const createBrowserStorageAdapter = (storage: StorageLike): LocalBackupStorageAdapter => ({
  readAll() {
    const entries: Record<string, string> = {}
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key) continue
      const value = storage.getItem(key)
      if (value !== null) entries[key] = value
    }
    return entries
  },
  replaceAll(entries) {
    storage.clear()
    Object.entries(entries).forEach(([key, value]) => storage.setItem(key, value))
  },
})
