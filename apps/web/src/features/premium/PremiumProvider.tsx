import { createContext, useContext, type ReactNode } from 'react'
import type { GateSource, GateCheckResult, PremiumGateKey } from './premiumGate'

type GuardPayload = {
  noteCount?: number
}

type PremiumGateContextValue = {
  isPremium: true
  canUse: (gateKey: PremiumGateKey, payload?: GuardPayload) => GateCheckResult
  openUpgradeModal: (source: GateSource, gateKey: PremiumGateKey) => void
  guard: (gateKey: PremiumGateKey, action: () => void | Promise<void>, payload?: GuardPayload, source?: GateSource) => Promise<boolean>
}

const PremiumGateContext = createContext<PremiumGateContextValue | null>(null)

export const PremiumProvider = ({ children }: { children: ReactNode }) => {
  const value: PremiumGateContextValue = {
    isPremium: true,
    canUse: () => ({ allowed: true, reason: null }),
    openUpgradeModal: () => {},
    guard: async (_gateKey, action) => { await action(); return true },
  }

  return (
    <PremiumGateContext.Provider value={value}>
      {children}
    </PremiumGateContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePremiumGate = () => {
  const ctx = useContext(PremiumGateContext)
  if (!ctx) throw new Error('usePremiumGate must be used within PremiumProvider')
  return ctx
}
