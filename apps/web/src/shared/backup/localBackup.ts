import JSZip from 'jszip'
import { encodeSyncPayload, decodeSyncPayload, encodeBackupBlobBytes } from '../../data/sync/content'
import { SYNC_ENTITY_TABLES } from '../../data/sync/constants'
import type { SyncEntityType, SyncWireBlob } from '../../data/sync/types'

export const LOCAL_BACKUP_FORMAT = 'focus-go-local-backup'
export const LOCAL_BACKUP_V2_FORMAT = 'focus-go-local-backup-v2'
export const LOCAL_BACKUP_SCHEMA_VERSION = 2
export const PROTECTED_STORAGE_KEYS = new Set(['auth', 'oauth_state', 'pkce_verifier'])

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

export type LocalBackupDatabaseAdapter = {
  exportTables: (tableNames: string[]) => Promise<Record<string, unknown[]>>
  replaceTables: (tables: Record<string, unknown[]>) => Promise<void>
}

export type LocalBackupStorageAdapter = {
  readAll: () => Record<string, string>
  replaceAll: (entries: Record<string, string>) => void
}

type TableLike = {
  toArray: () => Promise<unknown[]>
  clear: () => Promise<void>
  bulkPut: (rows: readonly unknown[]) => Promise<unknown>
}

type TableDatabaseLike = {
  table: (name: string) => TableLike
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

const transientTables = new Set(['sync_outbox', 'sync_state', 'sync_blob_cache'])
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

export const readBackupFile = async (file: File): Promise<ParsedLocalBackup> => {
  if (file.name.endsWith('.json')) {
    const parsed = JSON.parse(await file.text()) as unknown
    if (!isLegacyPayload(parsed)) throw new Error('Invalid backup file')
    return parsed
  }

  const zip = await JSZip.loadAsync(file)
  const manifestText = await zip.file('manifest.json')?.async('string')
  const localStorageText = await zip.file('localStorage/settings.json')?.async('string')
  if (!manifestText || !localStorageText) throw new Error('Invalid backup file')
  const manifest = JSON.parse(manifestText) as unknown
  const localStorage = JSON.parse(localStorageText) as unknown
  if (!isV2Manifest(manifest) || !isPlainObject(localStorage)) throw new Error('Invalid backup file')

  const blobs: Record<string, SyncWireBlob> = {}
  for (const [hash, meta] of Object.entries(manifest.blobs)) {
    const bytes = await zip.file(`blobs/${hash}.bin`)?.async('uint8array')
    if (!bytes) throw new Error(`Missing backup blob: ${hash}`)
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

export const importLocalBackup = async (payload: ParsedLocalBackup, { db, storage, tableNames }: ImportOptions) => {
  if (!isLegacyPayload(payload) && (!isPlainObject(payload) || !isV2Manifest(payload.manifest) || !isPlainObject(payload.localStorage) || !isPlainObject(payload.blobs))) {
    throw new Error('Invalid backup file')
  }

  if (isLegacyPayload(payload)) {
    const knownTables = new Set(tableNames)
    const restoredTables = Object.fromEntries(
      Object.entries(payload.db.tables)
        .filter(([tableName, rows]) => knownTables.has(tableName) && Array.isArray(rows))
        .map(([tableName, rows]) => [tableName, rows.map((row: unknown) => deserializeValue(row))]),
    )

    await db.replaceTables(restoredTables)
    const currentStorageEntries = storage.readAll()
    const protectedStorageEntries = Object.fromEntries(
      Object.entries(currentStorageEntries).filter(([key, value]) => PROTECTED_STORAGE_KEYS.has(key) && typeof value === 'string'),
    ) as Record<string, string>
    const nextStorageEntries = {
      ...Object.fromEntries(
        Object.entries(payload.localStorage).filter(([key, value]) => !PROTECTED_STORAGE_KEYS.has(key) && typeof value === 'string'),
      ),
      ...protectedStorageEntries,
    }
    storage.replaceAll(nextStorageEntries)
    return
  }

  const knownTables = new Set(tableNames.filter((name) => !transientTables.has(name)))
  const restoredEntries = await Promise.all(
    Object.entries(payload.manifest.db.tables)
      .filter(([tableName, rows]) => knownTables.has(tableName) && Array.isArray(rows))
      .map(async ([tableName, rows]) => {
        const entityType = tableToEntityType.get(tableName)
        const nextRows = await Promise.all(
          rows.map(async (row) => {
            const deserialized = deserializeValue(row)
            if (!entityType) return deserialized
            return decodeSyncPayload(entityType, deserialized as Record<string, unknown>, new Map(Object.values(payload.blobs).map((blob) => [blob.hash, blob] as const)))
          }),
        )
        return [tableName, nextRows] as const
      }),
  )

  await db.replaceTables(Object.fromEntries(restoredEntries))

  const currentStorageEntries = storage.readAll()
  const protectedStorageEntries = Object.fromEntries(
    Object.entries(currentStorageEntries).filter(([key, value]) => PROTECTED_STORAGE_KEYS.has(key) && typeof value === 'string'),
  ) as Record<string, string>
  storage.replaceAll({
    ...payload.localStorage,
    ...protectedStorageEntries,
  })
}

export const createBackupDownload = async (payload: LocalBackupPayload) => {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(payload.manifest, null, 2))
  zip.file('localStorage/settings.json', JSON.stringify(payload.localStorage, null, 2))
  for (const blob of Object.values(payload.blobs)) {
    zip.file(`blobs/${blob.hash}.bin`, await encodeBackupBlobBytes(blob))
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  const url = URL.createObjectURL(blob)
  const stamp = new Date(payload.manifest.createdAt).toISOString().replace(/[:.]/g, '-')
  return {
    blob,
    url,
    fileName: `focus-go-backup-${stamp}.zip`,
  }
}

export const createTableDatabaseAdapter = (
  database: TableDatabaseLike,
  tableNames: string[],
): LocalBackupDatabaseAdapter => ({
  async exportTables(names) {
    const entries = await Promise.all(
      names.map(async (name) => [name, await database.table(name).toArray()] as const),
    )
    return Object.fromEntries(entries)
  },
  async replaceTables(tables) {
    await Promise.all(tableNames.map((name) => database.table(name).clear()))
    await Promise.all(
      Object.entries(tables).map(async ([name, rows]) => {
        if (rows.length === 0) return
        await database.table(name).bulkPut(rows)
      }),
    )
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
