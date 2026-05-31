import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import Dialog from '../../shared/ui/Dialog'
import { Button } from '@/components/ui/button'
import { useAuthPlan, upgradeToPremium } from '../../store/auth'
import {
  canUsePremiumFeature,
  PREMIUM_GATES,
  type GateSource,
  type GateCheckResult,
  type PremiumGateKey,
} from './premiumGate'

type GuardPayload = {
  noteCount?: number
}

type PremiumModalState = {
  open: boolean
  gateKey: PremiumGateKey
  source: GateSource
}

type PremiumGateContextValue = {
  isPremium: boolean
  canUse: (gateKey: PremiumGateKey, payload?: GuardPayload) => GateCheckResult
  openUpgradeModal: (source: GateSource, gateKey: PremiumGateKey) => void
  guard: (gateKey: PremiumGateKey, action: () => void | Promise<void>, payload?: GuardPayload, source?: GateSource) => Promise<boolean>
}

const PremiumGateContext = createContext<PremiumGateContextValue | null>(null)

const UpgradeModal = ({
  state,
  onClose,
}: {
  state: PremiumModalState
  onClose: () => void
}) => {
  const gate = PREMIUM_GATES[state.gateKey]
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    await upgradeToPremium()
    setLoading(false)
    onClose()
  }

  return (
    <Dialog
      open={state.open}
      onClose={onClose}
      panelClassName="w-[min(520px,calc(100vw-32px))] rounded-[28px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] shadow-[var(--shadow-card-lg)]"
      contentClassName="p-0"
    >
      <div className="space-y-5 p-6 text-[var(--text-primary)]">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--text-primary)_56%,transparent)]">Premium</div>
          <h2 className="text-[28px] font-semibold tracking-[-0.03em]">Upgrade to Premium</h2>
          <p className="text-sm leading-6 text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">{gate.description}</p>
        </div>

        <div className="rounded-[22px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] bg-[color-mix(in_srgb,var(--bg-elevated)_72%,transparent)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--text-primary)_56%,transparent)]">Locked feature</p>
          <p className="mt-2 text-sm font-medium">{gate.title}</p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-full border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] bg-transparent text-[var(--text-primary)]" onClick={onClose} disabled={loading}>
            Maybe later
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[var(--text-primary)] text-[var(--bg-elevated)] hover:bg-[color-mix(in_srgb,var(--text-primary)_90%,transparent)]"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? 'Upgrading…' : 'Upgrade now'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export const PremiumProvider = ({ children }: { children: ReactNode }) => {
  const plan = useAuthPlan()
  const [modalState, setModalState] = useState<PremiumModalState | null>(null)
  const isPremium = plan === 'premium'

  const value = useMemo<PremiumGateContextValue>(() => {
    const openUpgradeModal = (source: GateSource, gateKey: PremiumGateKey) => {
      setModalState({ open: true, source, gateKey })
    }

    return {
      isPremium,
      canUse: (gateKey, payload) => canUsePremiumFeature(gateKey, { isPremium, noteCount: payload?.noteCount }),
      openUpgradeModal,
      guard: async (gateKey, action, payload, source = 'button') => {
        const result = canUsePremiumFeature(gateKey, { isPremium, noteCount: payload?.noteCount })
        if (!result.allowed) {
          openUpgradeModal(source, gateKey)
          return false
        }
        await action()
        return true
      },
    }
  }, [isPremium])

  return (
    <PremiumGateContext.Provider value={value}>
      {children}
      {modalState ? <UpgradeModal state={modalState} onClose={() => setModalState(null)} /> : null}
    </PremiumGateContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePremiumGate = () => {
  const ctx = useContext(PremiumGateContext)
  if (!ctx) throw new Error('usePremiumGate must be used within PremiumProvider')
  return ctx
}
