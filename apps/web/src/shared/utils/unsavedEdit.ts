/**
 * Crash-safe hand-off for the last edit in an editor.
 *
 * Saves are async (RxDB → IndexedDB, ~100ms), so a reload or quit right after typing
 * tears the page down before the write lands. While the page is hiding, the pending
 * edit is also written to localStorage synchronously and replayed on the next load.
 */
export type UnsavedEdit<T> = { id: string; patch: T; at: number }

export const createUnsavedEditStore = <T>(key: string) => ({
  stash(edit: UnsavedEdit<T>) {
    try {
      window.localStorage.setItem(key, JSON.stringify(edit))
    } catch {
      // Quota (pasted images) or storage disabled: the async save still runs.
    }
  },
  /** Drop the stash once the async write landed, unless a newer edit replaced it. */
  clear(at: number) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw && (JSON.parse(raw) as UnsavedEdit<T>).at === at) window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
  take(): UnsavedEdit<T> | null {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      window.localStorage.removeItem(key)
      const edit = JSON.parse(raw) as UnsavedEdit<T>
      return edit && typeof edit.id === 'string' && typeof edit.at === 'number' && edit.patch ? edit : null
    } catch {
      return null
    }
  },
})
