const HINT_PREFIX = 'focusgo.discovery.hint.'
const NAV_PREFIX = 'focusgo.discovery.nav.'
const NEW_PREFIX = 'focusgo.discovery.new.'
export const DISCOVERY_NEW_UPDATED_EVENT = 'focusgo:discovery-new-updated'

const sessionSeenNewTargets = new Set<string>()

const dispatchDiscoveryStorageUpdate = (key: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DISCOVERY_NEW_UPDATED_EVENT))
  try {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  } catch {
    window.dispatchEvent(new Event('storage'))
  }
}

/** Clear all discovery localStorage keys without touching anything else. */
export function resetDiscovery(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith(HINT_PREFIX) || key.startsWith(NAV_PREFIX) || key.startsWith(NEW_PREFIX))) {
      toRemove.push(key)
    }
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
  sessionSeenNewTargets.clear()
  dispatchDiscoveryStorageUpdate('__discovery_reset__')
}

export function hintStorageKey(id: string): string {
  return `${HINT_PREFIX}${id}.v1`
}

export function navStorageKey(module: string): string {
  return `${NAV_PREFIX}${module}.v1`
}

export function discoveryNewStorageKey(id: string): string {
  return `${NEW_PREFIX}${id}.v1`
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

export function isDiscoveryNewSeen(id: string): boolean {
  if (sessionSeenNewTargets.has(id)) return true
  try {
    return localStorage.getItem(discoveryNewStorageKey(id)) === '1'
  } catch {
    return false
  }
}

export function markDiscoveryNewSeen(id: string): void {
  sessionSeenNewTargets.add(id)
  const key = discoveryNewStorageKey(id)
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Private browsing or quota: keep the badge cleared for this session.
  }
  dispatchDiscoveryStorageUpdate(key)
}
