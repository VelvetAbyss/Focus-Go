import { describe, expect, it } from 'vitest'
import { getLifeCards } from './registry'

describe('getLifeCards', () => {
  it('registers daily review on the life dashboard', () => {
    expect(getLifeCards().some((card) => card.id === 'daily_review')).toBe(true)
  })
})
