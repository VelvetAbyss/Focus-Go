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
      panelClassName="w-[min(520px,calc(100vw-32px))] rounded-[28px] border border-[#3A3733]/10 bg-[#F5F3F0] shadow-[0_30px_100px_rgba(58,55,51,0.18)]"
      contentClassName="p-0"
    >
      <div className="space-y-5 p-6 text-[#3A3733]">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3A3733]/56">Premium</div>
          <h2 className="text-[28px] font-semibold tracking-[-0.03em]">Upgrade to Premium</h2>
          <p className="text-sm leading-6 text-[#3A3733]/72">{gate.description}</p>
        </div>

        <div className="rounded-[22px] border border-[#3A3733]/8 bg-white/72 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#3A3733]/56">Locked feature</p>
          <p className="mt-2 text-sm font-medium">{gate.title}</p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-full border-[#3A3733]/12 bg-transparent text-[#3A3733]" onClick={onClose} disabled={loading}>
            Maybe later
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#3A3733] text-[#F5F3F0] hover:bg-[#3A3733]/90"
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

export const usePremiumGate = () => {
  const ctx = useContext(PremiumGateContext)
  if (!ctx) throw new Error('usePremiumGate must be used within PremiumProvider')
  return ctx
}
