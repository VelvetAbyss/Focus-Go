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
      return true
    } catch {
      // Quota (pasted images) or storage disabled: the async save still runs.
      return false
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
  /** Inspect without consuming: a failed replay must remain available next time. */
  peek(): UnsavedEdit<T> | null {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const edit = JSON.parse(raw) as UnsavedEdit<T>
      return edit && typeof edit.id === 'string' && typeof edit.at === 'number' && edit.patch ? edit : null
    } catch {
      return null
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

/** A separate recovery entry per document, with support for the legacy single-entry format. */
export const createUnsavedEditJournal = <T>(key: string) => {
  const valid = (value: unknown): value is UnsavedEdit<T> => {
    if (!value || typeof value !== 'object') return false
    const edit = value as Partial<UnsavedEdit<T>>
    return typeof edit.id === 'string' && edit.id.length > 0 &&
      typeof edit.at === 'number' && Number.isFinite(edit.at) && Boolean(edit.patch)
  }
  const read = (): Record<string, UnsavedEdit<T>> => {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return {}
      const parsed: unknown = JSON.parse(raw)
      if (valid(parsed)) return { [parsed.id]: parsed }
      if (!parsed || typeof parsed !== 'object' || !('edits' in parsed)) return {}
      const edits = (parsed as { edits?: unknown }).edits
      if (!edits || typeof edits !== 'object' || Array.isArray(edits)) return {}
      return Object.fromEntries(Object.entries(edits).filter(([id, edit]) => valid(edit) && edit.id === id))
    } catch {
      return {}
    }
  }
  const write = (entries: Record<string, UnsavedEdit<T>>) => {
    try {
      if (Object.keys(entries).length === 0) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, JSON.stringify({ version: 2, edits: entries }))
      return true
    } catch {
      return false
    }
  }
  return {
    list: () => Object.values(read()),
    stash: (edit: UnsavedEdit<T>) => write({ ...read(), [edit.id]: edit }),
    clear: (id: string, at: number) => {
      const entries = read()
      if (entries[id]?.at !== at) return
      delete entries[id]
      write(entries)
    },
  }
}
