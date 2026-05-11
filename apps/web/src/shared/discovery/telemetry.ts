import type { HintId } from './hints'

export type HintAction = 'dismissed' | 'clicked'

/**
 * Record a hint interaction event.
 *
 * Phase 1: no-op stub. Wire to POST /api/discovery/hint-event in Phase 1.5
 * once the backend endpoint exists.
 */
export function recordHintEvent(_id: HintId, _action: HintAction): void {
  // Phase 1.5: replace with real endpoint call
}
