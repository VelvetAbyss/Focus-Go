import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canUsePremiumFeature } from './premiumGate'
import * as localhost from '../../shared/env/localhost'

vi.mock('../../shared/env/localhost', () => ({
  isLocalhostRuntime: vi.fn(() => false),
}))

describe('premiumGate', () => {
  beforeEach(() => {
    vi.mocked(localhost.isLocalhostRuntime).mockReturnValue(false)
  })

  it('allows premium users to access all gated features', () => {
    expect(canUsePremiumFeature('notes.max-count', { isPremium: true, noteCount: 21 })).toEqual({
      allowed: true,
      reason: null,
    })
    expect(canUsePremiumFeature('tasks.subtasks', { isPremium: true })).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('blocks premium-only entry gates for free users', () => {
    expect(canUsePremiumFeature('tasks.subtasks', { isPremium: false })).toEqual({
      allowed: false,
      reason: 'premium_required',
    })
  })

  it('blocks note creation after the free limit', () => {
    expect(canUsePremiumFeature('notes.max-count', { isPremium: false, noteCount: 20 })).toEqual({
      allowed: true,
      reason: null,
    })
    expect(canUsePremiumFeature('notes.max-count', { isPremium: false, noteCount: 21 })).toEqual({
      allowed: false,
      reason: 'limit_reached',
    })
  })

  it('allows all gated features on localhost', () => {
    vi.mocked(localhost.isLocalhostRuntime).mockReturnValue(true)
    expect(canUsePremiumFeature('tasks.subtasks', { isPremium: false })).toEqual({
      allowed: true,
      reason: null,
    })
  })
})
