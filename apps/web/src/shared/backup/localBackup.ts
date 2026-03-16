export const LOCAL_BACKUP_FORMAT = 'focus-go-local-backup'
export const LOCAL_BACKUP_SCHEMA_VERSION = 1

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

export type LocalBackupPayload = {
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

const readBackupEnvelope = (payload: unknown): LocalBackupPayload => {
  if (!isPlainObject(payload)) throw new Error('Invalid backup file')
  if (payload.format !== LOCAL_BACKUP_FORMAT) throw new Error('Invalid backup file')
  if (!isPlainObject(payload.db) || !isPlainObject(payload.localStorage)) throw new Error('Invalid backup file')
  if (!isPlainObject(payload.db.tables)) throw new Error('Invalid backup file')
  return payload as LocalBackupPayload
}

export const exportLocalBackup = async ({
  db,
  storage,
  tableNames,
  dbName,
  dbVersion,
  createdAt = Date.now(),
}: ExportOptions): Promise<LocalBackupPayload> => {
  const rawTables = await db.exportTables(tableNames)
  const serializedEntries = await Promise.all(
    Object.entries(rawTables).map(async ([tableName, rows]) => {
      const serializedRows = await Promise.all(rows.map((row) => serializeValue(row)))
      return [tableName, serializedRows] as const
    }),
  )

  return {
    format: LOCAL_BACKUP_FORMAT,
    schemaVersion: LOCAL_BACKUP_SCHEMA_VERSION,
    createdAt,
    db: {
      name: dbName,
      version: dbVersion,
      tables: Object.fromEntries(serializedEntries),
    },
    localStorage: storage.readAll(),
  }
}

export const importLocalBackup = async (payload: unknown, { db, storage, tableNames }: ImportOptions) => {
  const backup = readBackupEnvelope(payload)

  const knownTables = new Set(tableNames)
  const restoredTables = Object.fromEntries(
    Object.entries(backup.db.tables)
      .filter(([tableName, rows]) => knownTables.has(tableName) && Array.isArray(rows))
      .map(([tableName, rows]) => [tableName, rows.map((row: unknown) => deserializeValue(row))]),
  )

  await db.replaceTables(restoredTables)

  const storageEntries = Object.fromEntries(
    Object.entries(backup.localStorage).filter(([, value]) => typeof value === 'string'),
  ) as Record<string, string>
  storage.replaceAll(storageEntries)
}

export const createBackupDownload = (payload: LocalBackupPayload) => {
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date(payload.createdAt).toISOString().replace(/[:.]/g, '-')
  return {
    blob,
    url,
    fileName: `focus-go-backup-${stamp}.json`,
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
