import type { DiscoveryNewTargetId } from './newTargets'
import { markDiscoveryNewSeen } from './resetDiscovery'

export function markDiscoveryNewTargetSeen(target: DiscoveryNewTargetId) {
  markDiscoveryNewSeen(target)
}

export type { DiscoveryNewTargetId }
