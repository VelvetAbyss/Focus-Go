import { describe, expect, it } from 'vitest'
import { canUsePremiumFeature } from './premiumGate'

describe('premiumGate', () => {
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
})
