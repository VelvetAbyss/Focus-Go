import { useEffect, useState } from 'react'
import { isNavSeen, markNavSeen } from '../discovery/resetDiscovery'
import './NavNewBadge.css'

interface Props {
  /** Module key matching navStorageKey() — e.g. 'trips', 'labs', 'note' */
  module: string
}

/**
 * Small dot that appears next to a nav item until the user visits that module.
 * Clears permanently on mount if the page is the target module (i.e. user arrived).
 * Pass `module` matching the route key.
 */
export function NavNewBadge({ module }: Props) {
  const [seen, setSeen] = useState(() => isNavSeen(module))

  useEffect(() => {
    const handler = () => setSeen(isNavSeen(module))
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [module])

  if (seen) return null
  return <span className="nav-new-badge" aria-label="new" />
}

/**
 * Mark a nav module as seen. Call when the user navigates to the module.
 */
export function markNavModuleSeen(module: string) {
  markNavSeen(module)
  // Dispatch storage event so other tabs update too
  window.dispatchEvent(new StorageEvent('storage', { key: `focusgo.discovery.nav.${module}.v1` }))
}
