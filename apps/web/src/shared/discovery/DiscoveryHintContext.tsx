import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { HINTS, type HintId, type HintRegion } from './hints'
import { dismissHint, isHintDismissed, resetDiscovery } from './resetDiscovery'
import { recordHintEvent } from './telemetry'
import { DiscoveryHintContext } from './discoveryHintContextValue'

// ─── State ───────────────────────────────────────────────────────────────────

type State = {
  /** IDs dismissed this session (in-memory fallback for private browsing) */
  sessionDismissed: Set<HintId>
}

type Action =
  | { type: 'dismiss'; id: HintId }
  | { type: 'reset' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'dismiss':
      return { sessionDismissed: new Set([...state.sessionDismissed, action.id]) }
    case 'reset':
      return { sessionDismissed: new Set() }
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function DiscoveryHintProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { sessionDismissed: new Set<HintId>() })

  const isDismissed = useCallback(
    (id: HintId): boolean => {
      return state.sessionDismissed.has(id) || isHintDismissed(id)
    },
    [state.sessionDismissed],
  )

  const activeHintForRegion = useCallback(
    (region: HintRegion): HintId | null => {
      const candidates = Object.values(HINTS)
        .filter((h) => h.region === region && !isDismissed(h.id as HintId))
        .sort((a, b) => b.priority - a.priority)
      return (candidates[0]?.id as HintId) ?? null
    },
    [isDismissed],
  )

  const dismiss = useCallback(
    (id: HintId) => {
      try {
        dismissHint(id)
      } catch {
        // localStorage unavailable: fall back to session-only dismiss
      }
      recordHintEvent(id, 'dismissed')
      dispatch({ type: 'dismiss', id })
    },
    [],
  )

  const reset = useCallback(() => {
    resetDiscovery()
    dispatch({ type: 'reset' })
  }, [])

  // Re-render when another tab dismisses or resets hints
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith('focusgo.discovery.') || e.key === '__discovery_reset__') {
        dispatch({ type: 'reset' })
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const value = useMemo(
    () => ({ activeHintForRegion, dismiss, reset }),
    [activeHintForRegion, dismiss, reset],
  )

  return <DiscoveryHintContext.Provider value={value}>{children}</DiscoveryHintContext.Provider>
}
