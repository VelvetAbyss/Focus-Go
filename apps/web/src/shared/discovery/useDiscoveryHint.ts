import { useContext } from 'react'
import type { HintId, HintRegion } from './hints'
import { DiscoveryHintContext } from './discoveryHintContextValue'

export function useDiscoveryHint(region: HintRegion): {
  activeHintId: HintId | null
  dismiss: (id: HintId) => void
} {
  const ctx = useContext(DiscoveryHintContext)
  if (!ctx) throw new Error('useDiscoveryHint must be used within DiscoveryHintProvider')
  return {
    activeHintId: ctx.activeHintForRegion(region),
    dismiss: ctx.dismiss,
  }
}

export function useDiscoveryReset(): () => void {
  const ctx = useContext(DiscoveryHintContext)
  if (!ctx) throw new Error('useDiscoveryReset must be used within DiscoveryHintProvider')
  return ctx.reset
}
