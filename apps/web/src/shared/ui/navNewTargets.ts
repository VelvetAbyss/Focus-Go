import type { DiscoveryNewTargetId } from '../discovery/newTargets'
import { markDiscoveryNewTargetSeen } from '../discovery/discoveryNewTargetActions'

export const LEGACY_MODULE_TARGETS: Record<string, DiscoveryNewTargetId> = {
  labs: 'nav-labs',
  note: 'nav-kb',
  trips: 'nav-trips',
  habits: 'nav-habits',
  projects: 'nav-projects',
  'tasks-analytics': 'tasks-analytics-tab',
}

export function markNavModuleSeen(module: string) {
  const target = LEGACY_MODULE_TARGETS[module]
  if (target) markDiscoveryNewTargetSeen(target)
}
