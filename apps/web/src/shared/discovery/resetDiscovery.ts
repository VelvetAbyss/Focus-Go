const HINT_PREFIX = 'focusgo.discovery.hint.'
const NAV_PREFIX = 'focusgo.discovery.nav.'

/** Clear all discovery localStorage keys without touching anything else. */
export function resetDiscovery(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith(HINT_PREFIX) || key.startsWith(NAV_PREFIX))) {
      toRemove.push(key)
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
  window.dispatchEvent(new StorageEvent('storage', { key: '__discovery_reset__' }))
}

export function hintStorageKey(id: string): string {
  return `${HINT_PREFIX}${id}.v1`
}

export function navStorageKey(module: string): string {
  return `${NAV_PREFIX}${module}.v1`
}

export function isHintDismissed(id: string): boolean {
  try {
    return localStorage.getItem(hintStorageKey(id)) === '1'
  } catch {
    return false
  }
}

export function dismissHint(id: string): void {
  try {
    localStorage.setItem(hintStorageKey(id), '1')
  } catch {
    // Private browsing or quota: caller handles in-memory fallback
    throw new Error('storage-unavailable')
  }
}

export function isNavSeen(module: string): boolean {
  try {
    return localStorage.getItem(navStorageKey(module)) === '1'
  } catch {
    return false
  }
}

export function markNavSeen(module: string): void {
  try {
    localStorage.setItem(navStorageKey(module), '1')
  } catch {
    // Non-fatal: badge may reappear next session
  }
}
