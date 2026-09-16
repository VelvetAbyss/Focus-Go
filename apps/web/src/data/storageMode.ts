import { useSyncExternalStore } from 'react'
import { LOCAL_DATA_OWNER_KEY } from '../store/authOwnership'

/**
 * Where a device keeps its workspace data.
 *
 *  - `local` — everything stays in this device's IndexedDB. No account, no
 *    network, no cloud replication. The app is fully usable signed-out.
 *  - `cloud` — the same local-first IndexedDB, plus RxDB replication to the
 *    Focus & Go server so the workspace follows the user across devices.
 *    Requires an account.
 *
 * The mode is a *device* decision, not a synced preference — a user may well
 * want cloud sync on their laptop and a local-only workspace on a shared
 * machine — so it lives in localStorage and is never replicated.
 */
export type StorageMode = 'local' | 'cloud'

export const STORAGE_MODE_KEY = 'focusgo:storage-mode'
export const STORAGE_MODE_CHANGED_EVENT = 'focusgo:storage-mode-changed'

/** Pre-storage-mode flag. `'0'` meant the user had switched cloud sync off. */
const LEGACY_CLOUD_SYNC_ENABLED_KEY = 'focusgo:cloud-sync-enabled'

const isStorageMode = (value: unknown): value is StorageMode => value === 'local' || value === 'cloud'

/**
 * Infer a mode for a device that predates this setting, so existing users are
 * never sent back through the first-run chooser. A device that has ever held an
 * account's data was, by definition, in cloud mode; one that explicitly turned
 * sync off was in local mode.
 */
const inferLegacyMode = (): StorageMode | null => {
  if (typeof localStorage === 'undefined') return null
  if (localStorage.getItem(LEGACY_CLOUD_SYNC_ENABLED_KEY) === '0') return 'local'
  if (localStorage.getItem(LOCAL_DATA_OWNER_KEY)) return 'cloud'
  return null
}

/** The chosen mode, or `null` when this device has never chosen one. */
export const readStorageMode = (): StorageMode | null => {
  if (typeof localStorage === 'undefined') return null
  const stored = localStorage.getItem(STORAGE_MODE_KEY)
  if (isStorageMode(stored)) return stored

  const inferred = inferLegacyMode()
  if (inferred) {
    // Persist the inference so the migration runs exactly once per device.
    localStorage.setItem(STORAGE_MODE_KEY, inferred)
    return inferred
  }
  return null
}

export const writeStorageMode = (mode: StorageMode): void => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_MODE_KEY, mode)
  // Keep the legacy flag coherent for any code path still reading it.
  localStorage.setItem(LEGACY_CLOUD_SYNC_ENABLED_KEY, mode === 'cloud' ? '1' : '0')
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORAGE_MODE_CHANGED_EVENT))
}

/** True when this device runs without an account and never talks to the server. */
export const isLocalOnlyMode = (): boolean => readStorageMode() === 'local'

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {}
  // `storage` covers other tabs/windows; the custom event covers this one.
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_MODE_KEY) onChange()
  }
  window.addEventListener(STORAGE_MODE_CHANGED_EVENT, onChange)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(STORAGE_MODE_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', handleStorage)
  }
}

export const useStorageMode = (): StorageMode | null =>
  useSyncExternalStore(subscribe, readStorageMode, () => null)

/**
 * One-shot hand-off from the first-run chooser to the auth gate: picking "cloud
 * sync" should land the user on the sign-in modal rather than in a silently
 * gated workspace. Session-scoped so a crash mid-flow cannot leave a device
 * permanently reopening the modal.
 */
const SIGN_IN_PROMPT_KEY = 'focusgo:prompt-sign-in'

export const requestSignInPrompt = (): void => {
  try {
    sessionStorage.setItem(SIGN_IN_PROMPT_KEY, '1')
  } catch {
    // Private-mode storage failures must not block the mode choice itself.
  }
}

export const consumeSignInPrompt = (): boolean => {
  try {
    if (sessionStorage.getItem(SIGN_IN_PROMPT_KEY) !== '1') return false
    sessionStorage.removeItem(SIGN_IN_PROMPT_KEY)
    return true
  } catch {
    return false
  }
}
