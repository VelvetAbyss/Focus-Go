import { TABLES } from '../../data/db/schema'
import type { ParsedLocalBackup } from './localBackup'

/** What a restore confirmation compares, in display order. Notes and diary entries in the trash don't count. */
export const BACKUP_SUMMARY_KINDS = [
  { kind: 'tasks', table: TABLES.tasks },
  { kind: 'projects', table: TABLES.projects },
  { kind: 'notes', table: TABLES.notes },
  { kind: 'diary', table: TABLES.diaryEntries },
  { kind: 'focus', table: TABLES.focusSessions },
  { kind: 'habits', table: TABLES.habits },
  { kind: 'spends', table: TABLES.spends },
] as const

export type BackupSummaryKind = (typeof BACKUP_SUMMARY_KINDS)[number]['kind']
export type BackupCounts = Record<BackupSummaryKind, number>

const isLive = (row: unknown) =>
  !(row && typeof row === 'object' && typeof (row as { deletedAt?: unknown }).deletedAt === 'number')

export const countRows = (tables: Record<string, unknown[] | undefined>): BackupCounts =>
  Object.fromEntries(
    BACKUP_SUMMARY_KINDS.map(({ kind, table }) => {
      const rows = tables[table]
      return [kind, Array.isArray(rows) ? rows.filter(isLive).length : 0]
    }),
  ) as BackupCounts

/** When the backup was taken and what it holds. */
export const summarizeBackup = (payload: ParsedLocalBackup): { createdAt: number | null; counts: BackupCounts } => {
  const source = 'manifest' in payload ? payload.manifest : payload
  return {
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : null,
    counts: countRows(source.db.tables as Record<string, unknown[]>),
  }
}

type CountableDatabase = { table: (name: string) => { toArray: () => Promise<unknown[]> } }

/** The same counts for what is on this device now. */
export const countLocalData = async (database: CountableDatabase): Promise<BackupCounts> => {
  const entries = await Promise.all(
    BACKUP_SUMMARY_KINDS.map(async ({ table }) => [table, await database.table(table).toArray()] as const),
  )
  return countRows(Object.fromEntries(entries))
}
