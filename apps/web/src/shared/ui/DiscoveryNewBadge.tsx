import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { DiscoveryNewTargetId } from '../discovery/newTargets'
import { DISCOVERY_NEW_UPDATED_EVENT, isDiscoveryNewSeen } from '../discovery/resetDiscovery'
import './NavNewBadge.css'

type DiscoveryNewBadgeProps = {
  target: DiscoveryNewTargetId
  className?: string
}

export function DiscoveryNewBadge({ target, className }: DiscoveryNewBadgeProps) {
  const [seen, setSeen] = useState(() => isDiscoveryNewSeen(target))

  useEffect(() => {
    const handler = () => setSeen(isDiscoveryNewSeen(target))
    window.addEventListener('storage', handler)
    window.addEventListener(DISCOVERY_NEW_UPDATED_EVENT, handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener(DISCOVERY_NEW_UPDATED_EVENT, handler)
    }
  }, [target])

  if (seen) return null
  return <span className={cn('discovery-new-badge', className)} aria-hidden="true" />
}
