import { createContext } from 'react'
import type { HintId, HintRegion } from './hints'

export interface DiscoveryHintContextValue {
  activeHintForRegion: (region: HintRegion) => HintId | null
  dismiss: (id: HintId) => void
  reset: () => void
}

export const DiscoveryHintContext = createContext<DiscoveryHintContextValue | null>(null)
