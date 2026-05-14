import { DiscoveryNewBadge } from './DiscoveryNewBadge'
import { LEGACY_MODULE_TARGETS } from './navNewTargets'

interface Props {
  /** Module key matching navStorageKey() — e.g. 'trips', 'labs', 'note' */
  module: string
}

export function NavNewBadge({ module }: Props) {
  const target = LEGACY_MODULE_TARGETS[module]
  if (!target) return null
  return <DiscoveryNewBadge target={target} />
}
