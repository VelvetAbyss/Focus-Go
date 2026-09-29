export type PluginSettings = {
  serverUrl: string
  token: string
  /** Vault-relative folder that mirrors your tasks. */
  folder: string
  syncEnabled: boolean
  /** Poll interval while Obsidian has focus. */
  activeIntervalSeconds: number
  /** Poll interval while it does not. */
  idleIntervalSeconds: number
  /** Deleting a note deletes the task. Undo window before the delete is pushed. */
  deleteUndoSeconds: number
  /** Deleting more than this many notes at once asks first. */
  bulkDeleteThreshold: number
}

export const DEFAULT_SETTINGS: PluginSettings = {
  serverUrl: 'https://api.nestflow.art',
  token: '',
  folder: 'Focus & Go/Tasks',
  syncEnabled: true,
  activeIntervalSeconds: 15,
  idleIntervalSeconds: 60,
  deleteUndoSeconds: 10,
  bulkDeleteThreshold: 5,
}

export const CONFLICTS_FOLDER = 'Focus & Go/Conflicts'

export const normalizeFolder = (folder: string): string =>
  folder.replace(/^\/+|\/+$/g, '').trim() || DEFAULT_SETTINGS.folder
