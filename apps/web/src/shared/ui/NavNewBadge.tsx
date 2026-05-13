import { DiscoveryNewBadge, markDiscoveryNewTargetSeen } from './DiscoveryNewBadge'
import type { DiscoveryNewTargetId } from '../discovery/newTargets'

interface Props {
  /** Module key matching navStorageKey() — e.g. 'trips', 'labs', 'note' */
  module: string
}

const LEGACY_MODULE_TARGETS: Record<string, DiscoveryNewTargetId> = {
  labs: 'nav-labs',
  note: 'nav-kb',
  trips: 'nav-trips',
  habits: 'nav-habits',
  projects: 'nav-projects',
  membership: 'nav-premium',
  premium: 'nav-premium',
  'tasks-analytics': 'tasks-analytics-tab',
}

export function NavNewBadge({ module }: Props) {
  const target = LEGACY_MODULE_TARGETS[module]
  if (!target) return null
  return <DiscoveryNewBadge target={target} />
}

export function markNavModuleSeen(module: string) {
  const target = LEGACY_MODULE_TARGETS[module]
  if (target) markDiscoveryNewTargetSeen(target)
}
