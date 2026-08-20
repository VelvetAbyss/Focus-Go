import { describe, expect, it } from 'vitest'
import { canUsePremiumFeature } from './premiumGate'

describe('premiumGate', () => {
  it('allows every legacy gate for every user after the free transition', () => {
    expect(canUsePremiumFeature('notes.max-count', { isPremium: true, noteCount: 21 })).toEqual({
      allowed: true,
      reason: null,
    })
    expect(canUsePremiumFeature('tasks.subtasks', { isPremium: true })).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('does not block formerly premium-only entry gates', () => {
    expect(canUsePremiumFeature('tasks.subtasks', { isPremium: false })).toEqual({
      allowed: true,
      reason: null,
    })
  })

  it('does not impose a note-count limit', () => {
    expect(canUsePremiumFeature('notes.max-count', { isPremium: false, noteCount: 20 })).toEqual({
      allowed: true,
      reason: null,
    })
    expect(canUsePremiumFeature('notes.max-count', { isPremium: false, noteCount: 21 })).toEqual({
      allowed: true,
      reason: null,
    })
  })
})
